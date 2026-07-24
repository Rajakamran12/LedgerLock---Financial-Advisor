"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/documents/status-badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { AuditLogEntry, QueryStatus } from "@/lib/types";

const STATUS_TABS: { value: QueryStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "answered", label: "Answered" },
  { value: "refused_out_of_scope", label: "Refused · Scope" },
  { value: "refused_advice_request", label: "Refused · Advice" },
  { value: "insufficient_context", label: "Insufficient context" },
  { value: "error", label: "Error" },
];

const PAGE_SIZE = 20;

export function AuditLogView() {
  const [status, setStatus] = useState<QueryStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (status !== "all") params.set("status", status);

    fetch(`/api/audit-log?${params.toString()}`)
      .then((res) => res.json())
      .then((body) => {
        setEntries(body.entries ?? []);
        setTotal(body.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [status, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={status}
        onValueChange={(v) => {
          setLoading(true);
          setStatus(v as QueryStatus | "all");
          setPage(1);
        }}
      >
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries found.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-foreground">
                  {entry.question}
                </p>
                <StatusBadge status={entry.status} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{entry.documents?.file_name ?? "Unknown document"}</span>
                <span className="font-mono tabular">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => {
            setLoading(true);
            setPage((p) => Math.max(1, p - 1));
          }}
        >
          Previous
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => {
            setLoading(true);
            setPage((p) => p + 1);
          }}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
