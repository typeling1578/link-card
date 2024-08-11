import fastify from "fastify";
import fastifyGracefulShutdown from "fastify-graceful-shutdown";
import fastifyWebsocket from "@fastify/websocket";
import fastifyMultipart from "@fastify/multipart";
import fastifyUrlData from "@fastify/url-data";
import fastifyCompress from "@fastify/compress";
import Router from "./router.js";
import config from "@/config.js";

export default class HTTPServer {
    constructor(
        host: string,
        port: number,
        routers: Array<Router>
    ) {
        this.#fastify = fastify({
            logger: process.env.NODE_ENV == "development" ? {
                transport: {
                    target: "pino-pretty"
                },
            } : false
        });

        this.#fastify.register(fastifyGracefulShutdown);

        if (routers.some(router => router.wsHandler)) {
            this.#fastify.register(fastifyWebsocket, {
                options: { maxPayload: 1024 }
            });
        }

        if (routers.some(router =>
            typeof router.method == "object" ?
                router.method.map(method => method.toLowerCase()).includes("post") :
                router.method.toLowerCase() == "post"
        )) {
            this.#fastify.register(fastifyMultipart, {
                limits: {
                    fieldNameSize: 100, // Max field name size in bytes
                    fieldSize: 100,     // Max field value size in bytes
                    fields: 10,         // Max number of non-file fields
                    fileSize: 1000000,  // For multipart forms, the max file size in bytes
                    files: 1,           // Max number of file fields
                    headerPairs: 2000,  // Max number of header key=>value pairs
                    parts: 1000         // For multipart forms, the max number of parts (fields + files)
                }
            });
        }

        this.#fastify.register(fastifyUrlData);

        if (config.http_compress) {
            // リバースプロキシを考慮する
            this.#fastify.register(fastifyCompress);
        }

        this.#fastify.register(async (fastify) => {
            for (let router of routers) {
                const handler = async (req: fastify.FastifyRequest, res: fastify.FastifyReply) => {
                    // methodを限定させても405を返してくれないので手動で返すようにする
                    if (typeof router.method == "object" &&
                        !router.method.some(method => method.toLowerCase() == req.method.toLowerCase())
                    ) {
                        res.code(405);
                        return;
                    } else if (typeof router.method == "string" &&
                        router.method.toLowerCase() != req.method.toLowerCase()
                    ) {
                        res.code(405);
                        return;
                    }

                    if (router.wsHandler && !router.handler) {
                        res.code(426);
                        res.header("connection", "upgrade");
                        res.header("upgrade", "websocket");
                        return;
                    } else if (!router.handler) {
                        res.callNotFound();
                        return;
                    }

                    await router.handler(req, res);
                };
                // methodを限定させても405を返してくれないので手動で返すようにする
                // WebSocketハンドラーを使うときはGETメソッドしか指定できないため、wsHandlerがあるときは定義を分割する
                fastify.route({
                    method: router.wsHandler ? "get" : ["get", "head", "post", "put", "delete", "options", "patch"],
                    url: router.url,
                    handler: handler,
                    wsHandler: router.wsHandler,
                });
                if (router.wsHandler) {
                    fastify.route({
                        method: ["head", "post", "put", "delete", "options", "patch"],
                        url: router.url,
                        handler: handler,
                    });
                }
            }
        });

        this.#fastify.listen({ port, host }, (err, address) => {
            if (err) throw err;
        });
    }
    #fastify: fastify.FastifyInstance;
    async close() {
        await this.#fastify.close();
    }
}
