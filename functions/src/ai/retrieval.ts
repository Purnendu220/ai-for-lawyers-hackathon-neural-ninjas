import { normalizeForMatch } from './citations';

export type Searchable = { id: string; text: string };

/** Common English and Hindi words that carry no meaning for matching. */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'did', 'do', 'does', 'for', 'from', 'has', 'have',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'were', 'what',
  'when', 'which', 'who', 'will', 'with', 'about', 'any', 'there', 'their', 'they',
  'का', 'की', 'के', 'को', 'में', 'है', 'हैं', 'से', 'और', 'पर', 'क्या', 'कब', 'कौन',
]);

function tokens(text: string): string[] {
  return normalizeForMatch(text)
    .split(' ')
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Ranks passages for a question with BM25 (docs/ARCHITECTURE.md §5.7). Keyword search is enough for
 * the MVP's small cases; multilingual embeddings are the upgrade path. Returns at most `limit`
 * passages with a positive score, best first.
 */
export function rank<T extends Searchable>(passages: T[], question: string, limit = 8): T[] {
  const query = [...new Set(tokens(question))];
  if (query.length === 0 || passages.length === 0) return [];

  const docs = passages.map((p) => tokens(p.text));
  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / docs.length || 1;
  const documentFrequency = new Map(
    query.map((term) => [term, docs.filter((d) => d.includes(term)).length]),
  );
  const k1 = 1.2;
  const b = 0.75;

  return passages
    .map((passage, i) => {
      const doc = docs[i] ?? [];
      let score = 0;
      for (const term of query) {
        const tf = doc.filter((t) => t === term).length;
        if (tf === 0) continue;
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (passages.length - df + 0.5) / (df + 0.5));
        score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / avgLength));
      }
      return { passage, score };
    })
    .filter((r) => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((r) => r.passage);
}
