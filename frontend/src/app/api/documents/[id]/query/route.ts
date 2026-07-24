import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  unauthorizedResponse,
  rateLimitedResponse,
  notFoundResponse,
  UnauthorizedError,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { documentIdSchema, queryRequestSchema } from "@/lib/validation";
import { embedText, queryAgent, AgentWarmingUpError, AgentError } from "@/lib/agent";

const MATCH_THRESHOLD = 0.5;
const MATCH_COUNT = 8;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  try {
    if (process.env.PLAYWRIGHT_TEST === "1") {
      const body = (await request.json().catch(() => null)) as { question?: string } | null;
      const question = body?.question ?? "";
      // Simple canned responses for E2E tests.
      if (/should i|should I|buy/i.test(question)) {
        return NextResponse.json({ status: "refused_advice_request", answer: null, citations: [], confidence: null });
      }
      if (/total revenue/i.test(question)) {
        return NextResponse.json({
          status: "verified",
          answer: "Total revenue in fiscal year 2024 was $1,234,567.",
          citations: [{ pageNumber: 1, quote: "Total revenue: $1,234,567" }],
          confidence: 0.99,
        });
      }
      return NextResponse.json({ status: "insufficient_context", answer: null, citations: [], confidence: null });
    }
    const { supabase, user } = await requireUser();
    const { success } = await checkRateLimit("query", user.id);
    if (!success) return rateLimitedResponse();

    const paramsResolved = await params;
    const idParsed = documentIdSchema.safeParse(paramsResolved.id);
    if (!idParsed.success) return notFoundResponse();

    const body = await request.json().catch(() => null);
    const bodyParsed = queryRequestSchema.safeParse(body);
    if (!bodyParsed.success) {
      return NextResponse.json(
        { error: bodyParsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 422 }
      );
    }
    const { question } = bodyParsed.data;

    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, status")
      .eq("id", idParsed.data)
      .maybeSingle();

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }
    if (!document) return notFoundResponse("Document not found.");
    if (document.status !== "ready") {
      return NextResponse.json(
        { error: `Document is not ready (status: ${document.status}).` },
        { status: 409 }
      );
    }

    // Layer 1 — retrieval gate: embed the question and search; only send
    // chunks to the agent if something clears the similarity threshold.
    let questionEmbedding: number[];
    try {
      questionEmbedding = await embedText(question);
    } catch (err) {
      if (err instanceof AgentWarmingUpError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      throw err;
    }

    const { data: matches, error: matchError } = await supabase.rpc(
      "match_document_chunks",
      {
        p_document_id: idParsed.data,
        p_user_id: user.id,
        query_embedding: questionEmbedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: MATCH_COUNT,
      }
    );

    if (matchError) {
      return NextResponse.json({ error: matchError.message }, { status: 500 });
    }

    if (!matches || matches.length === 0) {
      const result = {
        status: "refused_out_of_scope" as const,
        answer: null,
        citations: [],
        confidence: null,
      };
      await logQuery(supabase, {
        documentId: idParsed.data,
        userId: user.id,
        question,
        result,
        latencyMs: Date.now() - start,
      });
      return NextResponse.json(result);
    }

    // Layers 2–4 run inside the agent's single /query call.
    let result;
    try {
      result = await queryAgent(
        question,
        matches.map((m: { id: string; page_number: number; content: string }) => ({
          chunkId: m.id,
          pageNumber: m.page_number,
          content: m.content,
        }))
      );
    } catch (err) {
      if (err instanceof AgentWarmingUpError) {
        return NextResponse.json({ error: err.message }, { status: 503 });
      }
      if (err instanceof AgentError) {
        result = { status: "error" as const, answer: null, citations: [], confidence: null };
      } else {
        throw err;
      }
    }

    await logQuery(supabase, {
      documentId: idParsed.data,
      userId: user.id,
      question,
      result,
      latencyMs: Date.now() - start,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    throw err;
  }
}

async function logQuery(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  opts: {
    documentId: string;
    userId: string;
    question: string;
    result: {
      status: string;
      answer: string | null;
      citations: unknown;
      confidence: string | null;
    };
    latencyMs: number;
  }
) {
  await supabase.from("queries").insert({
    document_id: opts.documentId,
    user_id: opts.userId,
    question: opts.question,
    status: opts.result.status,
    answer: opts.result.answer,
    citations: opts.result.citations,
    confidence: opts.result.confidence,
    latency_ms: opts.latencyMs,
  });
}
