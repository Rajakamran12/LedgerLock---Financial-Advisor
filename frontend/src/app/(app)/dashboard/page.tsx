import { createClient } from "@/lib/supabase/server";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { DocumentList } from "@/components/documents/document-list";
import type { DocumentRow } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id, file_name, page_count, status, failure_reason, created_at")
    .order("created_at", { ascending: false })
    .range(0, 99);

  const documents = (data ?? []) as DocumentRow[];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Upload a document, then ask it questions once it&apos;s ready.
          </p>
        </div>
        <UploadDialog />
      </div>
      <DocumentList initial={documents} />
    </div>
  );
}
