"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/documents/status-badge";
import type { QueryRow } from "@/lib/types";
import { toast } from "sonner";

export function ChatPanel({
  documentId,
  initialQueries,
}: {
  documentId: string;
  initialQueries: QueryRow[];
}) {
  const [queries, setQueries] = useState<QueryRow[]>(initialQueries);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);

  async function handleAsk() {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    if (trimmed.length > 500) {
      toast.error("Question must be 500 characters or fewer.");
      return;
    }

    setPending(true);
    setWarmingUp(false);
    const optimisticId = `pending-${Date.now()}`;
    setQueries((prev) => [
      {
        id: optimisticId,
        question: trimmed,
        status: "insufficient_context",
        answer: null,
        citations: [],
        confidence: null,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setQuestion("");

    try {
      const res = await fetch(`/api/documents/${documentId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      if (res.status === 503) {
        setWarmingUp(true);
        toast.message("Warming up the AI…", {
          description: "The agent is waking up from a cold start. Retry in a few seconds.",
        });
        setQueries((prev) => prev.filter((q) => q.id !== optimisticId));
        return;
      }

      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "Something went wrong.");
        setQueries((prev) => prev.filter((q) => q.id !== optimisticId));
        return;
      }

      setQueries((prev) =>
        prev.map((q) =>
          q.id === optimisticId
            ? {
                id: optimisticId,
                question: trimmed,
                status: body.status,
                answer: body.answer,
                citations: body.citations ?? [],
                confidence: body.confidence,
                created_at: new Date().toISOString(),
              }
            : q
        )
      );
    } catch {
      toast.error("Network error. Please try again.");
      setQueries((prev) => prev.filter((q) => q.id !== optimisticId));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-1 flex-col-reverse gap-4 overflow-y-auto">
        {queries.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Ask a fact-based question about this document. Advice requests
            and out-of-scope questions will be refused.
          </p>
        ) : (
          queries.map((q) => <QueryEntry key={q.id} query={q} />)
        )}
      </div>
      <div className="flex items-end gap-2 border-t border-border pt-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleAsk();
            }
          }}
          maxLength={500}
          rows={2}
          placeholder="What was net income in FY2023?"
          className="flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button onClick={handleAsk} disabled={pending || !question.trim()}>
          <Send className="size-4" />
          Ask
        </Button>
      </div>
      {warmingUp ? (
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
          Warming up the AI…
        </p>
      ) : null}
    </div>
  );
}

function QueryEntry({ query }: { query: QueryRow }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">{query.question}</p>
      <StatusBadge status={query.status} />
      {query.answer ? (
        <p className="text-sm leading-6 text-foreground">{query.answer}</p>
      ) : query.status === "insufficient_context" ? (
        <p className="text-sm text-muted-foreground">
          This tool only answers from facts stated in the uploaded document —
          it doesn&apos;t have enough information here to answer that.
        </p>
      ) : query.status === "refused_out_of_scope" ? (
        <p className="text-sm text-muted-foreground">
          Nothing in this document clears the confidence bar to answer that
          question — refusing rather than guessing.
        </p>
      ) : query.status === "refused_advice_request" ? (
        <p className="text-sm text-muted-foreground">
          This tool only states facts from the document — it doesn&apos;t
          give investment advice, recommendations, or predictions.
        </p>
      ) : query.status === "error" ? (
        <p className="text-sm text-muted-foreground">
          Something went wrong answering this question. Please try again.
        </p>
      ) : null}
      {query.citations.length > 0 ? (
        <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2">
          {query.citations.map((c, i) => (
            <p key={i} className="font-mono text-xs text-muted-foreground tabular">
              p.{c.pageNumber} — &ldquo;{c.quote}&rdquo;
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
