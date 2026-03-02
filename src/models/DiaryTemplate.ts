import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  CreatedAt, UpdatedAt, HasMany, Unique,
} from "sequelize-typescript";
import { Diary } from "./Diary";

// ─── TypeScript interfaces ────────────────────────────────────────────────────

/** A leaf input field — present in both flat fields[] and section fields[] */
export interface TemplateField {
  field_name:        string;
  field_name_hindi?: string;
  options?:          string[];
  format?:           string;
  sub_fields?:       Record<string, string[]>;
  answer_type?:      string;          // "text" for TOC free-text fields
  answer_placeholder?: string;
  // ↓ Stamped at sell-time for pages 02–37 (null in master template)
  question_no?:      string | null;   // e.g. "S1Q2"
  answer?:           string | null;
}

/** A section inside a page — may contain fields[], or itself be a bare field */
export interface TemplateSection {
  section_name?:        string;
  section_name_hindi?:  string;
  // Bare section-level field (e.g. "Next Appointment Required")
  field_name?:          string;
  field_name_hindi?:    string;
  options?:             string[];
  fields?:              TemplateField[];
  // ↓ Stamped at sell-time when this section IS a bare field
  question_no?:         string | null;
  answer?:              string | null;
}

/** TOC entry (page 01 only) */
export interface TocField {
  page_ref:           string;         // links to page_no on another page
  field_name:         string;
  field_name_hindi?:  string;
  answer_type:        "text";
  answer_placeholder?: string;
  // No question_no / answer on TOC
}

export interface TemplatePage {
  page_no:             string;
  main_heading:        string;
  main_heading_hindi?: string;
  page_type?:          string;
  filled_by?:          string;
  report_placeholder?: string;
  additional_info?:    string;
  fields?:             TemplateField[] | TocField[];
  sections?:           TemplateSection[];
}

export interface TemplateJson {
  document_title:        string;
  document_title_hindi?: string;
  code:                  string;
  pages:                 TemplatePage[];
}

// ─── Sequelize model ──────────────────────────────────────────────────────────

@Table({ tableName: "diary_templates", timestamps: true })
export class DiaryTemplate extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Unique
  @Column({ type: DataType.STRING(50), allowNull: false })
  code!: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  title!: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  titleHindi!: string | null;

  /** Master template JSON — never contains answers, question_no is always null here */
  @Column({ type: DataType.JSONB, allowNull: false })
  templateData!: TemplateJson;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  totalFields!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  totalPages!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  version!: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  isActive!: boolean;

  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string | null;

  @HasMany(() => Diary)
  diaries!: Diary[];

   createdAt!: Date;
   updatedAt!: Date;
}