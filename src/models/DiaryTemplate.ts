// src/models/DiaryTemplate.ts

import {
  Table, Column, Model, DataType, PrimaryKey, Default,
  CreatedAt, UpdatedAt, HasMany, Unique,
} from "sequelize-typescript";
import { Diary } from "./Diary";

// ─── TypeScript interfaces for the JSON structure ──────────────────

export interface TemplateField {
  field_name: string;
  field_name_hindi: string;
  options?: string[];
  format?: string;
  sub_fields?: Record<string, string[]>;
}

export interface TemplateSection {
  section_name?: string;
  section_name_hindi?: string;
  field_name?: string;
  field_name_hindi?: string;
  options?: string[];
  fields?: TemplateField[];
}

export interface TemplatePage {
  page_no: string;
  main_heading: string;
  main_heading_hindi: string;
  page_type: string;
  filled_by?: string;
  fields?: TemplateField[];
  sections?: TemplateSection[];
  report_placeholder?: string;
  additional_info?: string;
}

export interface TemplateJson {
  document_title: string;
  document_title_hindi: string;
  code: string;
  pages: TemplatePage[];
}

// ─── Model ─────────────────────────────────────────────────────────

@Table({ tableName: "diary_templates", timestamps: true })
export class DiaryTemplate extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  // Human-readable code: "CANTrac-A001", "CANTrac-B002", etc.
  @Unique
  @Column({ type: DataType.STRING(50), allowNull: false })
  code!: string;

  // English title
  @Column({ type: DataType.STRING(255), allowNull: false })
  title!: string;

  // Hindi title
  @Column({ type: DataType.STRING(255), allowNull: true })
  titleHindi!: string | null;

  // The full JSON template — read-only after creation
  @Column({ type: DataType.JSONB, allowNull: false })
  templateData!: TemplateJson;

  // Total answerable fields (precomputed on upload for quick progress calc)
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  totalFields!: number;

  // Total pages
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  totalPages!: number;

  // Version — increment when template is updated
  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 1 })
  version!: number;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true })
  isActive!: boolean;

  // Who uploaded it
  @Column({ type: DataType.UUID, allowNull: true })
  createdBy!: string | null;

  @HasMany(() => Diary)
  diaries!: Diary[];

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}