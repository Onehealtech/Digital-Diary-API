// src/middleware/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Op } from 'sequelize';

// Import Models
import { AppUser, AppUser as AppUserModel } from '../models/Appuser';

// Import Utils
import { responseMiddleware } from '../utils/response';
import { HTTP_STATUS, API_MESSAGES, UserRole } from '../utils/constants';

// -------------------------------------------------------------------------
// TYPE DEFINITIONS
// -------------------------------------------------------------------------

// Extends Express Request to include the AppUser object (for authenticated routes)
export interface AuthenticatedRequest extends Request {
  user?: AppUser | any;
}

// Custom Request interface for specific logic (like role checks)
export interface CustomRequest extends Request {
  user?: AppUser;
  rCode?: number;
  rStatus?: boolean;
  msg?: string;
  rData?: any;
}

// -------------------------------------------------------------------------
// MIDDLEWARE LOGIC
// -------------------------------------------------------------------------

/**
 * Protect Middleware
 * Verifies JWT token and attaches AppUser to request
 */


/**
 * Role Check Middleware
 * Verifies if the authenticated AppUser has permission to access the route
 * Uses UserRole enum for type-safe role checking
 */
export const authCheck = (allowedRoles: UserRole[]) => {
  return async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {

    const token = req.headers["authorization"]?.split(" ")[1];

    if (!token) {
      responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, API_MESSAGES.UNAUTHORIZED);
      return;
    }

    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);
      // Build the query dynamically to avoid 'undefined' errors
      const whereClause: any = { id: decoded.AppUserId || decoded.id };

      // Only add email check if it exists in token
      if (decoded.email) {
        whereClause.email = decoded.email;
      }

      const user: any = await AppUser.findOne({
        where: whereClause,
        raw: true
      });

      // Check if user exists and has allowed role
      if (user && allowedRoles.includes(user.role as UserRole)) {
        res.locals.auth = decoded;
        req.user = user;
        next();
      } else {
        responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, API_MESSAGES.UNAUTHORIZED);
        return;
      }

    } catch (error) {
      console.error('Auth Check Error:', error);
      responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, API_MESSAGES.UNAUTHORIZED);
      return;
    }
  };
};

/**
 * Patient Auth Check Middleware
 * Verifies JWT token for patient routes
 */
export const patientAuthCheck = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, "Authentication required");
    return;
  }

  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

    // Verify this is a patient token
    if (decoded.type !== "PATIENT") {
      responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, "Invalid patient token");
      return;
    }

    // Attach patient info to request
    req.user = {
      id: decoded.id,
      diaryId: decoded.diaryId,
      fullName: decoded.fullName,
      type: decoded.type,
    } as any;

    next();
  } catch (error) {
    console.error('Patient Auth Check Error:', error);
    responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, "Invalid or expired token");
    return;
  }
};