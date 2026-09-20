import { useCallback, useRef, useState } from 'react';
import type { RecommendRequest } from '../../../shared/schemas';
import type { RecommendationResult } from '../../../shared/types';
import { ApiRequestError, requestRecommendation } from '../lib/api';

export type RecommendState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'clarify'; question: string; options: string[] }
  | { status: 'result'; result: RecommendationResult }
  | { status: 'error'; message: string };

export function useRecommend(onResult: (query: string, result: RecommendationResult) => void) {
  const [state, setState] = useState<RecommendState>({ status: 'idle' });
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (body: RecommendRequest) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ status: 'loading' });
      try {
        const res = await requestRecommendation(body, controller.signal);
        if (res.type === 'clarify') {
          setState({ status: 'clarify', question: res.question, options: res.options });
        } else {
          setState({ status: 'result', result: res.result });
          onResult(body.query, res.result);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof ApiRequestError ? err.message : 'Er ging iets mis. Probeer het opnieuw.';
        setState({ status: 'error', message });
      }
    },
    [onResult],
  );

  const showResult = useCallback((result: RecommendationResult) => {
    abortRef.current?.abort();
    setState({ status: 'result', result });
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: 'idle' });
  }, []);

  return { state, submit, showResult, reset };
}
