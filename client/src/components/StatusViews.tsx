import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LOADING_MESSAGES } from '../lib/options';

export function LoadingMessages() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, LOADING_MESSAGES.length - 1)), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="card flex items-center gap-4" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 shrink-0 animate-spin text-accent-600" aria-hidden />
      <div>
        <p className="font-medium">{LOADING_MESSAGES[i]}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Dit duurt meestal 10 tot 30 seconden.</p>
      </div>
    </div>
  );
}

export function ClarifyQuestion(props: { question: string; options: string[]; onAnswer: (answer: string) => void }) {
  const [free, setFree] = useState('');
  return (
    <div className="card space-y-4">
      <p className="flex items-start gap-2 text-lg font-semibold">
        <HelpCircle className="mt-1 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
        {props.question}
      </p>
      <div className="flex flex-wrap gap-2">
        {props.options.map((o) => (
          <button key={o} type="button" className="chip" onClick={() => props.onAnswer(o)}>
            {o}
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (free.trim()) props.onAnswer(free.trim());
        }}
      >
        <input
          className="input py-2"
          value={free}
          onChange={(e) => setFree(e.target.value)}
          placeholder="Of typ zelf een antwoord…"
          maxLength={400}
          aria-label="Eigen antwoord"
        />
        <button type="submit" className="btn-ghost shrink-0" disabled={!free.trim()}>
          Verstuur
        </button>
      </form>
    </div>
  );
}

export function ErrorBanner(props: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200 sm:flex-row sm:items-center"
    >
      <AlertTriangle className="h-6 w-6 shrink-0" aria-hidden />
      <p className="flex-1">{props.message}</p>
      <button type="button" className="btn-ghost" onClick={props.onRetry}>
        Opnieuw proberen
      </button>
    </div>
  );
}
