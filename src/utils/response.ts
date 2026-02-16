import { Response } from 'express';

/**
 * Standardized response utility
 * Used to send consistent JSON responses across the application
 */
export const responseMiddleware = (
  res: Response,
  statusCode: number,
  message: string,
  data: any = null
) => {
  return res.status(statusCode).json({
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
  });
};

/**
 * Send success response
 * Overloaded to support multiple signatures
 */
export const sendResponse = (
  res: Response,
  statusCodeOrData: number | any,
  messageOrUndefined?: string,
  dataOrUndefined?: any
) => {
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
    const statusCode = (dataOrUndefined as number) || 200;
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }
};

/**
 * Send error response
 * Overloaded to support multiple signatures
 */
export const sendError = (
  res: Response,
  statusCodeOrMessage: number | string,
  messageOrStatusCode?: string | number,
  errorOrUndefined?: any
) => {
  // If first arg is a number, it's: (res, statusCode, message, error?)
  if (typeof statusCodeOrMessage === 'number') {
    const statusCode = statusCodeOrMessage;
    const message = (messageOrStatusCode as string) || 'Error';
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