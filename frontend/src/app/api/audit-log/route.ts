import { NextRequest, NextResponse } from "next/server";
import {
  requireUser,
  unauthorizedResponse,
  rateLimitedResponse,
  UnauthorizedError,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { auditLogQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser();
    const { success } = await checkRateLimit("auditLog", user.id);
    if (!success) return rateLimitedResponse();

    const { searchParams } = new URL(request.url);
    const parsed = auditLogQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid query." },
        { status: 422 }
      );
    }

    const { status, page, pageSize } = parsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from("queries")
      .select(
        "id, question, status, answer, citations, confidence, created_at, documents(file_name)",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data, page, pageSize, total: count ?? 0 });
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    throw err;
  }
}
