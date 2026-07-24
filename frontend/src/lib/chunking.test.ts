import { describe, expect, it } from "vitest";
import { chunkDocument, chunkPageText, type Chunk } from "@/lib/chunking";

describe("chunkPageText", () => {
  it("returns no chunks for empty or whitespace-only text", () => {
    expect(chunkPageText(1, "")).toEqual([]);
    expect(chunkPageText(1, "   \n\t  ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const chunks = chunkPageText(3, "The quick brown fox jumps over the lazy dog.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      pageNumber: 3,
      chunkIndex: 0,
      content: "The quick brown fox jumps over the lazy dog.",
    });
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it("splits long text into multiple overlapping chunks", () => {
    // ~500 token budget / 0.75 tokens-per-word ≈ 666 words per chunk.
    const words = Array.from({ length: 2000 }, (_, i) => `word${i}`);
    const chunks = chunkPageText(1, words.join(" "));

    expect(chunks.length).toBeGreaterThan(1);
    // Every chunk (except possibly the last) should carry the full token budget.
    chunks.slice(0, -1).forEach((chunk) => {
      expect(chunk.content.split(" ").length).toBe(Math.floor(500 / 0.75));
    });
    // chunkIndex should be sequential starting at 0.
    chunks.forEach((chunk, i) => expect(chunk.chunkIndex).toBe(i));
    // pageNumber is carried through unchanged.
    chunks.forEach((chunk) => expect(chunk.pageNumber).toBe(1));
  });

  it("produces overlapping content between consecutive chunks", () => {
    const words = Array.from({ length: 1500 }, (_, i) => `w${i}`);
    const chunks = chunkPageText(1, words.join(" "));
    expect(chunks.length).toBeGreaterThan(1);

    const firstWords = chunks[0].content.split(" ");
    const secondWords = chunks[1].content.split(" ");
    // The overlap region: the tail of chunk 0 should appear at the head of chunk 1.
    const overlapWords = Math.floor(75 / 0.75);
    const tailOfFirst = firstWords.slice(-overlapWords);
    const headOfSecond = secondWords.slice(0, overlapWords);
    expect(headOfSecond).toEqual(tailOfFirst);
  });

  it("never produces an infinite loop and terminates", () => {
    const words = Array.from({ length: 50000 }, (_, i) => `w${i}`);
    const chunks = chunkPageText(1, words.join(" "));
    expect(chunks.length).toBeGreaterThan(0);
    expect(Number.isFinite(chunks.length)).toBe(true);
  });
});

describe("chunkDocument", () => {
  it("returns an empty array for no pages", () => {
    expect(chunkDocument([])).toEqual([]);
  });

  it("assigns 1-indexed page numbers across multiple pages", () => {
    const pages = ["hello world", "another page here", ""];
    const chunks = chunkDocument(pages);

    const pageNumbers = new Set(chunks.map((c: Chunk) => c.pageNumber));
    expect(pageNumbers).toEqual(new Set([1, 2]));
    expect(chunks.every((c) => c.pageNumber >= 1 && c.pageNumber <= 3)).toBe(true);
  });

  it("restarts chunkIndex at 0 for each page", () => {
    const pages = ["short page one", "short page two"];
    const chunks = chunkDocument(pages);
    const page1Chunks = chunks.filter((c) => c.pageNumber === 1);
    const page2Chunks = chunks.filter((c) => c.pageNumber === 2);
    expect(page1Chunks[0].chunkIndex).toBe(0);
    expect(page2Chunks[0].chunkIndex).toBe(0);
  });
});
