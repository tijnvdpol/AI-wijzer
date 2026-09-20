import { BarChart3, Check, ExternalLink, Gauge, Info, ThumbsDown, ThumbsUp } from 'lucide-react';
import { CATEGORY_SHORT } from '../../../shared/categories';
import type { AlternativeResult, BenchmarkInfo, ToolResult } from '../../../shared/types';

type Cost = ToolResult['cost'];

export function CostBadge({ cost }: { cost: Cost }) {
  const base = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium';
  if (cost.type === 'included')
    return (
      <span className={`${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200`}>
        <Check className="h-4 w-4" aria-hidden /> Zit in je abonnement
      </span>
    );
  if (cost.type === 'free')
    return <span className={`${base} bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200`}>Gratis</span>;
  return (
    <span className={`${base} bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200`}>
      Extra kosten: {cost.monthlyEuro !== null ? `ca. €${Math.round(cost.monthlyEuro * 100) / 100}` : 'onbekend'}
    </span>
  );
}

export function formatScore(b: BenchmarkInfo): string {
  return b.scoreType === 'elo' ? `${Math.round(b.score)} Elo` : `${b.score.toFixed(1)} (index)`;
}

export function BenchmarkBlock({ benchmark }: { benchmark: BenchmarkInfo }) {
  // Position within the category: 100% = best model, 0% = last.
  const percentile = benchmark.total > 1 ? ((benchmark.total - benchmark.rank) / (benchmark.total - 1)) * 100 : 100;
  return (
    <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-accent-600" aria-hidden />
          #{benchmark.rank} van {benchmark.total} in {CATEGORY_SHORT[benchmark.category]}
        </p>
        <p className="text-sm tabular-nums text-slate-600 dark:text-slate-300">{formatScore(benchmark)}</p>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="img"
        aria-label={`Positie ${benchmark.rank} van ${benchmark.total}`}
      >
        <div className="h-full rounded-full bg-accent-500" style={{ width: `${Math.max(4, percentile)}%` }} />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Modelbenchmark van Artificial Analysis voor het onderliggende model ({benchmark.modelName}, {benchmark.creator}),
        niet voor de app zelf.
      </p>
    </div>
  );
}

function LinkButton({ url, name }: { url: string; name: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost">
      Naar {name} <ExternalLink className="h-4 w-4" aria-hidden />
    </a>
  );
}

function List({ items, icon, tone }: { items: string[]; icon: 'up' | 'down'; tone: string }) {
  const Icon = icon === 'up' ? ThumbsUp : ThumbsDown;
  return (
    <ul className="space-y-1.5 text-sm">
      {items.map((s) => (
        <li key={s} className="flex items-start gap-2">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

export function TopPickCard({ tool }: { tool: ToolResult }) {
  return (
    <article className="card space-y-5 border-accent-200 shadow-md dark:border-accent-700/50 sm:p-7">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Beste keuze</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold sm:text-3xl">{tool.name}</h2>
          <CostBadge cost={tool.cost} />
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Door {tool.maker} · Niveau: {tool.difficulty}
        </p>
        <p className="text-lg font-medium">{tool.verdict}</p>
      </header>

      <p className="text-sm text-slate-600 dark:text-slate-300">{tool.cost.detail}</p>
      {tool.benchmark && <BenchmarkBlock benchmark={tool.benchmark} />}

      <section>
        <h3 className="mb-1 font-semibold">Waarom dit past</h3>
        <p className="text-slate-700 dark:text-slate-300">{tool.whyItFits}</p>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <section>
          <h3 className="mb-2 font-semibold">Sterke punten</h3>
          <List items={tool.strengths} icon="up" tone="text-emerald-600" />
        </section>
        <section>
          <h3 className="mb-2 font-semibold">Beperkingen</h3>
          <List items={tool.limitations} icon="down" tone="text-amber-600" />
        </section>
      </div>

      <LinkButton url={tool.url} name={tool.name} />
    </article>
  );
}

export function AlternativeCard({ tool }: { tool: AlternativeResult }) {
  return (
    <article className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{tool.name}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Door {tool.maker}</p>
        </div>
        <CostBadge cost={tool.cost} />
      </div>
      <p className="text-slate-700 dark:text-slate-300">{tool.chooseIf}</p>
      <p className="text-sm text-slate-600 dark:text-slate-300">{tool.cost.detail}</p>
      {tool.benchmark && <BenchmarkBlock benchmark={tool.benchmark} />}
      <div className="mt-auto">
        <LinkButton url={tool.url} name={tool.name} />
      </div>
    </article>
  );
}

export function SpeedHint({ speed }: { speed: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Gauge className="h-3.5 w-3.5" aria-hidden />
      {Math.round(speed)} tok/s
    </span>
  );
}
