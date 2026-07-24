
---

```markdown
# milestones.md — Phased Build Plan

## Overview
This build is divided into four milestones, each containing phases that must be completed in order.  
All work is designed to be executed by an autonomous coding agent with minimal intervention.  
The commit messages below are required at the end of each phase.

---

## Milestone 1 — Foundation
*Goal: App exists, auth‑protected, with a working, RLS‑secured database.*

### Phase 0 — Bootstrap
- [ ] Create Next.js project with TypeScript and Tailwind.
- [ ] Init Git, confirm `.env*.local` gitignored.
- [ ] Obtain Google AI Studio API key, create Supabase project, create Upstash Redis database.
- [ ] Write `.env.example` for both frontend and agent.

**Acceptance**: `npm run dev` shows default page; `git status` excludes secrets.  
**Commit**: `chore: bootstrap Next.js 16 project`

### Phase 1 — Auth skeleton
- [ ] Install `@supabase/ssr`, set up browser/server clients.
- [ ] Implement login/sign‑up pages, `proxy.ts` for session refresh, protected `(app)` routes.
- [ ] Enforce `getUser()` on all server‑side operations.

**Acceptance**: User can sign up, log in, visit `/dashboard`; unauthenticated visits redirect.  
**Commit**: `feat: add Supabase auth with protected app shell`

### Phase 2 — Schema & RLS
- [ ] Apply migration from `supabase/migrations/0001_init.sql` (same as plan.md Section 7).
- [ ] Verify RLS blocks cross‑user reads with a second test account.
- [ ] Test `match_document_chunks` with a dummy vector.

**Acceptance**: Second user cannot see first user’s rows.  
**Commit**: `feat: add database schema, RLS, and vector search RPC`

---

## Milestone 2 — Core Pipeline
*Goal: End‑to‑end functionality for one user, every guardrail layer operative.*

### Phase 3 — Upload → parse → chunk → embed
- [ ] Build `POST /api/documents`: file validation, storage, parsing with `unpdf`.
- [ ] Implement text chunking (500 tokens, 75 overlap).
- [ ] Build the Python agent’s `/embed` endpoint (using Google Gemini).
- [ ] From the API route, call the agent for each chunk, store embeddings in Supabase.
- [ ] Add status polling; handle “scanned PDF” detection.
- [ ] Dashboard list/upload UI.

**Acceptance**: Upload a real 10‑K → `status='ready'` with populated chunks; invalid file → `400`.  
**Commit**: `feat: implement PDF upload, parsing, chunking, and embedding pipeline`

### Phase 4a — Python agent core
- [ ] Create FastAPI project, set up `schemas.py`, `classifier.py`, `generator.py`, `verifier.py`, `embedder.py`.
- [ ] Implement `/embed` endpoint.
- [ ] Implement `/query` endpoint with the full guardrail pipeline.
- [ ] Add rate limiting (token bucket) and API key validation.
- [ ] Unit tests for classifier, verifier.

**Acceptance**: `pytest` passes; manual cURL shows correct classification and verification.  
**Commit**: `feat: Python agent with guardrails and Gemini integration`

### Phase 4b — Integrate agent with frontend
- [ ] In the Next.js query route, after retrieval, call agent `/query`.
- [ ] Handle agent cold‑start with retry and UI feedback (“Warming up the AI…”).
- [ ] Log result in `queries` table.
- [ ] Build chat UI with status tags, citation display, and distinct refusal styling.

**Acceptance**: Fact question returns cited answer; advice question refused; out‑of‑scope refused.  
**Commit**: `feat: integrate Python agent for grounded Q&A, full guardrail pipeline`

---

## Milestone 3 — Production Readiness
*Goal: Secure, polished, tested, and demo‑ready.*

### Phase 5 — Security hardening
- [ ] Add security headers in `next.config.ts`.
- [ ] Run `npm audit` and `pip audit`; update deps.
- [ ] Verify no secrets in production builds.
- [ ] Re‑check every route’s auth/rate‑limit/validation/ownership.

**Acceptance**: Clean securityheaders.com grade; no secrets leaked.  
**Commit**: `chore: security hardening`

### Phase 6 — Audit log, command palette, polish
- [ ] Build audit log page with pagination and status filter.
- [ ] Integrate `cmdk` ⌘K palette for quick navigation.
- [ ] Add empty, loading, error states per UX spec.
- [ ] Responsive fixes.

**Acceptance**: Audit log shows all refusals; ⌘K works globally.  
**Commit**: `feat: audit log and command palette`

### Phase 7 — Testing
- [ ] Write unit tests for frontend pagination, classifier, verifier (both JS and Python).
- [ ] Integration tests for API routes (use mocked agent).
- [ ] One Playwright E2E test: sign up → upload → ask fact → get cited answer → ask advice → get refusal → check audit log.

**Acceptance**: All tests pass.  
**Commit**: `test: add unit, integration, and e2e coverage`

---

## Milestone 4 — Ship
*Goal: Live on free tiers, documented.*

### Phase 8 — Deploy & document
- [ ] Push code to GitHub.
- [ ] Deploy frontend to Vercel, set env vars.
- [ ] Deploy agent to Render, set env vars.
- [ ] Apply migrations to production Supabase.
- [ ] Full smoke test on production.
- [ ] Write `README.md`: problem statement, architecture diagram, screenshots, engineering decisions, live link.

**Acceptance**: Production URL works end‑to‑end, $0/month, README tells the story.  
**Commit**: `docs: add README and tag v1.0.0`