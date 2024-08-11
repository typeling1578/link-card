import fastify from "fastify";

type Method = "get" | "head" | "post" | "put" | "delete" | "options" | "patch";

export default class Router {
    constructor(
        options: {
            url: string,
            method: Method | Array<Method>,
            handler?: ((req: fastify.FastifyRequest, res: fastify.FastifyReply) => void) |
                      ((req: fastify.FastifyRequest<any>, res: fastify.FastifyReply) => void),
            wsHandler?: ((connection: WebSocket, req: fastify.FastifyRequest) => void),
        }
    ) {
        this.url = options.url;
        this.method = options.method;
        this.handler = options.handler;
        this.wsHandler = options.wsHandler;
    }
    url: string;
    method: Method | Array<Method>;
    handler?: ((req: fastify.FastifyRequest, res: fastify.FastifyReply) => void) |
              ((req: fastify.FastifyRequest<any>, res: fastify.FastifyReply) => void);
    wsHandler?: ((connection: WebSocket, req: fastify.FastifyRequest) => void);
}
