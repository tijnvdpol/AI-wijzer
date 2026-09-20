export const CATEGORIES = [
  'text',
  'coding',
  'image',
  'image-editing',
  'video',
  'image-to-video',
  'speech',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Categories for which Artificial Analysis provides benchmark data. */
export type BenchmarkCategory = Exclude<Category, 'other'>;

export const CATEGORY_LABELS: Record<Category, string> = {
  text: 'Tekst & redeneren',
  coding: 'Programmeren',
  image: 'Afbeeldingen maken',
  'image-editing': 'Afbeeldingen bewerken',
  video: 'Video (tekst naar video)',
  'image-to-video': 'Video (afbeelding naar video)',
  speech: 'Spraak & voice-over',
  other: 'Overig (muziek, presentaties, websites, 3D, …)',
};

/** Short names used in "#2 van 15 in …" */
export const CATEGORY_SHORT: Record<Category, string> = {
  text: 'tekst & redeneren',
  coding: 'programmeren',
  image: 'text-to-image',
  'image-editing': 'image-editing',
  video: 'text-to-video',
  'image-to-video': 'image-to-video',
  speech: 'text-to-speech',
  other: 'overig',
};
