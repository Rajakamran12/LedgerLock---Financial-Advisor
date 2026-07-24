open plan.md and read and analyzed it.

The Python agent is treated as an internal microservice — it only ever receives calls from the Next.js server, never from the browser.
It exposes exactly two endpoints:

POST /embed — returns normalised 1536‑dim vector

POST /query — runs classification, generation, verification and returns the final result

All retrieval, database writes, and user authentication happen before data is sent to the agent.

6.1 Layer 1 — Retrieval gate 
The Next.js app runs the vector search and only sends chunks to the agent if something clears the threshold. If not, it refuses without calling the agent.

6.2 Layer 2 — Advice‑request classifier
# agent/classifier.py
from pydantic import BaseModel
import google.generativeai as genai

class AdviceClassification(BaseModel):
    isAdviceRequest: bool
    reasoning: str

ADVICE_KEYWORDS = ["should i buy", "should i invest", "good investment", ...]

def looks_like_advice_request(question: str) -> bool:
    return any(kw in question.lower() for kw in ADVICE_KEYWORDS)

async def classify_advice_request(question: str) -> AdviceClassification:
    if looks_like_advice_request(question):
        return AdviceClassification(isAdviceRequest=True, reasoning="matched keyword filter")
    model = genai.GenerativeModel(os.getenv("CHAT_MODEL"))
    prompt = "Classify if the following asks for investment advice...\n" + question
    # use response_schema for structured output
    ...

6.3 Layer 3 — Grounded, structured generation
class Citation(BaseModel):
    chunkId: str
    pageNumber: int
    quote: str = Field(max_length=240)

class ExtractionResult(BaseModel):
    status: Literal["answered", "insufficient_context"]
    answer: Optional[str]
    citations: list[Citation]
    confidence: Optional[Literal["high","medium","low"]]
The agent builds a system prompt identical to the original and uses Gemini’s controlled generation to guarantee the output matches the schema.

6.4 Layer 4 — Programmatic verification (still code, not a model)
def verify_extraction(result: ExtractionResult, chunks_by_id: dict[str, str]) -> tuple[bool, Optional[str]]:
    if result.status != "answered":
        return True, None
    if not result.citations:
        return False, "zero citations"
    for citation in result.citations:
        source = chunks_by_id.get(citation.chunkId)
        if not source:
            return False, f"unknown chunk {citation.chunkId}"
        if citation.quote.lower() not in source.lower():
            return False, "quote not found verbatim"
    return True, None
If verification fails, the agent returns status=refused_out_of_scope to the frontend.

6.5 Orchestration endpoint
# POST /query
async def handle_query(req: QueryRequest):
    # run classifier
    if (await classify_advice_request(req.question)).isAdviceRequest:
        return {"status": "refused_advice_request", "answer": None, ...}
    # run generation
    extraction = await generate_grounded_answer(req.question, req.chunks)
    chunks_by_id = {c.chunkId: c.content for c in req.chunks}
    ok, reason = verify_extraction(extraction, chunks_by_id)
    if not ok:
        return {"status": "refused_out_of_scope", ...}
    return extraction.dict()

7. Database Schema (identical to original)
-- supabase/migrations/0001_init.sql
create extension if not exists vector;

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  page_count integer,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  created_at timestamptz not null default now()
);
create index documents_user_id_idx on documents(user_id);

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  page_number integer not null,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding vector(1536), -- gemini-embedding-001, output_dimensionality: 1536, L2-normalized in app code
  created_at timestamptz not null default now()
);
create index document_chunks_document_id_idx on document_chunks(document_id);
create index document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);

create table queries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  status text not null check (status in
    ('answered','refused_out_of_scope','refused_advice_request','insufficient_context','error')),
  answer text,
  citations jsonb not null default '[]',
  confidence text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index queries_user_id_idx on queries(user_id);
create index queries_document_id_idx on queries(document_id);
create index queries_status_idx on queries(status);
create index queries_created_at_idx on queries(created_at desc);

-- Row-Level Security: the database-layer half of authorization
alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table queries enable row level security;

create policy "own documents only" on documents for all
  using (auth.uid() = user_id);

create policy "own chunks only" on document_chunks for all
  using (exists (
    select 1 from documents
    where documents.id = document_chunks.document_id
    and documents.user_id = auth.uid()
  ));

create policy "own queries only" on queries for all
  using (auth.uid() = user_id);

-- Vector similarity search, authorization-scoped in the query itself
-- (PostgREST can't run vector operators, so this has to be an RPC function)
create or replace function match_document_chunks (
  p_document_id uuid,
  p_user_id uuid,
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (id uuid, page_number int, content text, similarity float)
language plpgsql security definer as $$
begin
  return query
  select dc.id, dc.page_number, dc.content,
         1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where dc.document_id = p_document_id
    and d.user_id = p_user_id  -- ownership re-checked even though RLS already covers it
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;

8. API Contract (frontend unchanged, agent specs added)
8.1 Next.js routes — same as original

| Method | Path | Rate Limit | Notes |
|--------|------|------------|-------|
| **POST** | `/api/documents` | 10/hour/user | Upload, validate, parse, chunk, embed via agent |
| **GET** | `/api/documents` | 60/min/user | Paginated list |
| **GET** | `/api/documents/:id` | 60/min/user | Document metadata |
| **DELETE** | `/api/documents/:id` | 30/min/user | Delete document |
| **POST** | `/api/documents/:id/query` | 20/min/user | Calls Python agent, logs result |
| **GET** | `/api/documents/:id/queries` | 60/min/user | Chat history |
| **GET** | `/api/audit-log` | 60/min/user | Filterable audit log |

8.2 Python Agent endpoints (internal)
Base URL: https://ledgerlock-agent.onrender.com (or localhost:8000 in dev)

Authentication: header X-Api-Key matching AGENT_API_KEY env var.

POST /embed
Request: { "text": "..." }

Response: { "embedding": [0.12, -0.34, ...] }

POST /query
Request: { "question": "what was revenue?", "chunks": [ { "chunkId": "uuid", "pageNumber": 3, "content": "..." }, ... ] }

Response: { "status": "answered|refused_advice_request|refused_out_of_scope|insufficient_context", "answer": "…", "citations": [ { "chunkId": "…", "pageNumber": 3, "quote": "…" } ], "confidence": "high" }

All guardrails run inside this single call.

9. Environment variables

# Next.js (.env.local)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
AGENT_API_KEY=                        # shared secret to call the Python agent
AGENT_URL=http://localhost:8000       # in production: https://ledgerlock-agent.onrender.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Python agent (.env)
GOOGLE_GENERATIVE_AI_API_KEY=
CHAT_MODEL=gemini-flash-latest
EMBEDDING_MODEL=gemini-embedding-001
AGENT_API_KEY=                       # must match the one in Next.js

9a. Free‑tier map (updated)
Gemini API — unchanged free tier.

Supabase — unchanged.

Vercel — unchanged.

Upstash — unchanged.

Render (for Python agent) — free tier includes 750 hours of runtime per month (single instance), enough for a demo. Sleeps after 15 min of inactivity, wakes on request (cold start ~30s). This is acceptable; the UI can show a “warming up” state.

10. UI / UX design direction — Linear-inspired

Linear's own design language is worth borrowing wholesale for the discipline, not the exact palette — a re-skinned Linear clone reads as generic in a different way. Keep the structural rules, swap the one accent color so this reads as its own product.

What to take directly from Linear:

Dark by default, near-black canvas — 
#0A0A0C for the base, 
#151517 for raised panels — not pure 
#000000 (which looks like a broken screen, not a design choice).
One saturated accent color, used sparingly — never for decoration, never for more than one primary action per screen. Linear's is indigo (
#5E6AD2); LedgerLock's is 
#33C481, a clean verification-green, so the accent itself carries meaning ("this is the trustworthy/confirmed color") rather than being an arbitrary brand hue.
Hairline 1px borders instead of shadows for elevation and separation — 
#232326 on the dark surfaces.
Inter Variable, loaded via next/font/google, with font-feature-settings: "cv01", "ss03" enabled globally in :root — this is the specific detail that makes Linear's type feel different from the thousand other products also using Inter (single-story "a", geometric alternates). Don't skip this line; it's most of the effect.
Small, consistent border-radius (6–8px) — precise, not bubbly, not brutalist-sharp either.
Fast, restrained motion — 150–200ms eases, nothing decorative.
A ⌘K command palette (via cmdk) for jumping between documents and firing common actions — genuinely useful here (fast navigation between filings) and an immediate, honest "this person has real product taste" signal in a demo.

What's specific to LedgerLock, not borrowed:

Text colors: 
#F2F3F5 primary, 
#8A8F98 secondary/muted (a very usable neutral gray regardless of product).
Refusal/destructive state: a clean, restrained red (
#F2555A) — used only for refusals and destructive actions, same one-job-per-color discipline as the accent.
Numeric data — every dollar figure, page reference, and timestamp — set in a monospace face (Geist Mono or JetBrains Mono) for tabular alignment. Linear's system doesn't need this; a financial-figures product does.
Signature element: a small pill-shaped status tag on every answer and refusal — a colored dot plus a mono uppercase label, e.g. ● Verified · p.47 in the verification-green, ● Refused · Out of scope in the refusal-red. This directly mirrors how Linear's actual product UI (not its marketing site) tags issue states and priorities — the same interaction pattern, pointed at a different kind of status.

Pages: landing → /login / /sign-up → /dashboard (document list + upload, ⌘K reachable from anywhere) → /documents/[id] (chat + citations + status tags) → /audit-log (paginated, filterable by status).

Copy voice: active, specific, never apologetic — Linear's own writing is exactly this. A refusal says "This tool only answers from facts stated in the uploaded document — it doesn't have enough information here to answer that," not "I'm sorry, I don't think I can help with that." Errors state what happened and how to fix it; they don't hedge.

11. Folder structure
ledgerlock/
├── frontend/                     # Next.js app
│   ├── .env.example
│   ├── next.config.ts
│   ├── src/
│   │   ├── proxy.ts
│   │   ├── app/...
│   │   └── lib/...
│   └── tests/...
├── agent/                        # Python FastAPI microservice
│   ├── .env.example
│   ├── requirements.txt
│   ├── main.py
│   ├── classifier.py
│   ├── generator.py
│   ├── verifier.py
│   ├── embedder.py
│   └── schemas.py
├── supabase/
│   └── migrations/...
└── plan.md

12. Build milestones (summarised — full milestones.md is separate)
The same four milestones apply, but with added phases for the Python agent:

M1 — Foundation (same as before)
M2 — Core Pipeline (split)

Phase 3: Frontend upload, parse, chunk. Add route that calls agent /embed.

Phase 4a: Build Python agent (classifier, generator, verifier).

Phase 4b: Integrate agent query endpoint into Next.js.
M3 — Production Readiness
M4 — Ship

open prd.md and trd.md and read and analyzed it.

POST /query

// Request
{
  "question": "what was net income in FY2023?",
  "chunks": [
    {
      "chunkId": "uuid1",
      "pageNumber": 3,
      "content": "… excerpt from page 3 …"
    }
  ]
}
// Response 200
{
  "status": "answered",
  "answer": "Net income was $97 billion.",
  "citations": [
    { "chunkId": "uuid1", "pageNumber": 3, "quote": "Net income increased to $97 billion" }
  ],
  "confidence": "high"
}
// Possible statuses: answered, refused_advice_request, refused_out_of_scope, insufficient_context
// Errors: 422 (bad shape), 500 (LLM failure)

5. Security Implementation
Secrets: Stored in Vercel & Render environment variables, never in source.

Frontend‑agent communication: Only the Next.js server knows the agent URL and API key; the agent rejects any request without the key.

Authorization: Next.js routes always call supabase.auth.getUser(), then enforce ownership; agent trusts the chunks it receives (they have been pre‑filtered).

Row‑Level Security: All database policies are enforced in Supabase as per original schema.

Input validation: Pydantic models on agent side reject malformed payloads.

Rate limiting: Dual layer — Upstash for frontend, token bucket in agent (max 30 req/min).

6. Error Handling & Resilience
The frontend handles agent cold‑start gracefully: if agent times out (sleeping), it retries once with a delay, showing a “warming up” message.

Gemini API errors return a generic “error” status and are logged.

7. Testing Strategy
Unit tests: Python agent functions (classifier, verifier) with pytest; frontend utility functions with Vitest.

Integration tests: Next.js API routes with mocked agent, verifying proper status propagation.

End‑to‑end: Playwright test covering upload → question → citation verification → refusal → audit log.

8. Deployment Configuration
Frontend: vercel --prod with environment variables.

Agent: Render Web Service, build command pip install -r requirements.txt, start command uvicorn main:app --host 0.0.0.0 --port 8000. Set environment variables in Render dashboard.

Supabase: Run migrations via supabase db push.

