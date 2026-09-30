import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ApiError } from '../../shared/types.js';
import { config } from '../config.js';
import { decrement, increment } from './counter.js';

function today(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' });
}

/** At most `config.dailyLimit` successful requests per IP per day (Dutch time). Failed requests (status >= 400) are refunded. */
export const dailyLimit: RequestHandler = (req: Request, res: Response<ApiError>, next: NextFunction) => {
  const key = `aiwijzer:limit:${req.ip ?? 'onbekend'}:${today()}`;
  void (async () => {
    let count: number;
    try {
      count = await increment(key, 172_800);
    } catch (err) {
      // Better to let the request through than to lock everyone out when Redis hiccups; the OpenAI budget is the backstop.
      console.warn('[limit] teller niet bereikbaar, verzoek toegelaten:', err instanceof Error ? err.message : err);
      next();
      return;
    }
    if (count > config.dailyLimit) {
      await decrement(key).catch(() => undefined);
      res.status(429).json({
        error: `Je hebt de limiet van ${config.dailyLimit} adviezen per dag bereikt. Probeer het morgen opnieuw.`,
        code: 'rate_limited',
      });
      return;
    }
    res.on('finish', () => {
      if (res.statusCode >= 400) void decrement(key).catch(() => undefined);
    });
    next();
  })();
};
