import { Response, NextFunction } from 'express';
import { CustomRequest } from './authMiddleware';
import { responseMiddleware } from '../utils/response';
import { HTTP_STATUS, API_MESSAGES, UserRole } from '../utils/constants';

type PermissionKey = 'viewPatients' | 'callPatients' | 'exportData' | 'sendNotifications' | 'deactivatePatients' | 'sellDiary' | 'manageOnboardingRequests';

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
    // Sequelize raw: true may return JSONB as string — parse if needed
    console.log(`[Permission] Checking '${permission}' for assistant ${user.id}, raw permissions:`, typeof user.permissions, user.permissions);
    let permissions = user.permissions || {};
    if (typeof permissions === 'string') {
      try { permissions = JSON.parse(permissions); } catch { permissions = {}; }
    }
    if (permissions[permission] === true) {
      next();
      return;
    }

    responseMiddleware(res, HTTP_STATUS.FORBIDDEN, API_MESSAGES.FORBIDDEN);
    return;
  };
};
