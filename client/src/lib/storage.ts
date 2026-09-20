import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'aiwijzer.';

export function readStorage<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / full): app keeps working in memory */
  }
}

export function usePersistentState<T>(
  key: string,
  initial: T,
  validate: (v: unknown) => v is T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readStorage(key, initial, validate));
  useEffect(() => writeStorage(key, value), [key, value]);
  const update = useCallback((next: T | ((prev: T) => T)) => setValue(next), []);
  return [value, update];
}
