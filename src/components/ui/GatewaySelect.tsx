import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/core/api';
import { toStr } from '@/lib/formatting';
import type { ToolkitField } from '@/types/toolkit';

interface GatewayOption { value: string; label: string }

interface Props {
  field:     ToolkitField;
  value:     unknown;
  onChange:  (v: unknown) => void;
  required?: boolean;
  multiple?: boolean;
}

// Label fallback order when the configured display_field is missing from the row
const LABEL_FALLBACKS = ['name_i18n', 'name', 'label', 'title', 'description'];

function resolveLabel(row: Record<string, unknown>, displayField: string, valueField: string): string {
  // Try the configured field first
  const primary = row[displayField];
  if (primary != null) return toStr(primary) ?? String(row[valueField] ?? '');
  // Fall back through common column names (handles multilingual name_i18n objects too)
  for (const key of LABEL_FALLBACKS) {
    if (key !== displayField && row[key] != null) {
      const v = toStr(row[key]);
      if (v) return v;
    }
  }
  return String(row[valueField] ?? '');
}

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const obj = data as Record<string, unknown>;
  // handle {rows:[...]} and {data:{rows:[...]}} shapes
  const inner = obj.data ?? obj;
  const candidate = (inner as Record<string, unknown>).rows ?? inner;
  return Array.isArray(candidate) ? (candidate as Record<string, unknown>[]) : [];
}

export default function GatewaySelect({ field, value, onChange, required, multiple }: Props) {
  const endpoint   = field.config?.gateway_endpoint as string;
  const valueField = field.store_field   ?? 'code';
  const labelField = field.display_field ?? 'name';

  const { data: options = [] } = useQuery<GatewayOption[]>({
    // include valueField/labelField so the query reruns if store_field/display_field changes
    queryKey:  ['gateway-opts', endpoint, valueField, labelField],
    enabled:   !!endpoint,
    staleTime: 5 * 60_000,
    queryFn:   async () => {
      // endpoint may be: DB url_path (/gateway/foo/list), /run/-prefixed, or plain code (foo)
      const url = endpoint.startsWith('/run/')
        ? endpoint
        : endpoint.startsWith('/')
          ? `/run${endpoint}`
          : `/run/gateway/${endpoint}/list`;
      const res  = await apiClient.post<unknown>(url, { filters: {}, limit: 500, offset: 0 });
      const rows = extractRows(res.data);
      return rows.map(r => ({
        value: String(r[valueField] ?? ''),
        label: resolveLabel(r, labelField, valueField),
      })).filter(o => o.value !== '');
    },
  });

  if (multiple) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <select
        className="input"
        multiple
        value={selected}
        size={Math.min(Math.max(options.length, 3), 8)}
        onChange={e => onChange(Array.from(e.target.selectedOptions, o => o.value))}
        required={required && selected.length === 0}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  return (
    <select
      className="input"
      value={value != null && value !== '' ? String(value) : ''}
      onChange={e => onChange(e.target.value || null)}
      required={required}
    >
      <option value="">— Select —</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
