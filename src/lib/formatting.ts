import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';

/** Extract a display string from a value that may be a multilingual JSONB object or array. */
export function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    const first = toStr(v[0]);
    return v.length > 1 ? `${first ?? ''}  +${v.length - 1}` : first;
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    // Multilingual object {en: "...", es: "..."}
    const enVal = obj['en'];
    if (enVal && typeof enVal === 'string') return enVal;
    // Option object {label_i18n: {en: "..."}, label: "..."}
    const li = obj['label_i18n'];
    if (li && typeof li === 'object' && !Array.isArray(li)) {
      const liObj = li as Record<string, unknown>;
      const liVal = liObj['en'] ?? liObj[Object.keys(liObj)[0]];
      if (liVal) return String(liVal);
    }
    const label = obj['label'];
    if (label && typeof label === 'string') return label;
    // Generic: first key's value
    const firstKey = Object.keys(obj)[0];
    const firstVal = firstKey !== undefined ? obj[firstKey] : undefined;
    return firstVal != null ? String(firstVal) : null;
  }
  return String(v);
}

export const DISPLAY_TYPES = new Set<string>([
  'text', 'textarea', 'integer', 'decimal', 'toggle', 'inline_select',
  'select', 'date', 'datetime', 'email', 'phone', 'url', 'slug',
  'currency', 'percentage', 'sequence',
]);

export function cellValue(
  row: Record<string, unknown>,
  field: ToolkitField,
  options?: ToolkitFieldOption[],
): string {
  const v = row[field.code];
  if (v === null || v === undefined) return '—';
  if (field.field_type === 'toggle') {
    const trueLabel  = (field.config?.true_label  as string) || 'Yes';
    const falseLabel = (field.config?.false_label as string) || 'No';
    return v ? trueLabel : falseLabel;
  }
  if (field.field_type === 'inline_select' && options?.length) {
    const opt = options.find(o => o.code === String(v));
    return opt?.label ?? String(v);
  }
  return String(v);
}
