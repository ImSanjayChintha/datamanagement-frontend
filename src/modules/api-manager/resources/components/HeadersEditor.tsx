import { Plus, X } from 'lucide-react';
import type { HeaderEntry } from '@/types/apiBridge';

interface Props {
  headers:  HeaderEntry[];
  onChange: (headers: HeaderEntry[]) => void;
}

export default function HeadersEditor({ headers, onChange }: Props) {
  function add() {
    onChange([...headers, { key: '', value: '' }]);
  }

  function remove(index: number) {
    onChange(headers.filter((_, i) => i !== index));
  }

  function update(index: number, field: 'key' | 'value', value: string) {
    onChange(headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  }

  return (
    <div className="space-y-2">
      {headers.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No headers configured.</p>
      ) : (
        <div className="space-y-1.5">
          {/* Column labels */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Header Name</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Value</span>
            <span />
          </div>

          {headers.map((h, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <input
                className="input text-sm py-1.5 font-mono"
                value={h.key}
                placeholder="Content-Type"
                onChange={e => update(i, 'key', e.target.value)}
              />
              <input
                className="input text-sm py-1.5 font-mono"
                value={h.value}
                placeholder="application/json"
                onChange={e => update(i, 'value', e.target.value)}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-1"
      >
        <Plus size={13} />
        Add header
      </button>
    </div>
  );
}
