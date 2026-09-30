import OpenAI, { APIConnectionTimeoutError, APIError } from 'openai';
import type { Response } from 'openai/resources/responses/responses';
import { z } from 'zod';
import { config } from '../config.js';

// The SDK retries 429/5xx/connection errors itself with exponential backoff.
// Created on first use: the SDK throws when the key is missing, which must not crash the server/function at load time.
let client: OpenAI | undefined;
function getClient(): OpenAI {
  client ??= new OpenAI({ apiKey: config.openaiApiKey, timeout: 120_000, maxRetries: 3 });
  return client;
}

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

function extractGrounding(response: Response): GroundingSource[] {
  const out: GroundingSource[] = [];
  for (const item of response.output) {
    if (item.type !== 'message') continue;
    for (const part of item.content) {
      if (part.type !== 'output_text') continue;
      for (const annotation of part.annotations) {
        if (annotation.type === 'url_citation' && annotation.url) {
          out.push({ title: annotation.title || annotation.url, url: annotation.url });
        }
      }
    }
  }
  return out;
}

function logUsage(label: string, response: Response, ms: number): void {
  const u = response.usage;
  console.log(
    `[openai] ${label} model=${config.openaiModel} ${ms}ms tokens: input=${u?.input_tokens ?? '?'} ` +
      `output=${u?.output_tokens ?? '?'} reasoning=${u?.output_tokens_details?.reasoning_tokens ?? 0} ` +
      `total=${u?.total_tokens ?? '?'}`,
  );
}

function mapError(err: unknown): UpstreamError {
  if (err instanceof UpstreamError) return err;
  if (err instanceof APIConnectionTimeoutError) {
    return new UpstreamError('OpenAI reageerde te langzaam. Probeer het opnieuw.', 'timeout');
  }
  const status = err instanceof APIError ? err.status : undefined;
  const message = err instanceof Error ? err.message : String(err);
  if (status === 401) {
    console.error('[openai] sleutel geweigerd:', message.slice(0, 300));
    return new UpstreamError('De OpenAI API-sleutel is ongeldig. Controleer OPENAI_API_KEY in .env.', 'upstream');
  }
  if (status === 403 || status === 404) {
    console.error('[openai] geen toegang tot model:', message.slice(0, 300));
    return new UpstreamError(
      `Het OpenAI-model '${config.openaiModel}' is niet beschikbaar voor je project. Kies een ander model bij OPENAI_MODEL (.env of Vercel). Reden van OpenAI: ${message.replace(/sk-[A-Za-z0-9_*.-]+/g, 'sk-…').slice(0, 200)}`,
      'upstream',
    );
  }
  if (status === 429) {
    console.warn('[openai] limiet:', message.slice(0, 500));
    return new UpstreamError('De OpenAI-limiet of het tegoed is bereikt. Probeer het over een minuutje opnieuw.', 'rate_limited');
  }
  if (status !== undefined && status >= 500) {
    return new UpstreamError('Het AI-model is even overbelast. Probeer het over een minuutje opnieuw.', 'upstream');
  }
  if (/timeout|timed out|abort/i.test(message)) {
    return new UpstreamError('OpenAI reageerde te langzaam. Probeer het opnieuw.', 'timeout');
  }
  console.error('[openai] fout:', message);
  return new UpstreamError('Er ging iets mis bij het ophalen van het advies. Probeer het opnieuw.', 'upstream');
}

/** One OpenAI Responses call with JSON output validated by the same zod schema that defines it. */
export async function generateJson<S extends z.ZodType>(
  options: JsonCallOptions<S>,
): Promise<JsonCallResult<z.infer<S>>> {
  const jsonSchema = toJsonSchema(options.schema);
  const schemaInPrompt = `${options.prompt}

Geef je antwoord UITSLUITEND als één geldig JSON-object (geen tekst eromheen, geen markdown) dat voldoet aan dit JSON-schema:
${JSON.stringify(jsonSchema)}`;
  // Native structured output is the default; if the API rejects it (400) we fall back to the schema in the prompt.
  let nativeJson = true;
  let lastProblem = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    const basePrompt = nativeJson ? options.prompt : schemaInPrompt;
    const input =
      attempt === 1
        ? basePrompt
        : `${basePrompt}\n\nLET OP: je vorige antwoord was ongeldig (${lastProblem}). Geef alleen geldige JSON volgens het schema.`;

    let response: Response;
    try {
      const request = {
        model: config.openaiModel,
        instructions: options.systemInstruction,
        input,
        // Alleen redeneermodellen (gpt-5, o-serie) kennen de parameter reasoning; gpt-4.x geeft er een 400 op.
        ...(/^(gpt-5|od)/i.test(config.openaiModel)
          ? { reasoning: { effort: options.thinking === 'low' ? ('low' as const) : ('medium' as const) } }
          : {}),
        ...(options.useTools ? { tools: [{ type: 'web_search' as const }] } : {}),
        ...(nativeJson
          ? { text: { format: { type: 'json_schema' as const, name: 'antwoord', strict: true, schema: jsonSchema } } }
          : {}),
      };
      try {
        response = await getClient().responses.create(request);
      } catch (err) {
        if (nativeJson && err instanceof APIError && err.status === 400) {
          console.warn(`[openai] ${options.label}: gestructureerde uitvoer geweigerd, schema gaat in de prompt:`, err.message.slice(0, 300));
          nativeJson = false;
          attempt--;
          continue;
        }
        throw err;
      }
    } catch (err) {
      throw mapError(err);
    }
    logUsage(`${options.label} (poging ${attempt})`, response, Date.now() - started);

    try {
      const parsed = options.schema.parse(extractJson(response.output_text));
      return { data: parsed, groundingSources: extractGrounding(response) };
    } catch (err) {
      lastProblem = err instanceof Error ? err.message.slice(0, 300) : 'onbekende fout';
      console.warn(`[openai] ${options.label}: ongeldig antwoord (poging ${attempt}): ${lastProblem}`);
    }
  }
  throw new UpstreamError('Het advies kon niet worden verwerkt. Probeer het opnieuw.', 'invalid_response');
}
