export class URLInvalidError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, URLInvalidError);
        }

        this.name = "URLInvalidError";
    }
}

export class HTTPStatusCodeError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, HTTPStatusCodeError);
        }

        this.name = "HTTPStatusCodeError";
    }
}
