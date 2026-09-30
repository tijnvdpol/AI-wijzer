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
  openaiApiKey: required('OPENAI_API_KEY'),
  openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini',
  aaApiKey: required('ARTIFICIAL_ANALYSIS_API_KEY'),
  aaBaseUrl: 'https://artificialanalysis.ai/api/v2',
} as const;
