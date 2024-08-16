import dns from "dns";
import fs from "fs";
import punycode from "punycode/punycode.js";
import CacheService from "./cache.js";
import stringToBoolean from "./string-to-boolean.js";
import config from "@/config.js";

const CLOUDFLARE_FAMILY_DNS = [
    "1.1.1.2",
    "1.0.0.2",
    "2606:4700:4700::1112",
    "2606:4700:4700::1002",
];
const CLOUDFLARE_FAMILY_WITH_ADULT_BLOCK_DNS = [
    "1.1.1.3",
    "1.0.0.3",
    "2606:4700:4700::1113",
    "2606:4700:4700::1003",
];

const malicious_url_cache = new CacheService(["memory", "redis"]);

export async function isMaliciousURL(url: string, options?: { filteringAdult: boolean }) {
    const domain = (new URL(url)).hostname;

    const malicious_url_cache_key = CacheService.cacheKeyGenerate("malicious-url", {
        domain: domain,
        filteringAdult: String(options?.filteringAdult ?? false)
    });
    let is_malicious_url = stringToBoolean(await malicious_url_cache.get({ key: malicious_url_cache_key }));
    if (is_malicious_url == null) {
        const dns_filtering = new dns.promises.Resolver();
        if (options?.filteringAdult) {
            dns_filtering.setServers(CLOUDFLARE_FAMILY_WITH_ADULT_BLOCK_DNS);
        } else {
            dns_filtering.setServers(CLOUDFLARE_FAMILY_DNS);
        }

        let result;
        try {
            result = await dns_filtering.resolve4(domain);
        } catch (e: any) {
            if (e.code == "ENODATA") {
                try {
                    result = await dns_filtering.resolve6(domain);
                } catch (e: any) {
                    if (e.code != "ENOTFOUND" && e.code != "ENODATA") {
                        throw e;
                    }
                }
            } else if (e.code != "ENOTFOUND") {
                throw e;
            }
        }
        is_malicious_url = Boolean(result?.includes("0.0.0.0") || result?.includes("::"));

        await malicious_url_cache.set({ key: malicious_url_cache_key, value: String(is_malicious_url) });
    }

    return is_malicious_url;
}

export async function isBlackListMatches(url: string) {
    const black_list_path = config.domains_blacklist_path;
    if (!fs.existsSync(black_list_path)) {
        return false;
    }

    const domain = (new URL(url)).hostname;

    const black_list = await fs.promises.readFile(black_list_path);
    const black_domains = black_list.toString("utf-8")
        .replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n").filter(line => line);
    for (const black_domain of black_domains) {
        const black_domain_ascii = punycode.toASCII(black_domain);
        if (domain == black_domain_ascii) {
            return true;
        }
        const domain_levels = domain.split(".").reverse();
        const black_domain_levels = black_domain.split(".").reverse();

        const match = black_domain_levels.every((black_domain_level, index) => {
            if (domain_levels[index] && domain_levels[index] == black_domain_level) {
                return true;
            }
            return false;
        });

        if (match) {
            return true;
        }
    }

    return false;
}
