import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { sendError } from "../utils/response";

interface ValidateOptions {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
}

export function validate(schemas: ValidateOptions) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const errors: Array<{ field: string; message: string }> = [];

        if (schemas.body) {
            const result = schemas.body.safeParse(req.body);
            if (!result.success) {
                errors.push(...formatErrors(result.error));
            } else {
                req.body = result.data;
            }
        }

        if (schemas.query) {
            const result = schemas.query.safeParse(req.query);
            if (!result.success) {
                errors.push(...formatErrors(result.error));
            } else {
                (req as any).query = result.data;
            }
        }

        if (schemas.params) {
            const result = schemas.params.safeParse(req.params);
            if (!result.success) {
                errors.push(...formatErrors(result.error));
            } else {
                req.params = result.data;
            }
        }

        if (errors.length > 0) {
            sendError(res, 400, errors.map((e) => `${e.field}: ${e.message}`).join("; "));
            return;
        }

        next();
    };
}

function formatErrors(error: ZodError): Array<{ field: string; message: string }> {
    return error.errors.map((e) => ({
        field: e.path.join(".") || "unknown",
        message: e.message,
    }));
}
