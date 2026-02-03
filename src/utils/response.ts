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