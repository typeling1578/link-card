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

export class URLIsNotAllowed extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, URLIsNotAllowed);
        }

        this.name = "URLIsNotAllowed";
    }
}
