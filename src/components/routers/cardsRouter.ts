import { renderToString } from "react-dom/server";
import fastify from "fastify";
import ogs from "open-graph-scraper";
import { ErrorResult } from "open-graph-scraper/types/lib/types";
import config from "@/config.js";
import { Cards } from "../react/components/cards.js";
import { Html2svg } from "../react/components/html2svg.js";
import CacheService from "../cache.js";
import getOGPInfo, { HTTPStatusCodeError } from "../ogp.js";
import { FetchError } from "node-fetch";

const cache = new CacheService(["memory", "redis"]);

export class URLInvalidError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, URLInvalidError);
        }

        this.name = "URLInvalidError";
    }
}

export default async function cardsRouter(req: fastify.FastifyRequest<{ Querystring: { [key: string]: string | undefined } }>, res: fastify.FastifyReply) {
    res.header("x-robots-tag", "noindex");
    res.header("access-control-allow-origin", "*");

    try {
        if (!req.query.url) {
            throw new URLInvalidError("URL must be specified");
        }
        if (!URL.canParse(req.query.url)) {
            throw new URLInvalidError("Invalid URL")
        }

        const response_cache_key = CacheService.cacheKeyGenerate(
            "response",
            { url: req.query.url, type: req.query.type ?? "svg", ua: config.user_agent, lang: req.query.lang ?? "" }
        );
        let response = await cache.get({ key: response_cache_key });
        if (!response) {
            const ogp_result = await getOGPInfo({
                url: req.query.url,
                language: req.query.url ?? undefined,
            });
            switch (req.query.type) {
                case "oembed":
                    const oembed = {
                        version: "1.0",
                        title: ogp_result.title,
                        url: ogp_result.url,
                        provider_name: "Link Card",
                        provider_url: `https://${config.server_host}`,
                        type: "rich",
                        html: `<iframe style="width: 500px; height: 126px; border: 0" src="${`https://${config.server_host}/cards?type=html&url=${encodeURI(req.query.url)}`}"></iframe>`,
                        width: 500,
                        height: 126,
                    };
                    response = JSON.stringify(oembed);
                    break;
                case "html":
                case "svg":
                default:
                    const card = Cards({
                        title: ogp_result.title,
                        description: ogp_result.description,
                        url: ogp_result.url,
                        image_url: ogp_result.image_url,
                    });
                    if (req.query.type == "html") {
                        response = renderToString(card);
                    } else {
                        const card_svg = Html2svg({ html: card });
                        response = renderToString(card_svg);
                    }
                    break;
            }

            await cache.set({
                key: response_cache_key,
                value: response,
                expires: 3600, // 1時間
            });
        }

        switch (req.query.type) {
            case "oembed":
                res.type("application/json");
                break;
            case "html":
                res.type("text/html");
                break;
            case "svg":
            default:
                res.type("image/svg+xml");
            break;
        }

        res.code(200);
        return res.send(response);
    } catch (e) {
        console.error(e);

        let card;
        if (e instanceof HTTPStatusCodeError || e instanceof URLInvalidError) {
            card = Cards({
                title: e.message,
                description: "",
                url: "",
                image_url: "",
            });
            res.code(400);
        } else if (e instanceof FetchError && e.code == "ENOTFOUND") {
            card = Cards({
                title: "Not found",
                description: "",
                url: "",
                image_url: "",
            });
            res.code(400);
        } else if ((function(e): e is ErrorResult { return e instanceof Object && !(e instanceof Array) })(e)) {
            card = Cards({
                title: e?.result?.error ?? "Something went wrong!",
                description: "file an issue at https://l.foss.beauty/link-card",
                url: "",
                image_url: ""
            });
            res.code(500);
        } else {
            card = Cards({
                title: "Something went wrong!",
                description: "file an issue at https://l.foss.beauty/link-card",
                url: "",
                image_url: ""
            });
            res.code(500);
        }

        let response;
        if (req.query.type == "html") {
            response = renderToString(card);
            res.type("text/html");
        } else {
            const card_svg = Html2svg({ html: card });
            response = renderToString(card_svg);
            res.type("image/svg+xml");
        }
        return res.send(response);
    }
}
