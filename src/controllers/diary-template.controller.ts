import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/authMiddleware";
import { createTemplate, deactivateTemplate, getTemplate, listTemplates, updateTemplate } from "../service/diary-template.service";

export const uploadTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { templateData, templateType, templateTitle } = req.body;

    if (!templateData) {
      res.status(400).json({ success: false, message: "templateData (the JSON object) is required" });
      return;
    }

    const template = await createTemplate({
      templateData,
      templateType,
      createdBy: req.user!.id,
    });

    res.status(201).json({
      success: true,
      message: `Template "${template.code}" created with ${template.totalPages} pages and ${template.totalFields} fields`,
      data: {
        id: template.id,
        code: templateType,
        title: templateTitle,
        totalPages: template.totalPages,
        totalFields: template.totalFields,
        version: template.version,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAllTemplates = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const templates = await listTemplates();
    res.json({ success: true, data: templates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSingleTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { templateType } = req.params;
    const template = await getTemplate(templateType);
    res.json({ success: true, data: template });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
};

export const editTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { templateId } = req.params;
    const { templateData } = req.body;

    if (!templateData) {
      res.status(400).json({ success: false, message: "templateData is required" });
      return;
    }

    const template = await updateTemplate({
      templateId,
      templateData,
      updatedBy: req.user!.id,
    });

    res.json({
      success: true,
      message: `Template updated to version ${template.version}`,
      data: {
        id: template.id,
        code: template.code,
        version: template.version,
        totalPages: template.totalPages,
        totalFields: template.totalFields,
      },
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const removeTemplate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { templateId } = req.params;
    await deactivateTemplate(templateId);
    res.json({ success: true, message: "Template deactivated" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};