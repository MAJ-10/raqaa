// The built-in banks: the right counts, no duplicates, and content the challenges can use.
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANKS, MEMORY_IMAGES, sentenceWords } from '../src/content/index.ts';
import images from '../src/content/memory-images.json';
import words from '../src/content/memory-words.json';
import ordering from '../src/content/ordering.json';
import spelling from '../src/content/spelling.json';

const unique = (items: string[]) => new Set(items).size === items.length;
const arabicOnly = /^[ء-ي ]+$/;

describe('built-in banks', () => {
  it('spelling: 120 different Arabic words', () => {
    expect(spelling).toHaveLength(120);
    expect(unique(spelling.map((s) => s.id))).toBe(true);
    expect(unique(spelling.map((s) => s.word))).toBe(true);
    for (const { word } of spelling) expect(word).toMatch(arabicOnly);
  });

  it('ordering: 80 different sentences of 5 to 8 words', () => {
    expect(ordering).toHaveLength(80);
    expect(unique(ordering.map((s) => s.id))).toBe(true);
    expect(unique(ordering.map((s) => s.sentence))).toBe(true);
    for (const { sentence } of ordering) {
      expect(sentence).toMatch(arabicOnly);
      const count = sentenceWords(sentence).length;
      expect(count, sentence).toBeGreaterThanOrEqual(5);
      expect(count, sentence).toBeLessThanOrEqual(8);
    }
  });

  it('memory words: 120 different one-word items', () => {
    expect(words).toHaveLength(120);
    expect(unique(words.map((w) => w.id))).toBe(true);
    expect(unique(words.map((w) => w.word))).toBe(true);
    for (const { word } of words) expect(word).toMatch(/^[ء-ي]+$/);
  });

  it('memory images: 60, each with a name and its own picture', () => {
    const files = readdirSync(resolve('src/content/memory-images'))
      .filter((f: string) => f.endsWith('.svg'))
      .map((f: string) => f.replace(/\.svg$/, ''));
    expect(images).toHaveLength(60);
    expect(images.map((i) => i.id).sort()).toEqual(files.sort());
    expect(unique(images.map((i) => i.name))).toBe(true);
  });

  it('reach the engine as ids, with each sentence’s word count and each image’s picture', () => {
    expect(BANKS.spelling).toHaveLength(120);
    expect(BANKS.words).toHaveLength(120);
    expect(BANKS.images).toHaveLength(60);
    expect(BANKS.ordering).toHaveLength(80);
    expect(BANKS.ordering[0]).toEqual({ id: 'o001', length: 7 });
    for (const image of MEMORY_IMAGES) expect(image.svg, image.id).toContain('<svg');
  });
});
