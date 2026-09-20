import type { Budget } from '../../../shared/schemas';

interface Props {
  budget: Budget;
  onChange: (next: Budget) => void;
}

const OPTIONS: { mode: Budget['mode']; title: string }[] = [
  { mode: 'free', title: 'Alleen gratis' },
  { mode: 'existing', title: 'Wat ik al heb, maar betalen mag als het echt beter is' },
  { mode: 'unlimited', title: 'Budget maakt niet uit' },
];

export function BudgetPicker({ budget, onChange }: Props) {
  return (
    <fieldset>
      <legend className="label">Budget voor dit project</legend>
      <div className="space-y-2">
        {OPTIONS.map((o) => (
          <label
            key={o.mode}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
              budget.mode === o.mode
                ? 'border-accent-500 bg-accent-50 dark:bg-accent-700/20'
                : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
            }`}
          >
            <input
              type="radio"
              name="budget"
              checked={budget.mode === o.mode}
              onChange={() => onChange({ ...budget, mode: o.mode })}
              className="mt-0.5 accent-accent-600"
            />
            <span className="flex-1">
              {o.title}
              {o.mode === 'free' && (
                <span className="block text-slate-500 dark:text-slate-400">
                  Gratis tools, gratis versies of je bestaande abonnementen.
                </span>
              )}
              {o.mode === 'existing' && budget.mode === 'existing' && (
                <span className="mt-3 block">
                  <span className="mb-1 flex justify-between text-slate-600 dark:text-slate-300">
                    <label htmlFor="max-budget">Maximaal per maand</label>
                    <strong>€{budget.maxPerMonth}</strong>
                  </span>
                  <input
                    id="max-budget"
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={budget.maxPerMonth}
                    onChange={(e) => onChange({ ...budget, maxPerMonth: Number(e.target.value) })}
                    className="w-full accent-accent-600"
                  />
                  <span className="flex justify-between text-xs text-slate-400">
                    <span>€0</span>
                    <span>€50</span>
                  </span>
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={budget.preferOneOff}
          onChange={(e) => onChange({ ...budget, preferOneOff: e.target.checked })}
          className="h-4 w-4 accent-accent-600"
        />
        Liever eenmalig betalen/pay-per-use dan een nieuw abonnement
      </label>
    </fieldset>
  );
}
