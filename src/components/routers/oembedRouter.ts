import appRootPath from "app-root-path";
import fastify from "fastify";
import fs from "fs";
import getOGPInfo from "../ogp.js";
import { URLInvalidError } from "../errors.js";
import config from "@/config.js";
import CacheService from "../cache.js";

const oembed_cache = new CacheService(["memory", "redis"]);

export default async function oembedRouter(req: fastify.FastifyRequest<{ Querystring: { [key: string]: string | undefined } }>, res: fastify.FastifyReply) {
    try {
        if (!req.query.url) {
            throw new URLInvalidError("URL must be specified");
        }
        if (!URL.canParse(req.query.url)) {
            throw new URLInvalidError("Invalid URL")
        }

        const url = (new URL(req.query.url).searchParams.get("url"));
        if (!url) {
            throw new URLInvalidError("Invalid URL");
        }

        const response_cache_key = CacheService.cacheKeyGenerate(
            "oembed",
            { url: req.query.url, ua: config.user_agent }
        );
        let response = await oembed_cache.get({ key: response_cache_key });
        if (!response) {
            const oembed = {
                version: "1.0",
                title: "Link Card",
                url: `https://${config.server_host}/cards?type=html&url=${encodeURIComponent(url)}`,
                provider_name: "Link Card",
                provider_url: `https://${config.server_host}`,
                type: "rich",
                html: `<iframe style="width: 500px; height: 126px; border: 0" src="${`https://${config.server_host}/cards?type=html&url=${encodeURIComponent(url)}`}"></iframe>`,
                width: 500,
                height: 126,
            };
            response = JSON.stringify(oembed);

            await oembed_cache.set({ key: response_cache_key, value: response });
        }

        res.type("application/json");
        res.code(200);
        return res.send(response);
    } catch(e) {
        console.error(e);

        res.type("application/json");
        res.code(500);
        return res.send("{}");
    }
}
