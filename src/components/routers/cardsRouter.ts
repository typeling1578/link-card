import { renderToString } from "react-dom/server";
import fastify from "fastify";
import ogs from "open-graph-scraper";
import { ErrorResult } from "open-graph-scraper/types/lib/types";
import config from "@/config.js";
import { Cards } from "../react/components/cards.js";
import { Html2svg } from "../react/components/html2svg.js";
import cardsGenerator from "../cards-generator.js";
import CacheService from "../cache.js";
const cache = new CacheService(["memory", "redis"]);

export default async function cardsRouter(req: fastify.FastifyRequest<{ Querystring: { [key: string]: string | undefined } }>, res: fastify.FastifyReply) {
    res.header("x-robots-tag", "noindex");

    try {
        if (!req.query.url) {
            throw new Error("url must be specified");
        }
        new URL(req.query.url);
    } catch (e) {
        console.error(e);

        const card = Cards({
            title: "Invalid URL",
            description: "",
            url: "",
            image_url: ""
        });
        let response;
        if (req.query.type == "html") {
            response = renderToString(card);
            res.type("text/html");
        } else {
            const card_svg = Html2svg({ html: card });
            response = renderToString(card_svg);
            res.type("image/svg+xml");
        }
        res.code(400);
        return res.send(response);
    }

    try {
        const response_cache_key = CacheService.cacheKeyGenerate(
            "response",
            { url: req.query.url, type: req.query.type ?? "svg", ua: config.user_agent, lang: req.query.lang ?? "" }
        );
        let response = await cache.get({ key: response_cache_key });
        if (!response) {
            const card = await cardsGenerator(req.query.url, req.query.lang);
            if (req.query.type == "html") {
                response = renderToString(card);
            } else {
                const card_svg = Html2svg({ html: card });
                response = renderToString(card_svg);
            }

            await cache.set({
                key: response_cache_key,
                value: response,
                expires: 3600, // 1時間
            });
        }

        if (req.query.type == "html") {
            res.type("text/html");
        } else {
            res.type("image/svg+xml");
        }
        res.code(200);
        return res.send(response);
    } catch (e) {
        console.error(e);

        const card = Cards({
            title: (function(e): e is ErrorResult { return e instanceof Object && !(e instanceof Array) })(e) ?
                    e?.result?.error ?? "Something went wrong!" :
                    "Something went wrong!" ,
            description: "file an issue at https://l.foss.beauty/link-card",
            url: "",
            image_url: ""
        });
        let response;
        if (req.query.type == "html") {
            response = renderToString(card);
            res.type("text/html");
        } else {
            const card_svg = Html2svg({ html: card });
            response = renderToString(card_svg);
            res.type("image/svg+xml");
        }
        res.code(500);
        return res.send(response);
    }
}
