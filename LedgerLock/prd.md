
---

```markdown
# prd.md — Product Requirements Document

## 1. Overview
**LedgerLock** is a single‑document financial Q&A tool that **forces strict adherence to the uploaded document**. It answers fact‑based questions with inline citations and refuses any question that asks for investment advice or that cannot be answered from the document. Every refusal is logged and visible in an audit trail.

## 2. User Roles
- **End User** (document owner): uploads a PDF, asks questions, sees answers or refusals.
- **Not applicable**: no admin or multi‑tenant management in v1.

## 3. Functional Requirements

### 3.1 Authentication & Access
- FR‑01: Users must sign up / log in via email/password.
- FR‑02: All document data and queries are private to the authenticated user.

### 3.2 Document Management
- FR‑03: Upload a single PDF (max 20 MB, must be text‑based).
- FR‑04: See a list of own documents with status (processing / ready / failed).
- FR‑05: Delete a document.

### 3.3 Q&A with Guardrails
- FR‑06: Ask a question about the uploaded document (max 500 chars).
- FR‑07: The system answers **only** with information literally present in the document, citing page number and verbatim snippet.
- FR‑08: If the document lacks enough information, the system refuses with status `insufficient_context` or `refused_out_of_scope` (no hallucination).
- FR‑09: If the question seeks investment advice, recommendation, or prediction, the system refuses with `refused_advice_request`.
- FR‑10: Every answer or refusal is logged with timestamp, question, status, and answer (if any).

### 3.4 Audit Log
- FR‑11: User can view a paginated audit log of all their past queries across all documents.
- FR‑12: Log can be filtered by status (answered, refused, etc.).

### 3.5 UI/UX
- FR‑13: Dark‑first, Linear‑inspired design with a command palette (⌘K) for quick navigation.
- FR‑14: Clear status tags on every response: “Verified · p.47” or “Refused · Advice request”.
- FR‑15: Responsive layout; works on desktop and tablet.

## 4. Non‑Functional Requirements
- NFR‑01: **Security**: Secrets never exposed, authentication enforced, row‑level security, input validation.
- NFR‑02: **Performance**: Initial answer latency < 5 seconds after model warm‑up.
- NFR‑03: **Availability**: System tolerates free‑tier cold starts (agent wakes in < 30s).
- NFR‑04: **Compliance**: Every refusal is enforced programmatically, not by prompt.
- NFR‑05: **Zero cost**: Entire system runs on free tiers without credit card.

## 5. Out of Scope
- Multi‑document support, OCR, streaming raw model output, admin panel.