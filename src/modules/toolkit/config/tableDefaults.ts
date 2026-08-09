import type { FieldType } from '@/types/toolkit';

export interface DefaultField {
  code: string;
  field_type: FieldType;
  label: string;
  description: string;
  is_required: boolean;
  is_unique: boolean;
  show_translation?: boolean;
  default_value?: string;
  true_label?: string;
  false_label?: string;
}

export const DEFAULT_FIELDS: DefaultField[] = [
  {
    code:             'id',
    field_type:       'id',
    label:            'Id',
    description:      'Auto-increment primary key',
    is_required:      true,
    is_unique:        true,
    show_translation: false,
  },
  {
    code:             'code',
    field_type:       'text',
    label:            'Code',
    description:      'Unique identifier code',
    is_required:      true,
    is_unique:        true,
    show_translation: false,
  },
  {
    code:             'sort_order',
    field_type:       'sequence',
    label:            'Sort Order',
    description:      'Display sort order',
    is_required:      false,
    is_unique:        false,
    show_translation: false,
    default_value:    '0',
  },
  {
    code:             'inserted_at',
    field_type:       'datetime',
    label:            'Created At',
    description:      'Record creation timestamp',
    is_required:      false,
    is_unique:        false,
    show_translation: false,
  },
  {
    code:             'inserted_by',
    field_type:       'text',
    label:            'Created By',
    description:      'Who created this record',
    is_required:      false,
    is_unique:        false,
    show_translation: false,
  },
  {
    code:             'modified_at',
    field_type:       'datetime',
    label:            'Modified At',
    description:      'Record last modified timestamp',
    is_required:      false,
    is_unique:        false,
    show_translation: false,
  },
  {
    code:             'modified_by',
    field_type:       'text',
    label:            'Modified By',
    description:      'Who last modified this record',
    is_required:      false,
    is_unique:        false,
    show_translation: false,
  },
];

export const KEY_FIELDS  = DEFAULT_FIELDS.filter(f => ['id', 'code'].includes(f.code));
export const LOG_FIELDS  = DEFAULT_FIELDS.filter(f => ['sort_order', 'inserted_at', 'inserted_by', 'modified_at', 'modified_by'].includes(f.code));

// Codes that are part of the standard table scaffold (shown as locked rows in the designer)
export const DEFAULT_FIELD_CODES = new Set(DEFAULT_FIELDS.map(f => f.code));

// Codes auto-created by the backend on every table — must not be sent in the save payload
// but should still appear in the Translation tab (e.g. 'label' is a translation column)
export const BACKEND_MANAGED_FIELD_CODES = new Set(['label']);
