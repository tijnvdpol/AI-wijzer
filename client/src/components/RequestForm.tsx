import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import type { Preferences } from '../../../shared/schemas';
import { EXAMPLES } from '../lib/options';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  preferences: Preferences;
  onPreferencesChange: (p: Preferences) => void;
  onSubmit: () => void;
  disabled: boolean;
}

const LEVELS: { value: NonNullable<Preferences['level']>; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'gevorderd', label: 'Gevorderd' },
  { value: 'expert', label: 'Expert' },
];
const PRIORITIES: { value: NonNullable<Preferences['priority']>; label: string }[] = [
  { value: 'kwaliteit', label: 'Kwaliteit' },
  { value: 'snelheid', label: 'Snelheid' },
  { value: 'gebruiksgemak', label: 'Gebruiksgemak' },
  { value: 'privacy', label: 'Privacy' },
];

function Segmented<T extends string>(props: {
  legend: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{props.legend} <span className="font-normal text-slate-400">(optioneel)</span></legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => {
          const on = props.value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => props.onChange(on ? null : o.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                on
                  ? 'border-accent-500 bg-accent-600 text-white'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function RequestForm({ query, onQueryChange, preferences, onPreferencesChange, onSubmit, disabled }: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled && query.trim().length >= 3) onSubmit();
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="query" className="mb-2 block text-xl font-semibold">
          Wat wil je maken?
        </label>
        <textarea
          id="query"
          className="input min-h-[7rem] resize-y text-lg"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          maxLength={1500}
          placeholder="Beschrijf zo concreet mogelijk wat je wilt maken…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => onQueryChange(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Segmented
          legend="Ervaringsniveau"
          options={LEVELS}
          value={preferences.level}
          onChange={(level) => onPreferencesChange({ ...preferences, level })}
        />
        <Segmented
          legend="Wat vind je het belangrijkst?"
          options={PRIORITIES}
          value={preferences.priority}
          onChange={(priority) => onPreferencesChange({ ...preferences, priority })}
        />
      </div>

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={disabled || query.trim().length < 3}>
        <Search className="h-5 w-5" aria-hidden /> Vind de beste tool
      </button>
    </form>
  );
}
