import type { Budget, Preferences, Settings } from '../../../shared/schemas';

export interface SubscriptionGroup {
  title: string;
  items: string[];
}

export const SUBSCRIPTION_GROUPS: SubscriptionGroup[] = [
  {
    title: 'Chat / tekst',
    items: [
      'ChatGPT Plus/Pro',
      'Claude Pro/Max',
      'Google AI Pro (Gemini)',
      'Microsoft Copilot Pro / Microsoft 365',
      'Perplexity Pro',
    ],
  },
  { title: 'Beeld / design', items: ['Midjourney', 'Adobe Creative Cloud / Firefly', 'Canva Pro'] },
  { title: 'Video', items: ['Runway', 'Kling', 'Luma', 'Pika', 'HeyGen'] },
  { title: 'Audio / muziek', items: ['ElevenLabs', 'Suno'] },
  { title: 'Code', items: ['GitHub Copilot', 'Cursor'] },
  { title: 'Overig', items: ['Notion AI'] },
];

export const EXAMPLES: string[] = [
  'Een korte productvideo maken van een foto',
  'Een logo ontwerpen voor mijn bakkerij',
  'Een website bouwen zonder te programmeren',
  'Een lang rapport samenvatten en de kernpunten eruit halen',
  'Achtergrondmuziek voor mijn podcast maken',
  'Een presentatie maken over duurzame energie',
];

export const DEFAULT_SETTINGS: Settings = { subscriptions: [], customSubscriptions: [], student: false };
export const DEFAULT_BUDGET: Budget = { mode: 'existing', maxPerMonth: 20, preferOneOff: false };
export const DEFAULT_PREFERENCES: Preferences = { level: null, priority: null };

export const LOADING_MESSAGES: string[] = [
  'Je vraag wordt geanalyseerd…',
  'Benchmarkdata van Artificial Analysis wordt bekeken…',
  'Actuele prijzen en abonnementen worden gezocht…',
  'Je bestaande abonnementen worden meegewogen…',
  'De opties worden vergeleken…',
  'Bijna klaar, het advies wordt opgesteld…',
];
