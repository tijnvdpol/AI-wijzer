import type { RecommendRequest } from '../../../shared/schemas';
import type { ApiError, RecommendResponse } from '../../../shared/types';

/** Fired when the server says the PIN session is missing or expired; PinGate then shows the PIN screen again. */
export const UNAUTHORIZED_EVENT = 'aiwijzer:unauthorized';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: ApiError['code'],
  ) {
    super(message);
  }
}

function isApiError(v: unknown): v is ApiError {
  return typeof v === 'object' && v !== null && typeof (v as { error?: unknown }).error === 'string';
}

export async function requestRecommendation(
  body: RecommendRequest,
  signal: AbortSignal,
): Promise<RecommendResponse> {
  let res: Response;
  try {
    res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiRequestError('Geen verbinding met de server. Controleer of de app draait.', 'server');
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiRequestError('Onverwacht antwoord van de server.', 'server');
  }
  if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  if (!res.ok) {
    if (isApiError(data)) throw new ApiRequestError(data.error, data.code);
    throw new ApiRequestError('Er ging iets mis. Probeer het opnieuw.', 'server');
  }
  return data as RecommendResponse;
}
