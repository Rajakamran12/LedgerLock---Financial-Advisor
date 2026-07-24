# plan.md — LedgerLock with Python Agent

> **Revision note:** This plan replaces the in‑process TypeScript guardrails with a **Python FastAPI microservice** that handles embeddings, advice classification, grounded generation, and programmatic verification.  
> The frontend remains Next.js 16 (App Router, TypeScript, React 19). Supabase continues to be the unified backend (Auth, DB, Storage, pgvector).  
> The document is written for an autonomous coding agent to execute with minimal hand‑holding.  
> **Every section is meant to be a complete specification; do not stop to ask for decisions already made herein.**

---

## 1. Why this project (the pitch)
*(unchanged – the value proposition remains the same, only the implementation shifts)*

Every AI hiring manager has seen a “chat with your PDF” demo. What they haven’t seen is a portfolio project that **understands why enterprises are afraid to ship that demo to production**: because a model that will cheerfully make up a revenue figure, or casually suggest a stock is a “good buy,” is a compliance liability, not a feature.

LedgerLock is deliberately narrow. It ingests one dense financial document (a 10‑K, an annual report, an earnings release) and answers questions about it — and it is built so that it **cannot** answer with a number that isn’t in the document, and **cannot** answer a question that asks for financial advice. Not “prompted not to” — architecturally prevented, with the refusal enforced by code that runs after the model, now **in a dedicated Python service** that the frontend cannot bypass.

The interview story remains: *“I didn’t just call an LLM and hope. I built a pipeline where hallucination and advice‑giving are structurally blocked, and I can show you the test that proves it — and I built the whole thing without spending a dollar, which meant designing around real free‑tier constraints instead of an unlimited budget.”*

Now the story adds: *“I separated the AI‑critical path into a Python microservice, giving me complete control over structured output and verification while keeping the Next.js frontend lean — and I deployed it all on free tiers.”*

---

## 2. Scope

**In scope (v1):**
- Single‑document upload and Q&A (one PDF at a time, re‑askable any number of times)
- Strict, citation‑backed answers grounded only in the uploaded document
- Hard refusal of investment‑advice‑style questions
- Hard refusal of questions the document doesn’t answer
- Full auth, per‑user data isolation, rate limiting, input validation, pagination
- An audit log screen showing every refusal and why
- Runs end‑to‑end on free tiers

**Explicitly out of scope for v1:**
- Multi‑document comparison / cross‑referencing
- OCR for scanned (image‑only) PDFs — detect and message clearly when not text‑based
- Fine‑tuning or self‑hosting a model
- Admin panel for managing other users

---

## 3. Security requirements (unchanged in spirit, adapted for split architecture)

All the original security requirements remain, now extended to protect the Python agent:
- **Secrets**: All keys (Google AI, Supabase service role) live in environment variables of the respective service; never exposed to the browser.
- **Rate limiting**: All Next.js mutating routes and the Python agent endpoint are rate‑limited (Upstash Redis for Next.js, a simple token‑bucket inside the agent using environment‑based limits).
- **Input validation**: Zod on the Next.js side, Pydantic on the Python side.
- **Authentication & authorization**: Supabase Auth; every Next.js route handler verifies `getUser()` and resource ownership (404 for unauthorised).
- **Python agent authorisation**: The agent is called only from server‑side Next.js; it accepts a pre‑signed internal API key (stored in env) to reject direct external calls.

---

## 4. Tech stack — free tier everywhere

| Layer | Choice | Rationale |
|---|---|---|
| **Frontend** | Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4, shadcn/ui, cmdk | Proven, free deployment on Vercel Hobby. |
| **AI Agent** | Python 3.12+ with FastAPI, Google’s official `google‑genai` SDK, Pydantic for schemas | Full control over guardrails, structured output, and verification logic. |
| **Auth + DB + Storage + Vector** | Supabase (free Hobby project) — Postgres, pgvector, Auth, Storage | One account, zero dollars. |
| **Embedding & LLM** | Google Gemini API (`gemini-embedding-001`, `gemini-flash-latest`) via the Python agent | Genuinely free, no credit card. |
| **Rate limiting (frontend)** | Upstash Redis + `@upstash/ratelimit` | Free daily command allowance. |
| **Rate limiting (agent)** | In‑memory token bucket (server restarts clear it; acceptable for free‑tier single‑instance) | Keeps the agent self‑contained. |
| **PDF parsing** | `unpdf` on the Next.js side (as before) | Serverless‑safe; text extraction stays in Node land. |
| **Testing** | Vitest + Playwright for frontend; pytest + httpx for Python agent | Both free. |
| **Deployment** | Vercel (frontend), Render (Python agent) | Both have genuine free tiers. |

---

## 5. Architecture (high‑level)

```mermaid
flowchart TB
    subgraph Frontend
        Browser --> NextJS[Next.js App Router]
        NextJS --> Proxy[session refresh only]
        NextJS --> Auth[Supabase Auth]
        NextJS --> API[API Routes]
    end

    subgraph Supabase
        DB[(Postgres + pgvector)]
        Storage[Private Bucket]
    end

    subgraph "Python Agent (Render)"
        PyAgent[FastAPI]
        PyAgent --> Gemini[Google Gemini API]
    end

    NextJS -- "1. Upload PDF" --> PDFParse[parse, chunk]
    PDFParse --> PyAgent[/embed]
    PyAgent --> DB

    NextJS -- "2. Query" --> RateLimit[Upstash]
    RateLimit --> Ownership[ownership check + retrieval]
    Ownership --> PyAgent[/query] --> Verify[verification in Python]
    PyAgent --> Answer[answer / refusal]
    Answer --> QueriesTable[(queries)]