import { FIELD_TYPES, type FieldType } from '@/types/toolkit';

interface Props {
  value: FieldType;
  onChange: (v: FieldType) => void;
  className?: string;
}

/**
 * Dropdown for selecting a toolkit field type, grouped by category.
 * Extracted so it can be reused in AI generation and field editors alike.
 */
export default function FieldTypeSelect({ value, onChange, className }: Props) {
  const groups = FIELD_TYPES.reduce<Record<string, typeof FIELD_TYPES>>((acc, ft) => {
    (acc[ft.group] ??= []).push(ft);
    return acc;
  }, {});

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as FieldType)}
      className={className ?? 'input text-xs h-8'}
    >
      {Object.entries(groups).map(([group, items]) => (
        <optgroup key={group} label={group}>
          {items.map(ft => (
            <option key={ft.value} value={ft.value}>
              {ft.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
