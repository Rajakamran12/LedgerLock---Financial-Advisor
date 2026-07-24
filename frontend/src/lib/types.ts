export interface DocumentRow {
  id: string;
  file_name: string;
  page_count: number | null;
  status: "processing" | "ready" | "failed";
  failure_reason: string | null;
  created_at: string;
}

export interface CitationRow {
  chunkId: string;
  pageNumber: number;
  quote: string;
}

export type QueryStatus =
  | "answered"
  | "refused_out_of_scope"
  | "refused_advice_request"
  | "insufficient_context"
  | "error";

export interface QueryRow {
  id: string;
  question: string;
  status: QueryStatus;
  answer: string | null;
  citations: CitationRow[];
  confidence: "high" | "medium" | "low" | null;
  created_at: string;
}

export interface AuditLogEntry extends QueryRow {
  documents: { file_name: string } | null;
}
