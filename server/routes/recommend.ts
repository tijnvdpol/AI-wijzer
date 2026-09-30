import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { recommendRequestSchema } from '../../shared/schemas';
import type { ApiError } from '../../shared/types';
import { config } from '../config';
import { UpstreamError } from '../services/openai';
import { recommend } from '../services/recommend';

export const recommendRouter = Router();

const limiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: config.dailyLimit,
  // Mislukte verzoeken (validatiefout, storing bij OpenAI) tellen niet mee.
  skipFailedRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res: Response<ApiError>) => {
    res.status(429).json({
      error: `Je hebt de limiet van ${config.dailyLimit} adviezen per dag bereikt. Probeer het morgen opnieuw.`,
      code: 'rate_limited',
    });
  },
});

recommendRouter.post('/recommend', limiter, async (req, res: Response) => {
  const parsed = recommendRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Ongeldig verzoek.';
    const body: ApiError = { error: message, code: 'invalid_request' };
    res.status(400).json(body);
    return;
  }
  if (!config.openaiApiKey) {
    const body: ApiError = { error: 'De server mist een OPENAI_API_KEY. Controleer het .env-bestand.', code: 'server' };
    res.status(500).json(body);
    return;
  }

  try {
    res.json(await recommend(parsed.data));
  } catch (err) {
    if (err instanceof UpstreamError) {
      const status = err.code === 'rate_limited' ? 429 : err.code === 'timeout' ? 504 : 502;
      const body: ApiError = { error: err.message, code: err.code };
      res.status(status).json(body);
      return;
    }
    console.error('[recommend] onverwachte fout:', err);
    const body: ApiError = { error: 'Er ging iets mis op de server. Probeer het opnieuw.', code: 'server' };
    res.status(500).json(body);
  }
});
