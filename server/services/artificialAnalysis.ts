import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { BenchmarkCategory, Category } from '../../shared/categories.js';
import type { BenchmarkInfo, BenchmarkMeta, NormalizedModel } from '../../shared/types.js';
import { config } from '../config.js';

const TTL_MS = 24 * 60 * 60 * 1000;
/** After a failed refresh with stale data available, wait before trying again. */
const RETRY_AFTER_FAIL_MS = 10 * 60 * 1000;
const TOP_N = 15;
// Vercel's filesystem is read-only except /tmp (which only lives as long as the instance).
const CACHE_DIR = process.env.VERCEL
  ? path.join(tmpdir(), 'ai-wijzer-cache')
  : path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'cache');

type EndpointKey = 'llms' | 'text-to-image' | 'image-editing' | 'text-to-video' | 'image-to-video' | 'text-to-speech';

const ENDPOINTS: Record<EndpointKey, string> = {
  llms: '/data/llms/models',
  'text-to-image': '/data/media/text-to-image',
  'image-editing': '/data/media/image-editing',
  'text-to-video': '/data/media/text-to-video',
  'image-to-video': '/data/media/image-to-video',
  'text-to-speech': '/data/media/text-to-speech',
};

const CATEGORY_ENDPOINT: Record<BenchmarkCategory, EndpointKey> = {
  text: 'llms',
  coding: 'llms',
  image: 'text-to-image',
  'image-editing': 'image-editing',
  video: 'text-to-video',
  'image-to-video': 'image-to-video',
  speech: 'text-to-speech',
};

/* ---------- Lenient response schemas (the API shape may gain fields) ---------- */

const creatorSchema = z.object({ id: z.string().optional(), name: z.string().optional() }).nullish();

const llmSchema = z.object({
  id: z.string(),
  name: z.string(),
  model_creator: creatorSchema,
  evaluations: z
    .object({
      artificial_analysis_intelligence_index: z.number().nullish(),
      artificial_analysis_coding_index: z.number().nullish(),
      artificial_analysis_math_index: z.number().nullish(),
    })
    .nullish(),
  pricing: z
    .object({
      price_1m_input_tokens: z.number().nullish(),
      price_1m_output_tokens: z.number().nullish(),
    })
    .nullish(),
  median_output_tokens_per_second: z.number().nullish(),
});

const mediaSchema = z.object({
  id: z.string(),
  name: z.string(),
  model_creator: creatorSchema,
  elo: z.number().nullish(),
});

const envelopeSchema = z.object({ data: z.array(z.unknown()) });

/* ---------- Cache ---------- */

interface CacheEntry {
  fetchedAt: number;
  raw: unknown[];
}

const memory = new Map<EndpointKey, CacheEntry>();
const inFlight = new Map<EndpointKey, Promise<void>>();
const lastFailure = new Map<EndpointKey, number>();

function cacheFile(key: EndpointKey): string {
  return path.join(CACHE_DIR, `${key}.json`);
}

async function loadFromDisk(key: EndpointKey): Promise<void> {
  try {
    const text = await readFile(cacheFile(key), 'utf8');
    const parsed = z.object({ fetchedAt: z.number(), raw: z.array(z.unknown()) }).parse(JSON.parse(text));
    memory.set(key, parsed);
  } catch {
    /* no or unreadable file cache: will be fetched */
  }
}

async function saveToDisk(key: EndpointKey, entry: CacheEntry): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheFile(key), JSON.stringify(entry), 'utf8');
  } catch (err) {
    console.warn(`[aa] Kon cache niet wegschrijven voor ${key}:`, err instanceof Error ? err.message : err);
  }
}

async function fetchEndpoint(key: EndpointKey): Promise<void> {
  const res = await fetch(`${config.aaBaseUrl}${ENDPOINTS[key]}`, {
    headers: { 'x-api-key': config.aaApiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Artificial Analysis gaf HTTP ${res.status} voor ${key}`);
  const body = envelopeSchema.parse(await res.json());
  const entry: CacheEntry = { fetchedAt: Date.now(), raw: body.data };
  memory.set(key, entry);
  lastFailure.delete(key);
  await saveToDisk(key, entry);
  console.log(`[aa] ${key} ververst (${body.data.length} modellen)`);
}

function refresh(key: EndpointKey): Promise<void> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = fetchEndpoint(key)
    .catch((err: unknown) => {
      lastFailure.set(key, Date.now());
      console.warn(`[aa] Verversen van ${key} mislukt:`, err instanceof Error ? err.message : err);
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

function isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return entry !== undefined && Date.now() - entry.fetchedAt < TTL_MS;
}

async function ensureEndpoint(key: EndpointKey): Promise<CacheEntry | undefined> {
  const current = memory.get(key);
  if (isFresh(current)) return current;
  const failedAt = lastFailure.get(key);
  const backoff = current !== undefined && failedAt !== undefined && Date.now() - failedAt < RETRY_AFTER_FAIL_MS;
  if (!backoff) await refresh(key);
  return memory.get(key);
}

/** Load file caches, and refresh anything missing or expired in the background. */
export async function initArtificialAnalysis(): Promise<void> {
  const keys = Object.keys(ENDPOINTS) as EndpointKey[];
  await Promise.all(keys.map(loadFromDisk));
  if (!config.aaApiKey) {
    console.warn('[aa] Geen ARTIFICIAL_ANALYSIS_API_KEY: alleen bestaande cache wordt gebruikt.');
    return;
  }
  for (const key of keys) {
    if (!isFresh(memory.get(key))) void refresh(key);
  }
}

/* ---------- Normalizer ---------- */

function normalizeLlms(raw: unknown[], category: 'text' | 'coding'): NormalizedModel[] {
  const out: NormalizedModel[] = [];
  for (const item of raw) {
    const parsed = llmSchema.safeParse(item);
    if (!parsed.success) continue;
    const m = parsed.data;
    const score =
      category === 'text'
        ? m.evaluations?.artificial_analysis_intelligence_index
        : m.evaluations?.artificial_analysis_coding_index;
    if (score == null) continue;
    const input = m.pricing?.price_1m_input_tokens ?? null;
    const output = m.pricing?.price_1m_output_tokens ?? null;
    out.push({
      id: m.id,
      name: m.name,
      creator: m.model_creator?.name ?? 'onbekend',
      category,
      score,
      scoreType: 'intelligence index',
      pricing: input === null && output === null ? null : { inputPer1M: input, outputPer1M: output },
      speed: m.median_output_tokens_per_second ?? null,
    });
  }
  return out;
}

function normalizeMedia(raw: unknown[], category: BenchmarkCategory): NormalizedModel[] {
  const out: NormalizedModel[] = [];
  for (const item of raw) {
    const parsed = mediaSchema.safeParse(item);
    if (!parsed.success || parsed.data.elo == null) continue;
    const m = parsed.data;
    out.push({
      id: m.id,
      name: m.name,
      creator: m.model_creator?.name ?? 'onbekend',
      category,
      score: m.elo ?? 0,
      scoreType: 'elo',
      pricing: null,
      speed: null,
    });
  }
  return out;
}

function normalize(category: BenchmarkCategory, raw: unknown[]): NormalizedModel[] {
  const models =
    category === 'text' || category === 'coding' ? normalizeLlms(raw, category) : normalizeMedia(raw, category);
  return models.sort((a, b) => b.score - a.score);
}

/* ---------- Public API ---------- */

export interface CategoryData {
  /** All models of the category, best first. */
  models: NormalizedModel[];
  /** Compact top list to send to the model. */
  top: NormalizedModel[];
  meta: BenchmarkMeta;
}

export function hasBenchmarks(category: Category): category is BenchmarkCategory {
  return category !== 'other';
}

export async function getCategoryData(category: Category): Promise<CategoryData> {
  if (!hasBenchmarks(category)) {
    return { models: [], top: [], meta: buildMeta(null, false) };
  }
  const key = CATEGORY_ENDPOINT[category];
  const entry = await ensureEndpoint(key);
  if (!entry) return { models: [], top: [], meta: buildMeta(null, false) };
  const models = normalize(category, entry.raw);
  return {
    models,
    top: models.slice(0, TOP_N),
    meta: buildMeta(entry, models.length > 0),
  };
}

function buildMeta(entry: CacheEntry | null | undefined, available: boolean): BenchmarkMeta {
  return {
    attribution: 'Artificial Analysis',
    attributionUrl: 'https://artificialanalysis.ai/',
    fetchedAt: entry ? new Date(entry.fetchedAt).toISOString() : null,
    stale: entry ? !isFresh(entry) : false,
    available,
  };
}

/** Look up a model by its stable id and compute its rank in the category. */
export function lookupBenchmark(data: CategoryData, modelId: string | null): BenchmarkInfo | null {
  if (!modelId) return null;
  const index = data.models.findIndex((m) => m.id === modelId);
  const model = data.models[index];
  if (!model) return null;
  return {
    modelId: model.id,
    modelName: model.name,
    creator: model.creator,
    score: model.score,
    scoreType: model.scoreType,
    rank: index + 1,
    total: data.models.length,
    category: model.category,
    pricing: model.pricing,
    speed: model.speed,
  };
}

/** Compact JSON for the prompt: short keys, rounded numbers. */
export function toPromptRows(top: NormalizedModel[]): string {
  return JSON.stringify(
    top.map((m, i) => ({
      rank: i + 1,
      id: m.id,
      name: m.name,
      creator: m.creator,
      score: Math.round(m.score * 10) / 10,
      scoreType: m.scoreType,
      ...(m.pricing ? { usdPer1MTokens: { in: m.pricing.inputPer1M, out: m.pricing.outputPer1M } } : {}),
      ...(m.speed !== null ? { tokensPerSecond: Math.round(m.speed) } : {}),
    })),
  );
}
