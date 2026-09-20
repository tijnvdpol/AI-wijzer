import { ChevronDown, Plus, Settings2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { Settings } from '../../../shared/schemas';
import { SUBSCRIPTION_GROUPS } from '../lib/options';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
}

export function SubscriptionsPanel({ settings, onChange }: Props) {
  const count = settings.subscriptions.length + settings.customSubscriptions.length;
  const [open, setOpen] = useState(count === 0);
  const [custom, setCustom] = useState('');

  const toggle = (name: string) =>
    onChange({
      ...settings,
      subscriptions: settings.subscriptions.includes(name)
        ? settings.subscriptions.filter((s) => s !== name)
        : [...settings.subscriptions, name],
    });

  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    const value = custom.trim().slice(0, 80);
    if (!value || settings.customSubscriptions.includes(value)) return;
    onChange({ ...settings, customSubscriptions: [...settings.customSubscriptions, value] });
    setCustom('');
  };

  return (
    <section className="card" aria-labelledby="subs-title">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-accent-600" aria-hidden />
          <span id="subs-title" className="font-semibold">
            Mijn abonnementen
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {count === 0
              ? '– nog niets ingesteld'
              : `– ${count} ${count === 1 ? 'abonnement' : 'abonnementen'} ingesteld${settings.student ? ', student' : ''}`}
          </span>
        </span>
        <span className="flex items-center gap-1 text-sm font-medium text-accent-600">
          {open ? 'Sluiten' : 'Wijzigen'}
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>

      {open && (
        <div className="mt-5 space-y-5">
          {SUBSCRIPTION_GROUPS.map((group) => (
            <fieldset key={group.title}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {group.title}
              </legend>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const on = settings.subscriptions.includes(item);
                  return (
                    <label
                      key={item}
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                        on
                          ? 'border-accent-500 bg-accent-50 text-accent-700 dark:bg-accent-700/20 dark:text-accent-200'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(item)} className="accent-accent-600" />
                      {item}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Ander abonnement toevoegen
            </p>
            <form onSubmit={addCustom} className="flex gap-2">
              <input
                className="input py-2"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Bijv. Jasper, Descript, …"
                maxLength={80}
                aria-label="Ander abonnement"
              />
              <button type="submit" className="btn-ghost shrink-0" disabled={!custom.trim()}>
                <Plus className="h-4 w-4" aria-hidden /> Toevoegen
              </button>
            </form>
            {settings.customSubscriptions.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {settings.customSubscriptions.map((c) => (
                  <li
                    key={c}
                    className="flex items-center gap-1 rounded-full bg-accent-50 py-1 pl-3 pr-1 text-sm text-accent-700 dark:bg-accent-700/20 dark:text-accent-200"
                  >
                    {c}
                    <button
                      type="button"
                      aria-label={`${c} verwijderen`}
                      className="rounded-full p-1 hover:bg-accent-100 dark:hover:bg-accent-700/40"
                      onClick={() =>
                        onChange({ ...settings, customSubscriptions: settings.customSubscriptions.filter((x) => x !== c) })
                      }
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={settings.student}
              onChange={(e) => onChange({ ...settings, student: e.target.checked })}
              className="h-4 w-4 accent-accent-600"
            />
            Ik heb een studentenaccount/onderwijslicentie
          </label>
        </div>
      )}
    </section>
  );
}
