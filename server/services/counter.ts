// Counters with an expiry, shared between serverless instances through Upstash Redis when it is configured
// (Vercel Marketplace sets KV_REST_API_* or UPSTASH_REDIS_REST_*). Without Redis they live in memory: fine locally,
// but on Vercel every instance then has its own counters.
const redisUrl = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/$/, '');
const redisToken = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? '';
const useRedis = redisUrl !== '' && redisToken !== '';

if (!useRedis && process.env.VERCEL) {
  console.warn('[counter] Geen Redis (KV_REST_API_URL/TOKEN) ingesteld: limieten werken per serverinstantie, niet globaal.');
}

const memory = new Map<string, { count: number; expires: number }>();

async function redisPipeline(commands: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${redisUrl}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`Redis gaf HTTP ${res.status}`);
  const out = (await res.json()) as Array<{ result?: unknown; error?: string }>;
  const failed = out.find((r) => r.error);
  if (failed) throw new Error(`Redis: ${failed.error}`);
  return out.map((r) => r.result);
}

/** Adds 1 and returns the new value. The expiry is set when the counter is created. */
export async function increment(key: string, ttlSeconds: number): Promise<number> {
  if (useRedis) {
    const [count] = await redisPipeline([
      ['INCR', key],
      ['EXPIRE', key, ttlSeconds, 'NX'],
    ]);
    return Number(count);
  }
  const now = Date.now();
  for (const [k, v] of memory) if (v.expires <= now) memory.delete(k);
  const entry = memory.get(key) ?? { count: 0, expires: now + ttlSeconds * 1000 };
  entry.count += 1;
  memory.set(key, entry);
  return entry.count;
}

export async function decrement(key: string): Promise<void> {
  if (useRedis) {
    await redisPipeline([['DECR', key]]);
    return;
  }
  const entry = memory.get(key);
  if (entry) entry.count = Math.max(entry.count - 1, 0);
}
