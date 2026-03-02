import { DiaryTemplate, TemplateJson, TemplatePage, TemplateField, TemplateSection } from "../models/DiaryTemplate";

const TOC_PAGE      = "01";
const SKIP_TYPES    = new Set(["informational", "notice"]);

// ─── Field counter ────────────────────────────────────────────────────────────

/**
 * Count answerable fields in a page.
 * Rules:
 *  - Page 01 (TOC) and informational/notice pages → 0
 *  - Date field with sub_fields → count each sub-part (DD, MM, YY) as 1 each
 *  - Option field → 1
 *  - Text / answer_type field → 1
 *  - Bare section-level field_name with options → 1
 */
function countFieldsInPage(page: TemplatePage): number {
  if (page.page_no === TOC_PAGE) return 0;
  if (SKIP_TYPES.has(page.page_type ?? "")) return 0;

  let count = 0;

  const countField = (f: TemplateField) => {
    if (f.sub_fields)       count += Object.keys(f.sub_fields).length;
    else if (f.options)     count += 1;
    else if (f.answer_type) count += 1;   // text fields (TOC rows won't reach here)
  };

  const countSection = (sec: TemplateSection) => {
    if (sec.fields) sec.fields.forEach(countField);
    if (sec.field_name && sec.options) count += 1;   // bare section field
  };

  if (page.fields)   (page.fields as TemplateField[]).forEach(countField);
  if (page.sections) page.sections.forEach(countSection);

  return count;
}

// ─── Service functions ────────────────────────────────────────────────────────

export const createTemplate = async (params: {
  templateData: TemplateJson;
  templateType: string;
  createdBy:    string;
}) => {
  const { templateData, templateType, createdBy } = params;

  if (!templateData.code)          throw new Error("Template must have a code");
  if (!templateData.document_title) throw new Error("Template must have a document_title");
  if (!Array.isArray(templateData.pages) || templateData.pages.length === 0)
    throw new Error("Template must have at least one page");

  const existing = await DiaryTemplate.findOne({ where: { code: templateType } });
  if (existing) throw new Error(`Template with code "${templateType}" already exists`);

  const totalPages  = templateData.pages.length;
  const totalFields = templateData.pages.reduce((sum, p) => sum + countFieldsInPage(p), 0);

  return DiaryTemplate.create({
    code:         templateType,
    title:        templateData.document_title,
    titleHindi:   templateData.document_title_hindi ?? null,
    templateData,
    totalFields,
    totalPages,
    version:      1,
    isActive:     true,
    createdBy,
  } as any);
};

export const listTemplates = async () => {
  return DiaryTemplate.findAll({
    where:      { isActive: true },
    attributes: ["id", "code", "title", "titleHindi", "totalPages", "totalFields", "version", "createdAt"],
    order:      [["createdAt", "DESC"]],
  });
};

export const getTemplate = async (templateType: any) => {
  const t = await DiaryTemplate.findOne({ where: { code: templateType } });
  if (!t) throw new Error("Template not found");
  return t;
};

export const getTemplateByCode = async (code: string) => {
  const t = await DiaryTemplate.findOne({ where: { code } });
  if (!t) throw new Error(`Template "${code}" not found`);
  return t;
};

export const updateTemplate = async (params: {
  templateId:   any;
  templateData: TemplateJson;
  updatedBy:    string;
}) => {
  const t = await DiaryTemplate.findByPk(params.templateId);
  if (!t) throw new Error("Template not found");

  t.templateData = params.templateData;
  t.title        = params.templateData.document_title;
  t.titleHindi   = params.templateData.document_title_hindi ?? null;
  t.totalPages   = params.templateData.pages.length;
  t.totalFields  = params.templateData.pages.reduce((sum, p) => sum + countFieldsInPage(p), 0);
  t.version      = t.version + 1;
  await t.save();
  return t;
};

export const deactivateTemplate = async (templateId: any) => {
  const t = await DiaryTemplate.findByPk(templateId);
  if (!t) throw new Error("Template not found");
  t.isActive = false;
  await t.save();
  return t;
};