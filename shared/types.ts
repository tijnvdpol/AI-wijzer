import type { BenchmarkCategory, Category } from './categories';
import type { GeminiRecommendation } from './schemas';

export type ScoreType = 'intelligence index' | 'elo';

/** Compact, normalised benchmark entry (one per model). */
export interface NormalizedModel {
  id: string;
  name: string;
  creator: string;
  category: BenchmarkCategory;
  score: number;
  scoreType: ScoreType;
  /** Text models: USD per 1M tokens. Media models: null. */
  pricing: { inputPer1M: number | null; outputPer1M: number | null } | null;
  /** Text models: output tokens/second. Media models: null. */
  speed: number | null;
}

export interface BenchmarkInfo {
  modelId: string;
  modelName: string;
  creator: string;
  score: number;
  scoreType: ScoreType;
  rank: number;
  total: number;
  category: BenchmarkCategory;
  pricing: NormalizedModel['pricing'];
  speed: number | null;
}

export interface BenchmarkMeta {
  attribution: 'Artificial Analysis';
  attributionUrl: 'https://artificialanalysis.ai/';
  /** ISO timestamp of the cached data used. */
  fetchedAt: string | null;
  stale: boolean;
  available: boolean;
}

type WithBenchmark<T> = T & { benchmark: BenchmarkInfo | null };

export type ToolResult = WithBenchmark<GeminiRecommendation['topPick']>;
export type AlternativeResult = WithBenchmark<GeminiRecommendation['alternatives'][number]>;
export type ExistingResult = WithBenchmark<NonNullable<GeminiRecommendation['existingOption']>>;

export interface RecommendationResult {
  category: Category;
  topPick: ToolResult;
  alternatives: AlternativeResult[];
  existingOption: ExistingResult | null;
  budgetNote: string | null;
  starterPrompt: string;
  tip: string;
  usedBenchmarks: boolean;
  benchmarkNote: string | null;
  sources: { title: string; url: string }[];
  benchmarkMeta: BenchmarkMeta;
  generatedAt: string;
  cached: boolean;
}

export type RecommendResponse =
  | { type: 'clarify'; category: Category; question: string; options: string[] }
  | { type: 'result'; result: RecommendationResult };

export interface ApiError {
  error: string;
  code?: 'rate_limited' | 'invalid_request' | 'upstream' | 'invalid_response' | 'timeout' | 'server';
}
