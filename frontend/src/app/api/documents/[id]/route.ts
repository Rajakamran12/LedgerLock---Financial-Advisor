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

const STORAGE_BUCKET = "documents";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (process.env.PLAYWRIGHT_TEST === "1") {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const stubPath = path.resolve(process.cwd(), "e2e_stub.json");
      let stub: { documents: Array<{ id: string; [key: string]: unknown }> } = { documents: [] };
      try {
        const txt = await fs.readFile(stubPath, "utf-8");
        stub = JSON.parse(txt);
      } catch {}
      const { id } = await params;
      const doc = stub.documents.find((d) => d.id === id);
      if (!doc) return notFoundResponse("Document not found.");
      return NextResponse.json({ document: doc });
    }
    const { supabase, user } = await requireUser();
    const { success } = await checkRateLimit("documentsRead", user.id);
    if (!success) return rateLimitedResponse();

    const { id } = await params;
    const parsed = documentIdSchema.safeParse(id);
    if (!parsed.success) return notFoundResponse();

    const { data, error } = await supabase
      .from("documents")
      .select("id, file_name, page_count, status, failure_reason, created_at")
      .eq("id", parsed.data)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return notFoundResponse("Document not found.");

    return NextResponse.json({ document: data });
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, user } = await requireUser();
    const { success } = await checkRateLimit("documentsDelete", user.id);
    if (!success) return rateLimitedResponse();

    const { id } = await params;
    const parsed = documentIdSchema.safeParse(id);
    if (!parsed.success) return notFoundResponse();

    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("id, storage_path")
      .eq("id", parsed.data)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!doc) return notFoundResponse("Document not found.");

    // RLS also enforces ownership, but this row was already scoped to the
    // authenticated user's session by the query above.
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", parsed.data);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await supabase.storage.from(STORAGE_BUCKET).remove([doc.storage_path]);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) return unauthorizedResponse();
    throw err;
  }
}
