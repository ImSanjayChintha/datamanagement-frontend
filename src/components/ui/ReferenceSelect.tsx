import { useQuery } from '@tanstack/react-query';
import { toolkitRefsApi } from '@/modules/toolkit/core/api';
import type { ToolkitField } from '@/types/toolkit';

interface Props {
  field:     ToolkitField;
  value:     string | string[] | null;
  onChange:  (v: string | string[] | null) => void;
  required?: boolean;
}

export default function ReferenceSelect({ field, value, onChange, required }: Props) {
  const isMulti = field.ref_type === 'multiple';

  const { data: options = [] } = useQuery({
    queryKey:  ['ref-opts', field.id],
    queryFn:   () => toolkitRefsApi.options(field.id),
    staleTime: 5 * 60_000,
  });

  if (isMulti) {
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
      value={(value as string) ?? ''}
      onChange={e => onChange(e.target.value || null)}
      required={required}
    >
      <option value="">— Select —</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
