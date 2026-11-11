// The built-in banks for the auction challenges: spelling words, sentences to order, and memory
// words and images. Draft content for Mohd to review.
import type { Banks } from '../engine/content.ts';
import images from './memory-images.json';
import words from './memory-words.json';
import ordering from './ordering.json';
import spelling from './spelling.json';

type SpellingItem = { id: string; word: string };
type OrderingItem = { id: string; sentence: string };
type MemoryWord = { id: string; word: string };
type MemoryImage = { id: string; name: string; svg: string };

const svgFiles = import.meta.glob<string>('./memory-images/*.svg', { query: '?raw', import: 'default', eager: true });

export const SPELLING: SpellingItem[] = spelling;
export const ORDERING: OrderingItem[] = ordering;
export const MEMORY_WORDS: MemoryWord[] = words;
export const MEMORY_IMAGES: MemoryImage[] = images.map((image) => ({
  ...image,
  svg: svgFiles[`./memory-images/${image.id}.svg`] ?? '',
}));

/** The words of a sentence to order, split on spaces. */
export const sentenceWords = (sentence: string): string[] => sentence.split(/\s+/).filter(Boolean);

/** The banks as the engine needs them: ids, and each sentence's word count. */
export const BANKS: Banks = {
  spelling: SPELLING.map((item) => item.id),
  ordering: ORDERING.map((item) => ({ id: item.id, length: sentenceWords(item.sentence).length })),
  images: MEMORY_IMAGES.map((item) => item.id),
  words: MEMORY_WORDS.map((item) => item.id),
};
