import ogs from "open-graph-scraper";
import { ImageObject } from "open-graph-scraper/types/lib/types";
import config from "@/config.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import fs from "fs";
import appRootPath from "app-root-path";
import path from "path";
import { contentType } from "./http-server/content-type.js";
import fetch from "node-fetch";
import CacheService from "./cache.js";
import { parse as htmlParser } from "node-html-parser";
import { HTTPStatusCodeError } from "./errors.js";

const cache = new CacheService(["memory", "redis"]);

export default async function getOGPInfo({ url, language }: { url: string, language?: string }) {
    const page_text_cache_key = CacheService.cacheKeyGenerate(
        "page_text",
        { url: url, ua: config.user_agent, lang: language ?? "" }
    );
    let page_text = await cache.get({ key: page_text_cache_key });
    if (!page_text) {
        console.log("[INFO]","page_text cache miss");
        const page_result = await fetch(url, {
            headers: {
                "User-Agent": config.user_agent,
                "Accept-Language": language ?? "",
            },
            size: 5242880, // 5MB
            signal: AbortSignal.timeout(10000),
            agent: config.proxy ? new HttpsProxyAgent(config.proxy) : undefined
        });
        if (page_result.status != 200) {
            throw new HTTPStatusCodeError(`${page_result.status} ${page_result.statusText}`);
        }
        page_text = await page_result.text();
        await cache.set({
            key: page_text_cache_key,
            value: page_text,
            expires: 600, // 5分
        });
    }
    const ogp = await ogs({
        html: page_text,
    });
    if (!(await ogs({ html: page_text, onlyGetOpenGraphInfo: true })).result.ogImage) {
        delete ogp.result.ogImage;

        // 有名なサービスでOGPに対応してないときの独自のフォールバックを行う

        class ImageObjectGenerator implements ImageObject {
            constructor(url: string) {
                this.url = url;
            }
            url: string;
        }

        // AmazonはOGPに非対応なので、いい感じ™にする
        const amazon_domain_regex = /^(www\.)?amazon\.(com|ae|co\.uk|it|in|eg|com\.au|nl|ca|sa|sg|se|es|de|com\.tr|com\.br|fr|com\.be|pl|com\.mx|cn|co\.za|co\.jp)$/;
        if (amazon_domain_regex.test((new URL(url)).hostname)) {
            const amazon_image_urls_cache_key = CacheService.cacheKeyGenerate(
                "service_amazon_images",
                { url: url, ua: config.user_agent }
            );
            let amazon_image_urls = (await cache.get({ key: amazon_image_urls_cache_key }))
                ?.split(",").map(image_url => decodeURIComponent(image_url));
            if (!amazon_image_urls) {
                console.log("[INFO]", "service_amazon_images cache miss");
                const dom = htmlParser(page_text);
                amazon_image_urls = [];
                for (const img of dom.querySelectorAll("#altImages ul li img")) {
                    const src = img.getAttribute("src");
                    if (src && !src.startsWith("data:")) {
                        if (src.includes("transparent-pixel")) {
                            // 無意味な画像を捨てる
                            continue;
                        }
                        // https://m.media-amazon.com/images/I/317weliP8eL._AC_US40_.jpg
                        // このようなURLが得られるので、"_US40_"つまり40pxなので、解像度を引き上げる
                        // "_SS40_"などのときもある
                        const src_upscale = src.replace(/_([A-Z]{2})[0-9]{2,4}_(\.(jpg|png|webp))?$/, "_$1128_$2");
                        amazon_image_urls.push(src_upscale);
                    }
                }
                await cache.set({
                    key: amazon_image_urls_cache_key,
                    value: amazon_image_urls.map(image_url => encodeURIComponent(image_url)).join(","),
                    expires: 21600, // 6時間
                });
            }
            ogp.result.ogImage = amazon_image_urls.length == 0 ? undefined : amazon_image_urls.map(image_url => new ImageObjectGenerator(image_url));
        }
    }

    const image_url = ogp.result.ogImage?.[0]?.url ?? `https://icons.duckduckgo.com/ip3/${(new URL(url)).hostname}.ico`;
    const image_data_url_cache_key = CacheService.cacheKeyGenerate(
        "image_data_url",
        { url: image_url, ua: config.user_agent, lang: language ?? ""}
    );
    let image_data_url = await cache.get({ key: image_data_url_cache_key });
    if (!image_data_url) {
        console.log("[INFO]","image_data_url cache miss");
        const image_url_absolute = (new URL(image_url, url)).toString();
        const image_result = await fetch(image_url_absolute, {
            headers: {
                "User-Agent": config.user_agent,
                "Accept-Language": language ?? "",
            },
            size: 3145728, // 3MB
            signal: AbortSignal.timeout(10000),
            agent: config.proxy ? new HttpsProxyAgent(config.proxy) : undefined
        });
        let image_blob;
        if (image_result.status == 200) {
            image_blob = await image_result.blob();
        } else {
            const image_path = `${appRootPath.path}/assets/globe_24dp_5F6368_FILL0_wght400_GRAD0_opsz24.svg`;
            const image_result = await fs.promises.readFile(image_path);
            image_blob = new Blob([image_result], { type: contentType[path.extname(image_path)] ?? "application/octet-stream" })
        }
        image_data_url = `data:${image_blob.type};base64,${Buffer.from(await image_blob.arrayBuffer()).toString("base64")}`;
        await cache.set({
            key: image_data_url_cache_key,
            value: image_data_url,
            expires: 10800, // 3時間
            save_to: config._raw?.redis ? "redis" : "memory"
        });
    }

    return {
        title: ogp.result.ogTitle ?? ogp.result.dcTitle ?? url,
        description: ogp.result.ogDescription ?? ogp.result.dcDescription ?? "",
        url: url,
        image_url: image_data_url,
    };
}
