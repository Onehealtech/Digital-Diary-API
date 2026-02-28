import { DiaryTemplate, TemplateJson, TemplatePage } from "../models/DiaryTemplate";

/**
 * Upload / create a new diary template.
 * Precomputes totalFields and totalPages from the JSON.
 */
export const createTemplate = async (params: {
    templateData: TemplateJson;
    templateType: string;
    createdBy: string;
}) => {
    const { templateData, templateType,  createdBy } = params;

    // Validate structure
    if (!templateData.code) throw new Error("Template must have a code");
    if (!templateData.document_title) throw new Error("Template must have a document_title");
    if (!templateData.pages || !Array.isArray(templateData.pages) || templateData.pages.length === 0) {
        throw new Error("Template must have at least one page");
    }

    // Check duplicate code
    const existing = await DiaryTemplate.findOne({ where: { code: templateData.code } });
    if (existing) throw new Error(`Template with code "${templateData.code}" already exists`);

    // Precompute stats
    const totalPages = templateData.pages.length;
    const totalFields = templateData.pages.reduce((sum, page) => sum + countFieldsInPage(page), 0);

    const template = await DiaryTemplate.create({
        code: templateType,
        title: templateData.document_title,
        titleHindi: templateData.document_title_hindi || null,
        templateData,
        totalFields,
        totalPages,
        version: 1,
        isActive: true,
        createdBy,
    } as any);

    return template;
};

/**
 * Get all active templates (for dropdown when assigning diaries)
 */
export const listTemplates = async () => {
    return DiaryTemplate.findAll({
        where: { isActive: true },
        attributes: ["id", "code", "title", "titleHindi", "totalPages", "totalFields", "version", "createdAt"],
        order: [["createdAt", "DESC"]],
    });
};

/**
 * Get a single template with full JSON
 */
export const getTemplate = async (templateType: any) => {
    const template = await DiaryTemplate.findOne({ where: { code: templateType } });
    if (!template) throw new Error("Template not found");
    return template;
};

/**
 * Get template by code
 */
export const getTemplateByCode = async (code: string) => {
    const template = await DiaryTemplate.findOne({ where: { code } });
    if (!template) throw new Error(`Template "${code}" not found`);
    return template;
};

/**
 * Update a template (creates new version)
 */
export const updateTemplate = async (params: {
    templateId: any;
    templateData: TemplateJson;
    updatedBy: string;
}) => {
    const template = await DiaryTemplate.findByPk(params.templateId);
    if (!template) throw new Error("Template not found");

    const totalPages = params.templateData.pages.length;
    const totalFields = params.templateData.pages.reduce(
        (sum, page) => sum + countFieldsInPage(page), 0
    );

    template.templateData = params.templateData;
    template.title = params.templateData.document_title;
    template.titleHindi = params.templateData.document_title_hindi || null;
    template.totalPages = totalPages;
    template.totalFields = totalFields;
    template.version = template.version + 1;
    await template.save();

    return template;
};

/**
 * Deactivate a template (soft delete)
 */
export const deactivateTemplate = async (templateId: any) => {
    const template = await DiaryTemplate.findByPk(templateId);
    if (!template) throw new Error("Template not found");
    template.isActive = false;
    await template.save();
    return template;
};

// ─── Helper ────────────────────────────────────────────────────────

function countFieldsInPage(page: TemplatePage): number {
    let count = 0;

    if (page.fields) {
        for (const f of page.fields) {
            if (f.sub_fields) {
                count += Object.keys(f.sub_fields).length;
            } else if (f.options) {
                count += 1;
            }
        }
    }

    if (page.sections) {
        for (const sec of page.sections) {
            if (sec.fields) {
                for (const f of sec.fields) {
                    if (f.sub_fields) {
                        count += Object.keys(f.sub_fields).length;
                    } else if (f.options) {
                        count += 1;
                    }
                }
            }
            if (sec.field_name && sec.options) count += 1;
        }
    }

    return count;
}