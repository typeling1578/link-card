import fs from "fs/promises";
import yaml from "yaml";
import appRootPath from "app-root-path";

const config_file: Buffer = await fs.readFile(`${appRootPath.path}/.config/config.yaml`);
const config = yaml.parse(config_file.toString("utf-8"));

function valueString(config: string | null, fallback: string) {
    return config ?? fallback;
}

function valueNumber(config: number | null, fallback: number) {
    return config ?? fallback;
}

function valueBoolean(config: boolean | null, fallback: boolean) {
    return config ?? fallback;
}

export default {
    _raw: config,
    // server_name: valueString(config?.server_name, "Link Card"),
    server_host: valueString(config?.server_host, "example.tld"),
    http_host: valueString(config?.http_host, "0.0.0.0"),
    http_port: valueNumber(config?.http_port ? Number(config.http_port) : null, 8000),
    http_compress: valueBoolean(config?.http_compress, true),
    redis: {
        host: valueString(config?.redis?.host, "127.0.0.1"),
        port: valueString(config?.redis?.port, "6379"),
        username: config?.redis?.username,
        password: config?.redis?.password,
        db_number: valueString(config?.redis?.db_number, ""),
    },
    proxy: config?.proxy,
    user_agent: valueString(config?.user_agent, "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"),
}
