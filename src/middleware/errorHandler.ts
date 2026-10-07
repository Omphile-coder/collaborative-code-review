import {
    Request,
    Response,
    NextFunction
} from "express";

interface ApiError extends Error {
    code?: string;
    constraint?: string;
    type?: string;
    status?: number;
}

export const errorHandler = (
    error: ApiError,
    _req: Request,
    res: Response,
    next: NextFunction
) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            message: "Invalid JSON in request body"
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            message: "Request body is too large"
        });
    }

    if (error.code === "23505") {
        return res.status(409).json({
            message:
                error.constraint === "users_email_key"
                    ? "Email already registered"
                    : "This record already exists"
        });
    }

    if (error.code === "23503") {
        return res.status(409).json({
            message:
                "The operation conflicts with related records"
        });
    }

    if (
        error.code === "23514" ||
        error.code === "23502" ||
        error.code === "22P02" ||
        error.code === "22001"
    ) {
        return res.status(400).json({
            message: "Invalid data supplied"
        });
    }

    console.error("Unhandled API error:", error);

    return res.status(500).json({
        message: "Internal server error"
    });
};