import React from "react";
import config from "@/config.js";

const maxWidth = 500;
const maxHeight = 126;

export function Cards({ title, description, url, image_url }: { title: string, description: string, url: string, image_url: string }) {

    return (
        <html>
            <head>
                <title>{title}</title>
                <link rel="alternate" type="application/json+oembed" href={`https://${config.server_host}/oembed?url=${encodeURIComponent(`https://${config.server_host}/cards?type=html&url=${encodeURIComponent(url)}`)}`} title={title} />
                <style>
                    {`
                    .main {
                        font-family: sans-serif;
                    }
                    .main {
                        background-color: #f2f2f2;
                        color: #000;
                    }
                    @media (prefers-color-scheme: dark) {
                        .main {
                            background-color: #0d0d0d;
                            color: #fff;
                        }
                    }
                    `}
                </style>
            </head>
            <body style={{ margin: "0" }}>
                <div className="main" style={{
                        display: "flex",
                        gap: "20px",
                        padding: "20px",
                        width: "500px",
                        height: "126px",
                        borderRadius: "6px",
                        border: "rgba(128, 128, 128, 0.2) solid 1px",
                        boxSizing: "border-box",
                    }}
                >
                    <div style={{ gridArea: "image", width: "85px", height: "85px" }} className="ogp-image">
                        <img style={{ width: "100%", height: "100%", objectFit: "contain" }} src={image_url}></img>
                    </div>
                    <div style={{ maxWidth: `${maxWidth - 20 - 80 - 25 - 20}px` }}>
                        <div style={{ lineHeight: "1.5", height:"calc(18px * 1.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "18px" }} className="ogp-title">
                            {title}
                        </div>
                        <div style={{ lineHeight: "1.5", height:"calc(16px * 1.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="ogp-description">
                            {description}
                        </div>
                        <div>
                            <a href={url} target="_blank">
                                <div style={{ lineHeight: "1.5", height:"calc(16px * 1.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</div>
                            </a>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    )
}
