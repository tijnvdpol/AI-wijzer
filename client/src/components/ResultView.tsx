import { AlertCircle, Check, ChevronDown, Copy, Lightbulb, RotateCcw, Wallet } from 'lucide-react';
import { useState } from 'react';
import { CATEGORY_LABELS } from '../../../shared/categories';
import type { BenchmarkInfo, RecommendationResult } from '../../../shared/types';
import { CATEGORY_ICONS } from '../lib/categories';
import { AlternativeCard, BenchmarkBlock, SpeedHint, TopPickCard, formatScore } from './ToolCards';

function formatDate(iso: string | null): string {
  if (!iso) return 'onbekend';
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function priceText(b: BenchmarkInfo | null): string {
  if (!b?.pricing) return '–';
  const { inputPer1M, outputPer1M } = b.pricing;
  if (inputPer1M === null && outputPer1M === null) return '–';
  return `$${inputPer1M ?? '?'} in / $${outputPer1M ?? '?'} uit per 1M tokens`;
}

function StarterPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: text stays selectable */
    }
  };
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Startprompt</h3>
        <button type="button" className="btn-ghost" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Gekopieerd' : 'Kopieer'}
        </button>
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60">{text}</pre>
    </section>
  );
}

function ComparisonTable({ result }: { result: RecommendationResult }) {
  const [open, setOpen] = useState(false);
  const rows = [result.topPick, ...result.alternatives];
  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between font-semibold"
      >
        Vergelijkingstabel
        <ChevronDown className={`h-5 w-5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Tool</th>
                <th className="py-2 pr-4 font-medium">Modelscore</th>
                <th className="py-2 pr-4 font-medium">Kosten voor jou</th>
                <th className="py-2 pr-4 font-medium">API-prijs model</th>
                <th className="py-2 font-medium">Snelheid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.name} className="border-t border-slate-200 align-top dark:border-slate-800">
                  <td className="py-2 pr-4 font-medium">{t.name}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {t.benchmark ? `${formatScore(t.benchmark)} · #${t.benchmark.rank}` : '–'}
                  </td>
                  <td className="py-2 pr-4">
                    {t.cost.type === 'included'
                      ? 'In je abonnement'
                      : t.cost.type === 'free'
                        ? 'Gratis'
                        : t.cost.monthlyEuro !== null
                          ? `ca. €${t.cost.monthlyEuro}`
                          : 'Betaald'}
                  </td>
                  <td className="py-2 pr-4">{priceText(t.benchmark)}</td>
                  <td className="py-2">{t.benchmark?.speed != null ? <SpeedHint speed={t.benchmark.speed} /> : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ResultView({ result, onNew }: { result: RecommendationResult; onNew: () => void }) {
  const Icon = CATEGORY_ICONS[result.category];
  const meta = result.benchmarkMeta;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-accent-50 px-4 py-2 text-sm font-medium text-accent-700 dark:bg-accent-700/20 dark:text-accent-200">
          <Icon className="h-4 w-4" aria-hidden /> {CATEGORY_LABELS[result.category]}
        </p>
        <button type="button" className="btn-ghost" onClick={onNew}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Nieuwe vraag
        </button>
      </div>

      {meta.stale && meta.available && (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          De benchmarkdata is mogelijk verouderd (laatst opgehaald op {formatDate(meta.fetchedAt)}).
        </p>
      )}
      {!result.usedBenchmarks && (
        <p className="flex items-start gap-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {result.benchmarkNote ?? 'Er is geen onafhankelijke benchmarkdata gebruikt; dit advies berust op webonderzoek.'}
        </p>
      )}

      <TopPickCard tool={result.topPick} />

      {result.existingOption && (
        <section className="card space-y-2 border-emerald-200 dark:border-emerald-900">
          <h3 className="flex items-center gap-2 font-semibold">
            <Wallet className="h-5 w-5 text-emerald-600" aria-hidden /> Wat je al hebt
          </h3>
          <p>
            <strong>{result.existingOption.name}</strong>{' '}
            <span className="text-slate-500 dark:text-slate-400">(via {result.existingOption.subscription})</span>
          </p>
          <p className="text-slate-700 dark:text-slate-300">{result.existingOption.qualityDifference}</p>
          {result.existingOption.benchmark && <BenchmarkBlock benchmark={result.existingOption.benchmark} />}
        </section>
      )}

      {result.budgetNote && (
        <p className="flex items-start gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {result.budgetNote}
        </p>
      )}

      {result.alternatives.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Alternatieven</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {result.alternatives.map((a) => (
              <AlternativeCard key={a.name} tool={a} />
            ))}
          </div>
        </section>
      )}

      <ComparisonTable result={result} />
      <StarterPrompt text={result.starterPrompt} />

      <p className="flex items-start gap-2 rounded-2xl bg-accent-50 p-4 text-sm dark:bg-accent-700/20">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden />
        <span>
          <strong>Tip:</strong> {result.tip}
        </span>
      </p>

      {result.sources.length > 0 && (
        <section className="card">
          <h3 className="mb-2 font-semibold">Bronnen</h3>
          <ul className="space-y-1 text-sm">
            {result.sources.map((s) => (
              <li key={s.url} className="truncate">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-600 underline-offset-2 hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Benchmarkdata:{' '}
        <a href={meta.attributionUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Artificial Analysis
        </a>
        {meta.available ? ` (data van ${formatDate(meta.fetchedAt)})` : ' (voor dit verzoek niet gebruikt)'}.{' '}
        Advies gegenereerd op {formatDate(result.generatedAt)}
        {result.cached ? ' (uit cache)' : ''}. Controleer prijzen altijd op de website van de aanbieder.
      </p>
    </div>
  );
}
