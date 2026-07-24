# trd.md — Technical Requirements Document

## 1. System Architecture

### 1.1 Components
- **Frontend**: Next.js 16 App Router (server components + API routes), deployed on Vercel.
- **Python AI Agent**: FastAPI service that encapsulates Gemini API calls and guardrail logic, deployed on Render.
- **Database & Auth**: Supabase (PostgreSQL + pgvector + Auth + Storage).
- **Rate Limiter**: Upstash Redis (for frontend), in‑memory token bucket for agent.

### 1.2 Data Flow
1. User uploads PDF → Next.js validates, stores in Supabase Storage, parses text via `unpdf`, chunks it.
2. Next.js sends each chunk’s text to Python agent `/embed` → receives normalised 1536‑dim vector.
3. Embeddings stored in `document_chunks` (pgvector).
4. User asks question → Next.js performs vector search with `match_document_chunks` RPC (RLS‑scoped).
5. If no chunks above threshold, return `refused_out_of_scope`.
6. Else, send question + chunks to Python agent `/query`.
7. Agent runs advice classifier → if advice, return refusal.
8. Agent runs grounded generation with structured output → programmatic verification.
9. Agent returns final status + answer + citations.
10. Next.js logs the result in `queries` table, returns response to user.

### 2. Technology Stack Details

| Component | Technology | Version / Notes |
|---|---|---|
| Frontend | Next.js | 16.2.x (Turbopack) |
| UI | React 19, Tailwind CSS v4, shadcn/ui | |
| Command palette | cmdk | |
| Auth | @supabase/ssr | |
| PDF parsing | unpdf | serverless‑safe |
| Rate limiting | @upstash/ratelimit + Upstash Redis | |
| Validation (frontend) | Zod | |
| Backend (agent) | Python 3.12, FastAPI, uvicorn | |
| LLM SDK | google‑genai (official) | |
| Structured output | Pydantic + Gemini response_schema | |
| Embeddings | gemini-embedding-001 (1536‑dim, L2‑normalised) | |
| Database | Supabase PostgreSQL 15 + pgvector | |
| Deployment | Vercel (frontend), Render (agent) | Free tiers |

### 3. Database Schema (identical to original plan)

*(refer to plan.md Section 7 for complete SQL — no changes)*

### 4. API Specifications

#### 4.1 Frontend Routes
*(identical to plan.md Section 8)*

#### 4.2 Python Agent Endpoints

**Authentication**: All requests must include header `X-Api-Key: <AGENT_API_KEY>`.

**`POST /embed`**
```json
// Request
{ "text": "…" }
// Response 200
{ "embedding": [0.12, -0.34, …] }
// Errors: 401 (missing/invalid key), 422 (validation error)