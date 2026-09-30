import { Router, type Response } from 'express';
import { recommendRequestSchema } from '../../shared/schemas.js';
import type { ApiError } from '../../shared/types.js';
import { config } from '../config.js';
import { UpstreamError } from '../services/openai.js';
import { login, logout, requirePin, sessionStatus } from '../services/auth.js';
import { dailyLimit } from '../services/dailyLimit.js';
import { recommend } from '../services/recommend.js';

export const recommendRouter = Router();

recommendRouter.get('/sessie', (req, res) => {
  res.json(sessionStatus(req));
});
recommendRouter.post('/login', (req, res) => {
  void login(req, res, (req.body as { pin?: unknown } | undefined)?.pin);
});
recommendRouter.post('/logout', (req, res) => {
  logout(req, res);
});

// Order matters: check the PIN first, so anonymous requests neither use up the daily limit nor reach OpenAI.
recommendRouter.post('/recommend', requirePin, dailyLimit, async (req, res: Response) => {
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
