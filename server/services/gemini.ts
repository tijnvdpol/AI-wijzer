import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse, type Tool } from '@google/genai';
import { z } from 'zod';
import { config } from '../config';

const client = new GoogleGenAI({ apiKey: config.geminiApiKey, httpOptions: { timeout: 90_000 } });

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly code: 'rate_limited' | 'upstream' | 'invalid_response' | 'timeout',
  ) {
    super(message);
  }
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface JsonCallOptions<S extends z.ZodType> {
  label: string;
  schema: S;
  systemInstruction: string;
  prompt: string;
  useTools: boolean;
  thinking: 'low' | 'default';
}

export interface JsonCallResult<T> {
  data: T;
  groundingSources: GroundingSource[];
}

function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: 'output' }) as Record<string, unknown>;
  return rest;
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  return JSON.parse(cleaned) as unknown;
}

function extractGrounding(response: GenerateContentResponse): GroundingSource[] {
  const candidate = response.candidates?.[0];
  const out: GroundingSource[] = [];
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    if (chunk.web?.uri) out.push({ title: chunk.web.title ?? chunk.web.uri, url: chunk.web.uri });
  }
  for (const meta of candidate?.urlContextMetadata?.urlMetadata ?? []) {
    if (meta.retrievedUrl) out.push({ title: meta.retrievedUrl, url: meta.retrievedUrl });
  }
  return out;
}

function logUsage(label: string, response: GenerateContentResponse, ms: number): void {
  const u = response.usageMetadata;
  console.log(
    `[gemini] ${label} model=${config.geminiModel} ${ms}ms tokens: prompt=${u?.promptTokenCount ?? '?'} ` +
      `output=${u?.candidatesTokenCount ?? '?'} thoughts=${u?.thoughtsTokenCount ?? 0} ` +
      `tools=${u?.toolUsePromptTokenCount ?? 0} total=${u?.totalTokenCount ?? '?'}`,
  );
}

const OVERLOAD_RETRIES = 3;

/** Retry on temporary 503 "high demand" errors with a growing delay. */
async function withOverloadRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (i >= OVERLOAD_RETRIES || !/503|UNAVAILABLE|high demand/i.test(message)) throw err;
      const delay = 2000 * 2 ** i;
      console.warn(`[gemini] ${label}: model overbelast, nieuwe poging over ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function mapError(err: unknown): UpstreamError {
  if (err instanceof UpstreamError) return err;
  const message = err instanceof Error ? err.message : String(err);
  if (/503|UNAVAILABLE|high demand/i.test(message)) {
    return new UpstreamError('Het AI-model is even overbelast. Probeer het over een minuutje opnieuw.', 'upstream');
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
    console.warn('[gemini] limiet:', message.slice(0, 500));
    return new UpstreamError('De Gemini-limiet is bereikt. Probeer het over een minuutje opnieuw.', 'rate_limited');
  }
  if (/abort|timeout|timed out|DEADLINE/i.test(message)) {
    return new UpstreamError('Gemini reageerde te langzaam. Probeer het opnieuw.', 'timeout');
  }
  console.error('[gemini] fout:', message);
  return new UpstreamError('Er ging iets mis bij het ophalen van het advies. Probeer het opnieuw.', 'upstream');
}

/** One Gemini call with JSON output validated by the same zod schema that defines it. */
export async function generateJson<S extends z.ZodType>(
  options: JsonCallOptions<S>,
): Promise<JsonCallResult<z.infer<S>>> {
  const tools: Tool[] = options.useTools ? [{ googleSearch: {} }, { urlContext: {} }] : [];
  const jsonSchema = toJsonSchema(options.schema);
  // Only Gemini 3 can combine tools with native JSON output. Older models get the schema in the prompt instead.
  const isGemini3 = /gemini-3/i.test(config.geminiModel);
  const nativeJson = isGemini3 || !options.useTools;
  const basePrompt = nativeJson
    ? options.prompt
    : `${options.prompt}

Geef je antwoord UITSLUITEND als één geldig JSON-object (geen tekst eromheen, geen markdown) dat voldoet aan dit JSON-schema:
${JSON.stringify(jsonSchema)}`;
  let lastProblem = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    let response: GenerateContentResponse;
    try {
      response = await withOverloadRetry(options.label, () =>
        client.models.generateContent({
          model: config.geminiModel,
          contents:
            attempt === 1
              ? basePrompt
              : `${basePrompt}\n\nLET OP: je vorige antwoord was ongeldig (${lastProblem}). Geef alleen geldige JSON volgens het schema.`,
          config: {
            systemInstruction: options.systemInstruction,
            ...(nativeJson ? { responseMimeType: 'application/json', responseJsonSchema: jsonSchema } : {}),
            ...(tools.length > 0 ? { tools } : {}),
            ...(isGemini3 && options.thinking === 'low' ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          },
        }),
      );
    } catch (err) {
      throw mapError(err);
    }
    logUsage(`${options.label} (poging ${attempt})`, response, Date.now() - started);

    try {
      const parsed = options.schema.parse(extractJson(response.text ?? ''));
      return { data: parsed, groundingSources: extractGrounding(response) };
    } catch (err) {
      lastProblem = err instanceof Error ? err.message.slice(0, 300) : 'onbekende fout';
      console.warn(`[gemini] ${options.label}: ongeldig antwoord (poging ${attempt}): ${lastProblem}`);
    }
  }
  throw new UpstreamError('Het advies kon niet worden verwerkt. Probeer het opnieuw.', 'invalid_response');
}
