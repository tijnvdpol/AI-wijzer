import { useCallback } from 'react';
import { budgetSchema, preferencesSchema, settingsSchema } from '../../../shared/schemas';
import type { Budget, Preferences, Settings } from '../../../shared/schemas';
import type { RecommendationResult } from '../../../shared/types';
import { DEFAULT_BUDGET, DEFAULT_PREFERENCES, DEFAULT_SETTINGS } from '../lib/options';
import { usePersistentState } from '../lib/storage';

const isSettings = (v: unknown): v is Settings => settingsSchema.safeParse(v).success;
const isBudget = (v: unknown): v is Budget => budgetSchema.safeParse(v).success;
const isPreferences = (v: unknown): v is Preferences => preferencesSchema.safeParse(v).success;

export interface HistoryItem {
  id: string;
  query: string;
  at: string;
  result: RecommendationResult;
}

const isHistory = (v: unknown): v is HistoryItem[] =>
  Array.isArray(v) &&
  v.every(
    (i) =>
      typeof i === 'object' &&
      i !== null &&
      typeof (i as HistoryItem).id === 'string' &&
      typeof (i as HistoryItem).query === 'string' &&
      typeof (i as HistoryItem).result === 'object',
  );

const MAX_HISTORY = 20;

export function useSettings() {
  return usePersistentState<Settings>('settings', DEFAULT_SETTINGS, isSettings);
}

export function useBudget() {
  return usePersistentState<Budget>('budget', DEFAULT_BUDGET, isBudget);
}

export function usePreferences() {
  return usePersistentState<Preferences>('preferences', DEFAULT_PREFERENCES, isPreferences);
}

export function useHistory() {
  const [history, setHistory] = usePersistentState<HistoryItem[]>('history', [], isHistory);

  const add = useCallback(
    (query: string, result: RecommendationResult) => {
      const item: HistoryItem = { id: crypto.randomUUID(), query, at: result.generatedAt, result };
      setHistory((prev) => [item, ...prev.filter((h) => h.query !== query)].slice(0, MAX_HISTORY));
    },
    [setHistory],
  );
  const clear = useCallback(() => setHistory([]), [setHistory]);
  return { history, add, clear };
}
