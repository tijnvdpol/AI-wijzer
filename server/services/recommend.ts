import { createHash } from 'node:crypto';
import type { Category } from '../../shared/categories';
import { classificationSchema, recommendationSchema, type RecommendRequest } from '../../shared/schemas';
import type { RecommendResponse, RecommendationResult } from '../../shared/types';
import { getCategoryData, lookupBenchmark, toPromptRows } from './artificialAnalysis';
import { generateJson, type GroundingSource } from './openai';
import { CLASSIFY_SYSTEM, RECOMMEND_SYSTEM, buildClassifyPrompt, buildRecommendPrompt } from './prompts';

const RESPONSE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHED = 200;
const MAX_SOURCES = 12;

const responseCache = new Map<string, { at: number; result: RecommendationResult }>();

function cacheKey(req: RecommendRequest): string {
  const normalized = {
    q: req.query.trim().toLowerCase().replace(/\s+/g, ' '),
    c: req.clarification,
    s: [...req.settings.subscriptions].sort(),
    cs: req.settings.customSubscriptions.map((s) => s.trim().toLowerCase()).sort(),
    st: req.settings.student,
    b: { mode: req.budget.mode, max: req.budget.mode === 'existing' ? req.budget.maxPerMonth : 0, o: req.budget.preferOneOff },
    p: req.preferences,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function safeUrl(url: string): string {
  return isHttpUrl(url) ? url : '';
}

function normalizeForDedupe(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`.toLowerCase();
  } catch {
    return url;
  }
}

/** Merge sources from the JSON output with those from grounding metadata, deduplicated. */
function mergeSources(fromJson: GroundingSource[], fromGrounding: GroundingSource[]): GroundingSource[] {
  const seen = new Set<string>();
  const merged: GroundingSource[] = [];
  for (const s of [...fromJson, ...fromGrounding]) {
    if (!isHttpUrl(s.url)) continue;
    const key = normalizeForDedupe(s.url);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ title: s.title.trim() || s.url, url: s.url });
    if (merged.length >= MAX_SOURCES) break;
  }
  return merged;
}

export async function recommend(req: RecommendRequest): Promise<RecommendResponse> {
  const key = cacheKey(req);
  const hit = responseCache.get(key);
  if (hit && Date.now() - hit.at < RESPONSE_TTL_MS) {
    console.log('[recommend] antwoord uit cache');
    return { type: 'result', result: { ...hit.result, cached: true } };
  }

  // 1. Cheap classification call (no tools)
  const { data: classification } = await generateJson({
    label: 'classificatie',
    schema: classificationSchema,
    systemInstruction: CLASSIFY_SYSTEM,
    prompt: buildClassifyPrompt(req),
    useTools: false,
    thinking: 'low',
  });
  const category: Category = classification.category;

  if (
    classification.needsClarification &&
    !req.clarification &&
    classification.clarifyingQuestion &&
    classification.clarifyingOptions.length >= 2
  ) {
    return {
      type: 'clarify',
      category,
      question: classification.clarifyingQuestion,
      options: classification.clarifyingOptions.slice(0, 4),
    };
  }

  // 2. Matching Artificial Analysis data from the cache
  const data = await getCategoryData(category);
  const rows = data.top.length > 0 ? toPromptRows(data.top) : null;

  // 3. Main call: OpenAI web search + structured output
  const { data: rec, groundingSources } = await generateJson({
    label: `advies:${category}`,
    schema: recommendationSchema,
    systemInstruction: RECOMMEND_SYSTEM,
    prompt: buildRecommendPrompt(req, category, rows),
    useTools: true,
    thinking: 'default',
  });

  // Attach real benchmark numbers by stable id (the model only picks the id, never the score)
  const withBenchmark = <T extends { benchmarkModelId: string | null; url: string }>(item: T) => ({
    ...item,
    url: safeUrl(item.url),
    benchmark: lookupBenchmark(data, item.benchmarkModelId),
  });

  const result: RecommendationResult = {
    category,
    topPick: withBenchmark(rec.topPick),
    alternatives: rec.alternatives.slice(0, 2).map(withBenchmark),
    existingOption: rec.existingOption
      ? { ...rec.existingOption, benchmark: lookupBenchmark(data, rec.existingOption.benchmarkModelId) }
      : null,
    budgetNote: rec.budgetNote,
    starterPrompt: rec.starterPrompt,
    tip: rec.tip,
    usedBenchmarks: rec.usedBenchmarks && data.meta.available,
    benchmarkNote: data.meta.available
      ? rec.benchmarkNote
      : (rec.benchmarkNote ?? 'Voor dit soort verzoek is geen onafhankelijke benchmarkdata gebruikt; het advies berust op webonderzoek.'),
    sources: mergeSources(rec.sources, groundingSources),
    benchmarkMeta: data.meta,
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  if (responseCache.size >= MAX_CACHED) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(key, { at: Date.now(), result });
  return { type: 'result', result };
}
