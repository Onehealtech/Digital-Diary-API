import { Response, NextFunction } from 'express';
import { CustomRequest } from './authMiddleware';
import { responseMiddleware } from '../utils/response';
import { HTTP_STATUS, API_MESSAGES, UserRole } from '../utils/constants';

type PermissionKey = 'viewPatients' | 'callPatients' | 'exportData' | 'sendNotifications' | 'deactivatePatients';

/**
 * Middleware factory that checks a specific permission for ASSISTANT users.
 * DOCTOR, SUPER_ADMIN, and VENDOR bypass this check entirely.
 * Must be used AFTER authCheck in the middleware chain.
 */
export const requirePermission = (permission: PermissionKey) => {
  return (req: CustomRequest, res: Response, next: NextFunction): void => {
    const user = req.user as any;

    if (!user) {
      responseMiddleware(res, HTTP_STATUS.UNAUTHORIZED, API_MESSAGES.UNAUTHORIZED);
      return;
    }

    // Non-ASSISTANT roles bypass permission checks
    if (user.role !== UserRole.ASSISTANT) {
      next();
      return;
    }

    // ASSISTANT: check granular permission
    const permissions = user.permissions || {};
    if (permissions[permission] === true) {
      next();
      return;
    }

    responseMiddleware(res, HTTP_STATUS.FORBIDDEN, API_MESSAGES.FORBIDDEN);
    return;
  };
};
