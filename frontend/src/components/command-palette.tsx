"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FileText, LayoutDashboard, ScrollText, Upload } from "lucide-react";
import type { DocumentRow } from "@/lib/types";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/documents?page=1&pageSize=20")
      .then((res) => (res.ok ? res.json() : { documents: [] }))
      .then((body) => setDocuments(body.documents ?? []))
      .catch(() => setDocuments([]));
  }, [open]);

  const go = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Jump to a document or action"
    >
      <CommandInput placeholder="Search documents or type a command…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="size-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/audit-log")}>
            <ScrollText className="size-4" />
            Audit log
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Documents">
          {documents.map((doc) => (
            <CommandItem
              key={doc.id}
              onSelect={() => go(`/documents/${doc.id}`)}
            >
              <FileText className="size-4" />
              {doc.file_name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/dashboard")}>
            <Upload className="size-4" />
            Upload a document
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
