export interface ToolkitSchema {
  id: number;
  name: string;
  label?: string | null;
  description?: string | null;
  table_count: number;
  tables?: ToolkitTable[];
}

export interface ToolkitTable {
  id: number;
  code: string;
  schema_name: string;
  label: string;
  description: string | null;
  icon: string | null;
  is_system: boolean;
  has_label: boolean;
  is_active: boolean;
  sort_order: number;
  custom_field_count: number;
  field_count: number;
  inserted_at: string;
}

export interface ToolkitField {
  id: number;
  table_id: number;
  table_code: string;
  code: string;
  label: string;
  description: string;
  field_type: FieldType;
  is_required: boolean;
  is_unique: boolean;
  is_multilingual: boolean;
  is_system: boolean;
  config: Record<string, unknown>;
  default_value: string | null;
  sort_order: number;
  is_active: boolean;
  // reference info — direct columns on toolkit_fields
  ref_table_code: string | null;
  store_field:    string | null;
  display_field:  string | null;
  ref_type:       'single' | 'multiple' | null;
  // resolved via view join on toolkit_tables
  ref_table_id:    number | null;
  ref_table_label: string | null;
}

export interface ToolkitFieldOption {
  id: number;
  field_id: number;
  code: string;
  label: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  label_i18n: Record<string, string>;
}

export interface ToolkitTableDetail extends ToolkitTable {
  fields: ToolkitField[];
  options: ToolkitFieldOption[];
}

// ── Page Definitions ──────────────────────────────────────────────────────────

export interface PageDefColumn {
  code:       string;
  visible:    boolean;
  order:      number;
  label?:     string;    // display override for list column header; empty = use toolkit field label
  bindkey?:   string;    // if set, read row data from row[bindkey] instead of row[code]
  filter_op?: string;    // filter operator: 'eq' | 'ilike' | 'gte' | 'lte' — absent = not filterable
}

export interface PageDefField {
  code:          string;
  order:         number;
  visible?:      boolean;
  label?:        string;  // display override for form field label; empty = use toolkit field label
  ref_endpoint?: string;
  multilingual?: boolean;  // override is_multilingual when toolkit metadata lacks it
  bindkey?:      string;   // if set, read/write record data from/to record[bindkey] instead of code
  add_mode?:           'enabled' | 'disabled';
  edit_mode?:          'enabled' | 'disabled';
  required?:           boolean;
  validation_message?: Record<string, string>;
  component_type?:     string;
}

export interface PageDefListConfig {
  columns:         PageDefColumn[];
  static_filters?: Record<string, unknown>;
  sort_fields?:    { field: string; direction: 'asc' | 'desc' }[];
  default_limit?:  number;
  max_limit?:      number;
}

export interface PageDefFormConfig {
  fields: PageDefField[];
}

export interface PageDef {
  id:              number;
  code:            string;
  title:           string;
  description:     string | null;
  icon:            string | null;
  table_code:      string;
  gateway_object:  string;
  id_type:         'string' | 'number';
  nav_section:     string;
  nav_label:       string | null;
  nav_order:       number;
  list_config:     PageDefListConfig;
  form_config:     PageDefFormConfig;
  is_active:       boolean;
  sort_order:      number;
  list_endpoint:   string;
  upsert_endpoint: string;
  delete_endpoint: string;
  export_endpoint: string;
  inserted_at:     string;
  modified_at:     string | null;
}

export interface DdlLogEntry {
  id: number;
  table_code: string | null;
  operation: string;
  sql_executed: string;
  success: boolean;
  error_msg: string | null;
  executed_by: string | null;
  executed_at: string;
}

export type { TranslationMap, LangOption } from './shared';

export type FieldType =
  | 'id'
  | 'text' | 'textarea' | 'richtext' | 'slug' | 'email' | 'phone' | 'url' | 'color'
  | 'file' | 'image' | 'integer' | 'decimal' | 'currency' | 'percentage'
  | 'date' | 'datetime' | 'time' | 'daterange'
  | 'toggle' | 'json' | 'jsonb' | 'text_array'
  | 'inline_select' | 'select' | 'multiselect'
  | 'sequence' | 'uuid' | 'computed';

import fieldTypeDefs from '@/modules/toolkit/tables/field-types.json';

export const FIELD_TYPES = fieldTypeDefs as { value: FieldType; label: string; group: string; translatable?: boolean }[];

export const TRANSLATABLE_FIELD_TYPES = new Set(
  FIELD_TYPES.filter(ft => ft.translatable).map(ft => ft.value)
);
