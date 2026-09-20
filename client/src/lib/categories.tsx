import {
  AudioLines,
  Code2,
  Film,
  Image as ImageIcon,
  MessageSquareText,
  PencilRuler,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from '../../../shared/categories';

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  text: MessageSquareText,
  coding: Code2,
  image: ImageIcon,
  'image-editing': PencilRuler,
  video: Film,
  'image-to-video': Film,
  speech: AudioLines,
  other: Sparkles,
};

