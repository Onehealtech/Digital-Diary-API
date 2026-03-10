"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const response_1 = require("../utils/response");
function validate(schemas) {
    return (req, res, next) => {
        const errors = [];
        if (schemas.body) {
            const result = schemas.body.safeParse(req.body);
            if (!result.success) {
                errors.push(...formatErrors(result.error));
            }
            else {
                req.body = result.data;
            }
        }
        if (schemas.query) {
            const result = schemas.query.safeParse(req.query);
            if (!result.success) {
                errors.push(...formatErrors(result.error));
            }
            else {
                // Express 5: req.query is read-only, store parsed data on res.locals
                res.locals.validatedQuery = result.data;
            }
        }
        if (schemas.params) {
            const result = schemas.params.safeParse(req.params);
            if (!result.success) {
                errors.push(...formatErrors(result.error));
            }
            else {
                // Express 5: req.params is read-only, store parsed data on res.locals
                res.locals.validatedParams = result.data;
            }
        }
        if (errors.length > 0) {
            (0, response_1.sendError)(res, 400, errors.map((e) => `${e.field}: ${e.message}`).join("; "));
            return;
        }
        next();
    };
}
exports.validate = validate;
function formatErrors(error) {
    return error.errors.map((e) => ({
        field: e.path.join(".") || "unknown",
        message: e.message,
    }));
}
