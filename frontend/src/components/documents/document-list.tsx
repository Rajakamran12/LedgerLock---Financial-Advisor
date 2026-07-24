"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/documents/status-badge";
import type { DocumentRow } from "@/lib/types";
import { toast } from "sonner";

const POLL_INTERVAL_MS = 3000;

export function DocumentList({ initial }: { initial: DocumentRow[] }) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  const router = useRouter();

  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setDocuments(initial);
  }

  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(async () => {
      const res = await fetch("/api/documents?page=1&pageSize=100");
      if (!res.ok) return;
      const body = await res.json();
      setDocuments(body.documents);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [documents]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete document.");
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    toast.success("Document deleted.");
    router.refresh();
  }

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-24 text-center">
        <FileText className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No documents yet. Upload a 10-K, annual report, or earnings release
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <Link
            href={doc.status === "ready" ? `/documents/${doc.id}` : "#"}
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <FileText className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {doc.file_name}
              </p>
              <p className="font-mono text-xs text-muted-foreground tabular">
                {doc.page_count ? `${doc.page_count} pages · ` : ""}
                {new Date(doc.created_at).toLocaleDateString()}
              </p>
              {doc.status === "failed" && doc.failure_reason ? (
                <p className="mt-1 text-xs text-destructive">
                  {doc.failure_reason}
                </p>
              ) : null}
            </div>
          </Link>
          <StatusBadge status={doc.status} />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => handleDelete(doc.id)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
