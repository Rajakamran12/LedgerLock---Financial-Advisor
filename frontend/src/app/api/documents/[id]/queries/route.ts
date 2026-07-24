import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  unauthorizedResponse,
  rateLimitedResponse,
  notFoundResponse,
  UnauthorizedError,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { documentIdSchema } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireUser();
    const { success } = await checkRateLimit("documentsRead", user.id);
    if (!success) return rateLimitedResponse();

    const { id } = await params;
    const idParsed = documentIdSchema.safeParse(id);
    if (!idParsed.success) return notFoundResponse();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") ?? "20"))
    );
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from("queries")
      .select("id, question, status, answer, citations, confidence, created_at", {
        count: "exact",
      })
      .eq("document_id", idParsed.data)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ queries: data, page, pageSize, total: count ?? 0 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    throw err;
  }
}
