import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`[config] ${name} ontbreekt in .env — zie .env.example`);
    return '';
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
  aaApiKey: required('ARTIFICIAL_ANALYSIS_API_KEY'),
  aaBaseUrl: 'https://artificialanalysis.ai/api/v2',
} as const;
