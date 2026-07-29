import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse, after } from "next/server";
import { getDocumentProxy, extractText } from "unpdf";
import {
  requireUser,
  unauthorizedResponse,
  rateLimitedResponse,
  UnauthorizedError,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validation";
import { chunkDocument } from "@/lib/chunking";
import { embedText } from "@/lib/agent";

// Allow up to 60 s for the embedding pipeline on large PDFs.
// Vercel Hobby plan caps this at 60 s; Pro plan allows up to 800 s.
export const maxDuration = 60;

const STORAGE_BUCKET = "documents";
const MIN_EXTRACTED_CHARS = 50; // below this, treat as a scanned/image-only PDF

export async function GET(request: NextRequest) {
  try {
    if (process.env.PLAYWRIGHT_TEST === "1") {
      // Simple file-backed stub for E2E tests.
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const stubPath = path.resolve(process.cwd(), "e2e_stub.json");
      let stub: { documents: Array<Record<string, unknown>> } = { documents: [] };
      try {
        const txt = await fs.readFile(stubPath, "utf-8");
        stub = JSON.parse(txt);
      } catch {
        // no-op
      }

      const { searchParams } = new URL(request.url);
      const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
      const from = (page - 1) * pageSize;
      const to = from + pageSize;
      const docs = stub.documents.slice(from, to);
      return NextResponse.json({ documents: docs, page, pageSize, total: stub.documents.length });
    }
    const { supabase, user } = await requireUser();

    const { success } = await checkRateLimit("documentsRead", user.id);
    if (!success) return rateLimitedResponse();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") ?? "20"))
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("documents")
      .select("id, file_name, page_count, status, failure_reason, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      documents: data,
      page,
      pageSize,
      total: count ?? 0,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    throw err;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.PLAYWRIGHT_TEST === "1") {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const stubPath = path.resolve(process.cwd(), "e2e_stub.json");

      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

      const id = randomUUID();
      const doc = {
        id,
        file_name: file.name,
        page_count: 1,
        status: "ready",
        created_at: new Date().toISOString(),
      };

      let stub: { documents: Array<Record<string, unknown>> } = { documents: [] };
      try {
        const txt = await fs.readFile(stubPath, "utf-8");
        stub = JSON.parse(txt);
      } catch {}
      stub.documents.unshift(doc);
      await fs.writeFile(stubPath, JSON.stringify(stub, null, 2));

      return NextResponse.json({ document: doc }, { status: 201 });
    }
    const { supabase, user } = await requireUser();

    const { success } = await checkRateLimit("documentsCreate", user.id);
    if (!success) return rateLimitedResponse();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds the 20 MB limit." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const documentId = randomUUID();
    const storagePath = `${user.id}/${documentId}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { contentType: "application/pdf" });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: document, error: insertError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        user_id: user.id,
        file_name: file.name,
        storage_path: storagePath,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Parse, chunk, and embed. Use after() so Vercel's waitUntil keeps the
    // serverless function alive after the response is sent. Without this,
    // Vercel terminates the function the moment NextResponse is returned,
    // killing the background promise and marking every document as failed.
    after(async () => {
      try {
        await processDocument(documentId, bytes);
      } catch (err) {
        console.error(`processDocument(${documentId}) failed`, err);
      }
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    throw err;
  }
}

async function processDocument(documentId: string, bytes: Uint8Array) {
  const { createServiceRoleClient } = await import("@/lib/supabase/server");
  const supabase = createServiceRoleClient();

  try {
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await extractText(pdf, { mergePages: false });

    const totalChars = text.reduce((sum: number, page: string) => sum + page.length, 0);
    if (totalChars < MIN_EXTRACTED_CHARS) {
      await supabase
        .from("documents")
        .update({
          status: "failed",
          failure_reason:
            "This looks like a scanned/image-only PDF. LedgerLock requires a text-based document.",
        })
        .eq("id", documentId);
      return;
    }

    const chunks = chunkDocument(text);

    // Embed sequentially with modest concurrency to stay within the
    // agent's free-tier rate limit.
    const CONCURRENCY = 3;
    const rows: {
      document_id: string;
      page_number: number;
      chunk_index: number;
      content: string;
      token_count: number;
      embedding: number[];
    }[] = [];

    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
      const batch = chunks.slice(i, i + CONCURRENCY);
      const embeddings = await Promise.all(
        batch.map((chunk) => embedText(chunk.content))
      );
      batch.forEach((chunk, idx) => {
        rows.push({
          document_id: documentId,
          page_number: chunk.pageNumber,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          token_count: chunk.tokenCount,
          embedding: embeddings[idx],
        });
      });
    }

    if (rows.length > 0) {
      const { error: chunkError } = await supabase
        .from("document_chunks")
        .insert(rows);
      if (chunkError) throw chunkError;
    }

    await supabase
      .from("documents")
      .update({ status: "ready", page_count: totalPages })
      .eq("id", documentId);
  } catch (err) {
    console.error("processDocument error", err);
    await supabase
      .from("documents")
      .update({
        status: "failed",
        failure_reason: "Failed to parse or embed the document. Please try again.",
      })
      .eq("id", documentId);
  }
}
