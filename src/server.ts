import config from "@/config.js";
import HTTPServer from "./components/http-server/index.js";
import Router from "./components/http-server/router.js";

import cardsRouter from "./components/routers/cardsRouter.js";
import topRouter from "./components/routers/top.js";
import oembedRouter from "./components/routers/oembedRouter.js";

const routers: Array<Router> = [
    new Router({
        url: "/cards",
        method: "get",
        handler: cardsRouter,
    }),
    new Router({
        url: "/",
        method: "get",
        handler: topRouter,
    }),
    new Router({
        url: "/oembed",
        method: "get",
        handler: oembedRouter,
    }),
];

export default class HTTPServerRunner {
    constructor() {
        this.#http_server = new HTTPServer(config.http_host, config.http_port, routers);
    }
    #http_server: HTTPServer;
    async close() {
        await this.#http_server.close();
    }
}
