import { cn } from "@/lib/utils";

type Tone = "verified" | "refused" | "muted" | "pending";

const TONE_CLASSES: Record<Tone, string> = {
  verified: "text-primary border-primary/30 bg-primary/10",
  refused: "text-destructive border-destructive/30 bg-destructive/10",
  muted: "text-muted-foreground border-border bg-secondary",
  pending: "text-muted-foreground border-border bg-secondary animate-pulse",
};

const DOT_CLASSES: Record<Tone, string> = {
  verified: "bg-primary",
  refused: "bg-destructive",
  muted: "bg-muted-foreground",
  pending: "bg-muted-foreground",
};

export type StatusKind =
  | "answered"
  | "refused_out_of_scope"
  | "refused_advice_request"
  | "insufficient_context"
  | "error"
  | "processing"
  | "ready"
  | "failed";

const LABELS: Record<StatusKind, string> = {
  answered: "Verified",
  refused_out_of_scope: "Refused · Out of scope",
  refused_advice_request: "Refused · Advice request",
  insufficient_context: "Insufficient context",
  error: "Error",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

const TONES: Record<StatusKind, Tone> = {
  answered: "verified",
  refused_out_of_scope: "refused",
  refused_advice_request: "refused",
  insufficient_context: "muted",
  error: "refused",
  processing: "pending",
  ready: "verified",
  failed: "refused",
};

export function StatusBadge({
  status,
  pageNumber,
  className,
}: {
  status: StatusKind;
  pageNumber?: number;
  className?: string;
}) {
  const tone = TONES[status];
  const label = LABELS[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-wide",
        TONE_CLASSES[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])} />
      {label}
      {pageNumber ? ` · p.${pageNumber}` : ""}
    </span>
  );
}
