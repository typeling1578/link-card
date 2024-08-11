import React from "react";

declare module "react" {
    interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
        xmlns?: string;
    }
}

export function Html2svg({ html }: { html: JSX.Element }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 126" width="500" height="126">
            <style>
            </style>
            <g>
                <foreignObject x="0" y="0" width="100%" height="100%">
                    <html xmlns="http://www.w3.org/1999/xhtml">
                        {html}
                    </html>
                </foreignObject>
            </g>
        </svg>
    )
}
