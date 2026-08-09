import type { FieldType } from '@/types/toolkit';

export type I18nMap = Record<string, string>;

export interface FieldOption {
  _optKey: string;
  code: string;
  label: string;
  labelI18n: I18nMap;
}

export interface FieldRef {
  ref_table_code: string;
  ref_table_id: number | null;
  store_field: string;
  display_field: string;
}

export interface ToggleLabels {
  true_label: string;
  false_label: string;
  trueLabelI18n: I18nMap;
  falseLabelI18n: I18nMap;
}

export interface FieldDraft {
  _key: string;
  code: string;
  label: string;
  labelI18n: I18nMap;
  description: string;
  descriptionI18n: I18nMap;
  field_type: FieldType;
  is_required: boolean;
  is_unique: boolean;
  is_multilingual: boolean;
  is_system: boolean;
  options: FieldOption[];
  ref: FieldRef | null;
  toggleLabels: ToggleLabels;
  default_value: string;
  expression: string;
  gateway_endpoint: string;
  show_in_list: boolean;
}

export interface TableForm {
  code: string;
  description: string;
  schema_name: string;
}

export function newOption(): FieldOption {
  return { _optKey: Math.random().toString(36).slice(2), code: '', label: '', labelI18n: {} };
}

export function newField(): FieldDraft {
  return {
    _key: Math.random().toString(36).slice(2),
    code: '', label: '', labelI18n: {},
    description: '', descriptionI18n: {},
    field_type: 'text',
    is_required: false, is_unique: false, is_multilingual: false, is_system: false,
    options: [], ref: null,
    toggleLabels: { true_label: '', false_label: '', trueLabelI18n: {}, falseLabelI18n: {} },
    default_value: '',
    expression: '',
    gateway_endpoint: '',
    show_in_list: true,
  };
}
