"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendResponse = exports.responseMiddleware = void 0;
/**
 * Standardized response utility
 * Used to send consistent JSON responses across the application
 */
const responseMiddleware = (res, statusCode, message, data = null) => {
    return res.status(statusCode).json({
        success: statusCode >= 200 && statusCode < 300,
        message,
        data,
    });
};
exports.responseMiddleware = responseMiddleware;
/**
 * Send success response
 * Overloaded to support multiple signatures
 */
const sendResponse = (res, statusCodeOrData, messageOrUndefined, dataOrUndefined) => {
    // If first arg is a number, it's: (res, statusCode, message, data)
    if (typeof statusCodeOrData === 'number') {
        const statusCode = statusCodeOrData;
        const message = messageOrUndefined || 'Success';
        const data = dataOrUndefined;
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    }
    // Otherwise it's: (res, data, message, statusCode?)
    else {
        const data = statusCodeOrData;
        const message = messageOrUndefined || 'Success';
        const statusCode = dataOrUndefined || 200;
        return res.status(statusCode).json({
            success: true,
            message,
            data,
        });
    }
};
exports.sendResponse = sendResponse;
/**
 * Send error response
 * Overloaded to support multiple signatures
 */
const sendError = (res, statusCodeOrMessage, messageOrStatusCode, errorOrUndefined) => {
    // If first arg is a number, it's: (res, statusCode, message, error?)
    if (typeof statusCodeOrMessage === 'number') {
        const statusCode = statusCodeOrMessage;
        const message = messageOrStatusCode || 'Error';
        const error = errorOrUndefined;
        return res.status(statusCode).json({
            success: false,
            message,
            error,
        });
    }
    // Otherwise it's: (res, message, statusCode?, error?)
    else {
        const message = statusCodeOrMessage;
        const statusCode = (typeof messageOrStatusCode === 'number' ? messageOrStatusCode : 500);
        const error = errorOrUndefined;
        return res.status(statusCode).json({
            success: false,
            message,
            error,
        });
    }
};
exports.sendError = sendError;
