import type { ToolkitField, ToolkitFieldOption } from '@/types/toolkit';
import TranslationInput from '@/components/ui/TranslationInput';
import ReferenceSelect from '@/components/ui/ReferenceSelect';
import GatewaySelect from '@/components/ui/GatewaySelect';

// Returns true if `v` is a non-empty object whose keys are ISO language codes
// and whose values are all strings — i.e. {"en": "...", "es": "..."}
function isMultilingualJson(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return false;
  return keys.every(k => /^[a-z]{2,3}(-[A-Z]{2})?$/.test(k) && typeof obj[k] === 'string');
}

interface Props {
  field:        ToolkitField;
  value:        unknown;
  onChange:     (v: unknown) => void;
  fieldOptions?: ToolkitFieldOption[];
  alwaysOpen?:  boolean;
}

export default function DynamicFieldInput({ field, value, onChange, fieldOptions, alwaysOpen }: Props) {
  const str = value != null ? String(value) : '';

  // Any non-jsonb field marked multilingual gets a translation input
  if (field.is_multilingual && field.field_type !== 'jsonb') {
    return (
      <TranslationInput
        fieldCode={field.code}
        label={field.label}
        value={(value as Record<string, string>) ?? {}}
        onChange={onChange}
        required={field.is_required}
        alwaysOpen={alwaysOpen}
      />
    );
  }

  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          className="input min-h-[100px]"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
        />
      );

    case 'richtext':
      return (
        <textarea
          className="input min-h-[200px] font-mono text-sm"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          placeholder="HTML content"
        />
      );

    case 'toggle': {
      const trueLabel  = (field.config?.true_label  as string) || 'Yes';
      const falseLabel = (field.config?.false_label as string) || 'No';
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={!!value}
              onChange={e => onChange(e.target.checked)}
            />
            <div className={`w-10 h-5 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
          </div>
          <span className="text-sm text-gray-600">{value ? trueLabel : falseLabel}</span>
        </label>
      );
    }

    case 'inline_select': {
      if (field.config?.gateway_endpoint) {
        return (
          <GatewaySelect
            field={field}
            value={value}
            onChange={onChange}
            required={field.is_required}
          />
        );
      }
      const opts =
        (fieldOptions && fieldOptions.length > 0)
          ? fieldOptions
          : (field.config?.options as { code: string; label: string }[]) ?? [];
      return (
        <select
          className="input"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
        >
          <option value="">— Select —</option>
          {opts.map(o => (
            <option key={o.code} value={o.code}>
              {(o as ToolkitFieldOption).label_i18n?.['en'] || o.label || o.code}
            </option>
          ))}
        </select>
      );
    }

    case 'select':
      if (field.config?.gateway_endpoint) {
        return (
          <GatewaySelect
            field={field}
            value={value}
            onChange={onChange}
            required={field.is_required}
          />
        );
      }
      return (
        <ReferenceSelect
          field={field}
          value={(value as string | null) ?? null}
          onChange={onChange}
          required={field.is_required}
        />
      );

    case 'multiselect':
      if (field.config?.gateway_endpoint) {
        return (
          <GatewaySelect
            field={field}
            value={value}
            onChange={onChange}
            required={field.is_required}
            multiple
          />
        );
      }
      return (
        <ReferenceSelect
          field={field}
          value={(value as string | string[] | null) ?? null}
          onChange={onChange}
          required={field.is_required}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          className="input"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
        />
      );

    case 'datetime':
      return (
        <input
          type="datetime-local"
          className="input"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
        />
      );

    case 'time':
      return (
        <input
          type="time"
          className="input"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
        />
      );

    case 'integer':
      return (
        <input
          type="number"
          step="1"
          className="input"
          value={str}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
          required={field.is_required}
        />
      );

    case 'decimal':
    case 'currency':
    case 'percentage':
      return (
        <input
          type="number"
          step="any"
          className="input"
          value={str}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
          required={field.is_required}
        />
      );

    case 'email':
      return (
        <input
          type="email"
          className="input"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
        />
      );

    case 'url':
      return (
        <input
          type="url"
          className="input"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
        />
      );

    case 'color':
      return (
        <div className="flex items-center gap-3">
          <input
            type="color"
            className="h-9 w-16 rounded cursor-pointer border border-gray-200"
            value={str || '#000000'}
            onChange={e => onChange(e.target.value)}
          />
          <input
            type="text"
            className="input flex-1 font-mono"
            value={str}
            onChange={e => onChange(e.target.value)}
            placeholder="#000000"
          />
        </div>
      );

    case 'jsonb':
      if (field.is_multilingual || isMultilingualJson(value)) {
        return (
          <TranslationInput
            fieldCode={field.code}
            label={field.label}
            value={(value && typeof value === 'object' && !Array.isArray(value)
              ? value as Record<string, string>
              : {})}
            onChange={onChange}
            required={field.is_required}
            alwaysOpen={alwaysOpen}
          />
        );
      }
      return (
        <textarea
          className="input min-h-[120px] font-mono text-xs"
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : str}
          onChange={e => {
            try { onChange(JSON.parse(e.target.value)); }
            catch { onChange(e.target.value); }
          }}
          required={field.is_required}
        />
      );

    case 'json':
      return (
        <textarea
          className="input min-h-[120px] font-mono text-xs"
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : str}
          onChange={e => {
            try { onChange(JSON.parse(e.target.value)); }
            catch { onChange(e.target.value); }
          }}
          required={field.is_required}
        />
      );

    case 'computed':
    case 'sequence':
      return (
        <input
          className="input bg-gray-50 text-gray-400 cursor-not-allowed"
          value={str || 'Auto-generated'}
          readOnly
        />
      );

    default:
      return (
        <input
          type="text"
          className="input"
          value={str}
          onChange={e => onChange(e.target.value)}
          required={field.is_required}
          placeholder={field.default_value ?? ''}
        />
      );
  }
}
