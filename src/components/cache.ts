import config from '@/config.js';
import { RedisClientType, createClient } from 'redis';
import packageInfo from './package-reader.js';
import { glob } from "glob";
import appRootPath from 'app-root-path';
import fs from "fs";
import crypto from "crypto";

class RedisClient {
    constructor({ username, password, host, port , db_number }: { username: string, password: string, host: string, port: number, db_number: string }) {
        let redis_uri = "redis://";

        if (username && password) {
            redis_uri += `${username}:${password}@`;
        } else if (username) {
            redis_uri += `${username}@`;
        } else if (password) {
            redis_uri += `:${password}@`;
        }
        redis_uri += host;
        redis_uri += `:${port}`;
        if (db_number) {
            redis_uri += `/${db_number}`;
        }

        this.#redis_uri = redis_uri;

        this.#redis_client = createClient({
            url: this.#redis_uri,
        });
        this.#redis_client.on("error", this.#handleErrorEvent);
    }

    #redis_uri: string;
    #redis_client: RedisClientType;
    #listeners: Array<{ type: "error"; callback: (e: Error) => void }> = [];
    isConnecting = false;
    isConnected = false;

    async connect() {
        if (this.isConnecting || this.isConnected) {
            return;
        }

        this.isConnecting = true;
        this.isConnected = false;

        await this.#redis_client.connect();

        this.isConnecting = false;
        this.isConnected = true;
    }

    async disconnect() {
        if (!this.isConnecting && !this.isConnected) {
            return;
        }

        await this.#redis_client.disconnect();

        this.isConnecting = false;
        this.isConnected = false;
    }

    async set(key: string, value: string, expires?: number) {
        if (expires != undefined) {
            await this.#redis_client.setEx(key, expires, value);
        } else {
            await this.#redis_client.set(key, value);
        }
    }

    async get(key: string): Promise<string | null> {
        return await this.#redis_client.get(key);
    }

    async has(key: string) {
        return Boolean(await this.#redis_client.exists(key));
    }

    async del(key: string) {
        await this.#redis_client.del(key);
    }

    on(type: "error", callback: (e: Error) => void) {
        this.#listeners.push({
            type: type,
            callback: callback
        });
    }

    #handleErrorEvent(e: Error) {
        const listeners = this.#listeners.filter(listener => listener.type == "error");
        for (const listener of listeners) {
            listener.callback(e);
        }
    }
}

class MemoryCache {
    #data: { [key: string]: { value: string | undefined; timeout_id?: NodeJS.Timeout } } = {};

    set(key: string, value: string, expires?: number) {
        if (this.get(key)) {
            this.del(key);
        }

        this.#data[key] = {
            value: value,
            timeout_id: expires != undefined ? setTimeout(() => { this.del(key) }, expires * 1000) : undefined,
        };
    }

    get(key: string): string | null {
        return this.#data[key]?.value ?? null;
    }

    has(key: string) {
        return Boolean(this.#data[key]);
    }

    del(key: string) {
        clearTimeout(this.#data[key].timeout_id);
        delete this.#data[key];
    }
}

type SaveTo = "memory" | "redis" | ["redis"] | ["memory"] | ["redis", "memory"] | ["memory", "redis"];

const memory_cache_instance = new MemoryCache();
const redis_cache_instance = config._raw?.redis ? new RedisClient({
    username: config.redis.username,
    password: config.redis.password,
    host: config.redis.host,
    port: Number(config.redis.port),
    db_number: config.redis.db_number,
}) : undefined;

export default class CacheService {
    constructor(save_to: SaveTo) {
        this.#save_to = save_to instanceof Array ? save_to : [save_to];

        if (this.#save_to.includes("memory")) {
            this.#memory_cache_instance = memory_cache_instance;
        }
        if (this.#save_to.includes("redis") && config._raw?.redis /*Redisの設定がユーザによって定義されていなければRedisを使わない*/) {
            this.#redis_cache_instance = redis_cache_instance;
        }

        if (packageInfo.version && process.env.NODE_ENV != "development") {
            this.#master_fingerprint = packageInfo.version;
        } else {
            const paths = glob.sync(`${appRootPath.path}/built/**/*.js`);
            const joined_hash = paths.map(path => fs.readFileSync(path))
                .map(buf => crypto.createHash("sha256").update(buf).digest("hex")).join("");
            this.#master_fingerprint = crypto.createHash("sha256").update(joined_hash).digest("hex");
        }
    }

    #save_to: Array<"memory" | "redis">;
    #memory_cache_instance?: MemoryCache;
    #redis_cache_instance?: RedisClient;
    #master_fingerprint: string;

    async set({ key, value, expires = 21600, save_to }: { key: string, value: string, expires?: number, save_to?: SaveTo }) {
        const _save_to = save_to ?
            save_to instanceof Array ? save_to : [save_to] :
            this.#save_to;
        const cache_key = `link-card-${this.#master_fingerprint}/${key}`;

        // キャッシュ先が複数指定されたときに、エラーなどで片方にだけキャッシュされることを避けるために、Redisへのキャッシュを先に処理するように
        if (_save_to.includes("redis") && this.#redis_cache_instance) {
            if (!this.#redis_cache_instance.isConnecting && !this.#redis_cache_instance.isConnected) {
                await this.#redis_cache_instance.connect();
            }
            await this.#redis_cache_instance.set(cache_key, value, expires);
        }

        if (_save_to.includes("memory") && this.#memory_cache_instance) {
            this.#memory_cache_instance.set(cache_key, value, expires);
        }
    }

    async get({ key, save_to }: { key: string, save_to?: SaveTo }) {
        const _save_to = save_to ?
            save_to instanceof Array ? save_to : [save_to] :
            this.#save_to;
        const cache_key = `link-card-${this.#master_fingerprint}/${key}`;

        if (_save_to.includes("redis") && this.#redis_cache_instance) {
            if (!this.#redis_cache_instance.isConnecting && !this.#redis_cache_instance.isConnected) {
                await this.#redis_cache_instance.connect();
            }
        }

        if (_save_to.includes("redis") && _save_to.includes("memory")) {
            let result1;
            if (_save_to[0] == "redis" && this.#redis_cache_instance) {
                result1 = await this.#redis_cache_instance.get(cache_key);
            } else if (_save_to[0] == "memory" && this.#memory_cache_instance) {
                result1 = this.#memory_cache_instance.get(cache_key);
            }

            if (result1) {
                return result1;
            }

            if (_save_to[1] == "redis" && this.#redis_cache_instance) {
                return await this.#redis_cache_instance.get(cache_key);
            } else if (_save_to[1] == "memory" && this.#memory_cache_instance) {
                return this.#memory_cache_instance.get(cache_key);
            }
        } else if (_save_to.includes("redis") && this.#redis_cache_instance) {
            return await this.#redis_cache_instance.get(cache_key);
        } else if (_save_to.includes("memory") && this.#memory_cache_instance) {
            return this.#memory_cache_instance.get(cache_key);
        }

        return null;
    }

    async has({ key, save_to }: { key: string, save_to?: SaveTo }) {
        const _save_to = save_to ?
            save_to instanceof Array ? save_to : [save_to] :
            this.#save_to;
        const cache_key = `link-card-${this.#master_fingerprint}/${key}`;

        if (_save_to.includes("redis") && this.#redis_cache_instance) {
            if (!this.#redis_cache_instance.isConnecting && !this.#redis_cache_instance.isConnected) {
                await this.#redis_cache_instance.connect();
            }
        }

        if (_save_to.includes("redis") && _save_to.includes("memory")) {
            let result1;
            if (_save_to[0] == "redis" && this.#redis_cache_instance) {
                result1 = await this.#redis_cache_instance.has(cache_key);
            } else if (_save_to[0] == "memory" && this.#memory_cache_instance) {
                result1 = this.#memory_cache_instance.has(cache_key);
            }

            if (result1) {
                return result1;
            }

            if (_save_to[1] == "redis" && this.#redis_cache_instance) {
                return await this.#redis_cache_instance.has(cache_key);
            } else if (_save_to[1] == "memory" && this.#memory_cache_instance) {
                return this.#memory_cache_instance.has(cache_key);
            }
        } else if (_save_to.includes("redis") && this.#redis_cache_instance) {
            return await this.#redis_cache_instance.has(cache_key);
        } else if (_save_to.includes("memory") && this.#memory_cache_instance) {
            return this.#memory_cache_instance.has(cache_key);
        }

        return false;
    }

    async del({ key, save_to }: { key: string, save_to?: SaveTo }) {
        const _save_to = save_to ?
            save_to instanceof Array ? save_to : [save_to] :
            this.#save_to;
        const cache_key = `link-card-${this.#master_fingerprint}/${key}`;

        // キャッシュ先が複数指定されたときに、エラーなどで片方にだけキャッシュされることを避けるために、Redisへのキャッシュを先に処理するように
        if (_save_to.includes("redis") && this.#redis_cache_instance) {
            if (!this.#redis_cache_instance.isConnecting && !this.#redis_cache_instance.isConnected) {
                await this.#redis_cache_instance.connect();
            }
            await this.#redis_cache_instance.del(cache_key);
        }

        if (_save_to.includes("memory") && this.#memory_cache_instance) {
            this.#memory_cache_instance.del(cache_key);
        }
    }

    static cacheKeyGenerate(name: string, query?: { [ key: string ]: string }) {
        let cache_key = name;
        if (query) {
            cache_key += "?";
            cache_key += Object.keys(query).sort()
                .map(key => `${key}=${crypto.createHash("sha256").update(query[key]).digest("hex")}`)
                .join("&");
        }
        return cache_key;
    }
}
