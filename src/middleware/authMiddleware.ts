// src/middleware/authMiddleware.ts

import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Op } from 'sequelize';

// Import Models
import { AppUser, AppUser as AppUserModel } from '../models/Appuser';
import { Patient } from '../models/Patient';

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

// Alias for AuthRequest (used in controllers)
export interface AuthRequest extends AuthenticatedRequest {}

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

      if (!user) {
        responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, API_MESSAGES.UNAUTHORIZED);
        return;
      }

      // User exists but role doesn't match → 403 Forbidden (not 401)
      // This distinction is critical: 401 = bad/expired token (triggers auto-logout),
      // 403 = valid token but insufficient permissions (no logout needed).
      if (!allowedRoles.includes(user.role as UserRole)) {
        responseMiddleware(res, HTTP_STATUS.FORBIDDEN, API_MESSAGES.FORBIDDEN);
        return;
      }

      // Force logout ON_HOLD or DELETED assistants
      if (user.role === 'ASSISTANT') {
        if (user.assistantStatus === 'ON_HOLD') {
          responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, 'Your account is temporarily on hold. Contact your Doctor.');
          return;
        }
        if (user.assistantStatus === 'DELETED') {
          responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, 'Your account has been archived. Please contact your doctor.');
          return;
        }
      }

      res.locals.auth = decoded;
      req.user = user;
      next();

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

    // Check if patient is still active in DB (force logout for deactivated patients)
    const patient = await Patient.findByPk(decoded.id, {
      attributes: ["id", "status"],
    });

    if (!patient || patient.status === "INACTIVE") {
      responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, "Your account has been deactivated. Please contact your doctor.");
      return;
    }

    // Attach patient info to request
    req.user = {
      id: decoded.id,
      diaryId: decoded.diaryId,
      fullName: decoded.fullName,
      caseType: decoded.caseType,
      type: decoded.type,
    } as any;

    next();
  } catch (error) {
    console.error('Patient Auth Check Error:', error);
    responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, "Invalid or expired token");
    return;
  }
};