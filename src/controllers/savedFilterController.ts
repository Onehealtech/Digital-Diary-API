import { Request, Response } from "express";
import { savedFilterService } from "../service/savedFilterService";
import { logActivity } from "../utils/activityLogger";

interface CustomRequest extends Request {
  user?: { id: string; role: string; fullName?: string };
}

// ── Create ────────────────────────────────────────────────────────
export const createSavedFilter = async (req: CustomRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;

    const filter = await savedFilterService.createFilter(userId, role, req.body);

    logActivity({ req, userId, userRole: role, action: "SAVED_FILTER_CREATED", details: { filterId: filter.id, name: filter.name } });

    res.status(201).json({ success: true, data: filter });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ success: false, message: e.message ?? "Internal server error" });
  }
};

// ── List (role-aware) ─────────────────────────────────────────────
export const getSavedFilters = async (req: CustomRequest, res: Response) => {
  try {
    const filters = await savedFilterService.getFiltersForUser(req.user!.id, req.user!.role);
    res.json({ success: true, data: filters });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ success: false, message: e.message ?? "Internal server error" });
  }
};

// ── Single ────────────────────────────────────────────────────────
export const getSavedFilterById = async (req: CustomRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const filter = await savedFilterService.getFilterById(id, req.user!.id, req.user!.role);
    res.json({ success: true, data: filter });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ success: false, message: e.message ?? "Internal server error" });
  }
};

// ── Update ────────────────────────────────────────────────────────
export const updateSavedFilter = async (req: CustomRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const filter = await savedFilterService.updateFilter(id, req.user!.id, req.user!.role, req.body);

    logActivity({ req, userId: req.user!.id, userRole: req.user!.role, action: "SAVED_FILTER_UPDATED", details: { filterId: id } });

    res.json({ success: true, data: filter });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ success: false, message: e.message ?? "Internal server error" });
  }
};

// ── Delete ────────────────────────────────────────────────────────
export const deleteSavedFilter = async (req: CustomRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await savedFilterService.deleteFilter(id, req.user!.id, req.user!.role);

    logActivity({ req, userId: req.user!.id, userRole: req.user!.role, action: "SAVED_FILTER_DELETED", details: { filterId: id } });

    res.json({ success: true, message: "Filter deleted successfully" });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ success: false, message: e.message ?? "Internal server error" });
  }
};

// ── Assign (Super Admin only) ─────────────────────────────────────
export const assignSavedFilter = async (req: CustomRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const filter = await savedFilterService.assignFilter(id, req.body, req.user!.id);

    logActivity({ req, userId: req.user!.id, userRole: req.user!.role, action: "SAVED_FILTER_ASSIGNED", details: { filterId: id, doctorIds: req.body.doctorIds } });

    res.json({ success: true, data: filter });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ success: false, message: e.message ?? "Internal server error" });
  }
};

// ── Apply (returns filterConfig, increments usage) ────────────────
export const applySavedFilter = async (req: CustomRequest, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await savedFilterService.applyFilter(id, req.user!.id, req.user!.role);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ success: false, message: e.message ?? "Internal server error" });
  }
};

// ── Admin: all filters ────────────────────────────────────────────
export const getAllFiltersAdmin = async (req: CustomRequest, res: Response) => {
  try {
    const filters = await savedFilterService.getAllFiltersAdmin();
    res.json({ success: true, data: filters });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ success: false, message: e.message ?? "Internal server error" });
  }
};
