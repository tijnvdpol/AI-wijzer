import { History, Trash2 } from 'lucide-react';
import { CATEGORY_LABELS } from '../../../shared/categories';
import type { HistoryItem } from '../hooks/useAppState';
import { CATEGORY_ICONS } from '../lib/categories';

interface Props {
  history: HistoryItem[];
  onOpen: (item: HistoryItem) => void;
  onClear: () => void;
}

export function HistoryList({ history, onOpen, onClear }: Props) {
  if (history.length === 0) return null;
  return (
    <section className="card" aria-labelledby="history-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="history-title" className="flex items-center gap-2 font-semibold">
          <History className="h-5 w-5 text-accent-600" aria-hidden /> Eerdere vragen
        </h2>
        <button type="button" className="btn-ghost" onClick={onClear}>
          <Trash2 className="h-4 w-4" aria-hidden /> Wissen
        </button>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {history.map((h) => {
          const Icon = CATEGORY_ICONS[h.result.category];
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => onOpen(h)}
                className="flex w-full items-center gap-3 py-3 text-left hover:text-accent-600"
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <span className="flex-1 truncate">{h.query}</span>
                <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">
                  {h.result.topPick.name} · {CATEGORY_LABELS[h.result.category].split(' ')[0]}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
