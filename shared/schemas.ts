import { z } from 'zod';
import { CATEGORIES } from './categories.js';

export const categorySchema = z.enum(CATEGORIES);

/* ---------- Request from the client ---------- */

export const budgetSchema = z.object({
  mode: z.enum(['free', 'existing', 'unlimited']),
  maxPerMonth: z.number().min(0).max(50),
  preferOneOff: z.boolean(),
});

export const settingsSchema = z.object({
  subscriptions: z.array(z.string().max(80)).max(60),
  customSubscriptions: z.array(z.string().max(80)).max(20),
  student: z.boolean(),
});

export const preferencesSchema = z.object({
  level: z.enum(['beginner', 'gevorderd', 'expert']).nullable(),
  priority: z.enum(['kwaliteit', 'snelheid', 'gebruiksgemak', 'privacy']).nullable(),
});

export const recommendRequestSchema = z.object({
  query: z.string().trim().min(3, 'Vertel iets meer over wat je wilt maken.').max(1500),
  clarification: z
    .object({ question: z.string().max(400), answer: z.string().max(400) })
    .nullable()
    .default(null),
  settings: settingsSchema,
  budget: budgetSchema,
  preferences: preferencesSchema,
});

/* ---------- OpenAI classification call ---------- */

export const classificationSchema = z.object({
  category: categorySchema.describe('De best passende categorie voor het verzoek.'),
  needsClarification: z
    .boolean()
    .describe('true alleen als het verzoek zo vaag is dat een goede aanbeveling onmogelijk is.'),
  clarifyingQuestion: z.string().nullable().describe('Eén korte verduidelijkende vraag in het Nederlands, of null.'),
  clarifyingOptions: z
    .array(z.string())
    .describe('2 tot 4 korte klikbare antwoorden op de verduidelijkende vraag; leeg als er geen vraag is.'),
});

/* ---------- OpenAI recommendation (structured output) ---------- */

const costSchema = z.object({
  type: z
    .enum(['included', 'free', 'paid'])
    .describe('included = zit in een bestaand abonnement van de gebruiker; free = gratis (tier); paid = extra kosten.'),
  detail: z.string().describe('Korte uitleg, bijv. gratis limieten of welk abonnement/plan nodig is.'),
  monthlyEuro: z
    .number()
    .nullable()
    .describe('Geschatte extra kosten in euro per maand (of per gebruik) bij type paid, anders null.'),
});

const toolFields = {
  name: z.string().describe('Naam van het product/de app (niet alleen het model).'),
  maker: z.string().describe('Bedrijf achter het product.'),
  url: z.string().describe('Officiële URL van het product; alleen een URL die je hebt gevonden of zeker weet.'),
  cost: costSchema,
  benchmarkModelId: z
    .string()
    .nullable()
    .describe(
      'Het id van het onderliggende model uit de aangeleverde Artificial Analysis-lijst, of null als het niet in de lijst staat.',
    ),
};

const topPickSchema = z.object({
  ...toolFields,
  verdict: z.string().describe('Eén zin: het oordeel.'),
  whyItFits: z.string().describe('Waarom dit past bij dit verzoek en deze gebruiker.'),
  strengths: z.array(z.string()).describe('2 tot 4 sterke punten.'),
  limitations: z.array(z.string()).describe('1 tot 3 beperkingen.'),
  difficulty: z.enum(['makkelijk', 'gemiddeld', 'gevorderd']),
});

const alternativeSchema = z.object({
  ...toolFields,
  chooseIf: z.string().describe('Begint met "Kies deze als" en legt uit wanneer dit de betere keuze is.'),
});

const existingOptionSchema = z.object({
  name: z.string().describe('Product binnen een bestaand abonnement.'),
  subscription: z.string().describe('Welk abonnement van de gebruiker dit dekt.'),
  qualityDifference: z
    .string()
    .describe('Eerlijke vergelijking met de topkeuze; gebruik benchmarkscores indien beschikbaar.'),
  benchmarkModelId: z.string().nullable(),
});

const sourceSchema = z.object({ title: z.string(), url: z.string() });

export const recommendationSchema = z.object({
  topPick: topPickSchema,
  alternatives: z.array(alternativeSchema).describe('Precies 2 alternatieven (minder als er echt geen zijn).'),
  existingOption: existingOptionSchema
    .nullable()
    .describe('Alleen invullen als een bestaand abonnement de klus redelijk kan, en het niet al de topkeuze is.'),
  budgetNote: z
    .string()
    .nullable()
    .describe(
      'Alleen als het budget een duidelijk betere betaalde optie uitsloot: "Met een betaald abonnement zou X beter zijn, omdat ...".',
    ),
  starterPrompt: z.string().describe('Startprompt op maat voor de gekozen tool.'),
  tip: z.string().describe('Eén praktische tip.'),
  usedBenchmarks: z.boolean().describe('true als de aangeleverde Artificial Analysis-data is gebruikt.'),
  benchmarkNote: z
    .string()
    .nullable()
    .describe('Als er geen benchmarkdata is: leg uit dat de aanbeveling op webonderzoek berust.'),
  sources: z.array(sourceSchema).describe('Bronnen (URLs) waarop je prijzen/beschikbaarheid hebt gebaseerd.'),
});

export type Classification = z.infer<typeof classificationSchema>;
export type AiRecommendation = z.infer<typeof recommendationSchema>;
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
