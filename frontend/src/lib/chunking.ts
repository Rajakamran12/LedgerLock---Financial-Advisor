/**
 * Simple word-based chunker approximating token counts (~4 chars/token is
 * a common heuristic; we use whitespace-delimited words as a good enough
 * proxy without pulling in a tokenizer dependency).
 */

export interface Chunk {
  pageNumber: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

const CHUNK_SIZE_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 75;

function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Splits per-page text into overlapping ~500-token chunks with 75-token
 * overlap, so an answer near a chunk boundary still has full context.
 */
export function chunkPageText(pageNumber: number, text: string): Chunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  // Rough words-per-token-budget conversion assuming ~0.75 tokens/word.
  const wordsPerChunk = Math.floor(CHUNK_SIZE_TOKENS / 0.75);
  const overlapWords = Math.floor(CHUNK_OVERLAP_TOKENS / 0.75);
  const step = Math.max(1, wordsPerChunk - overlapWords);

  const chunks: Chunk[] = [];
  let chunkIndex = 0;
  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + wordsPerChunk);
    if (slice.length === 0) break;
    const content = slice.join(" ");
    chunks.push({
      pageNumber,
      chunkIndex: chunkIndex++,
      content,
      tokenCount: estimateTokenCount(content),
    });
    if (start + wordsPerChunk >= words.length) break;
  }
  return chunks;
}

export function chunkDocument(pages: string[]): Chunk[] {
  const allChunks: Chunk[] = [];
  pages.forEach((pageText, index) => {
    const pageNumber = index + 1;
    allChunks.push(...chunkPageText(pageNumber, pageText));
  });
  return allChunks;
}
