import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "@/components/chat/chat-panel";
import { StatusBadge } from "@/components/documents/status-badge";
import type { QueryRow } from "@/lib/types";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: document } = await supabase
    .from("documents")
    .select("id, file_name, page_count, status")
    .eq("id", id)
    .maybeSingle();

  if (!document) notFound();

  const { data: queries } = await supabase
    .from("queries")
    .select("id, question, status, answer, citations, confidence, created_at")
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .range(0, 49);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {document.file_name}
          </h1>
          <p className="font-mono text-xs text-muted-foreground tabular">
            {document.page_count} pages
          </p>
        </div>
        <StatusBadge status={document.status} />
      </div>
      <ChatPanel documentId={id} initialQueries={(queries ?? []) as QueryRow[]} />
    </div>
  );
}
