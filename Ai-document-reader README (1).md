# AI Document Reader DB — Source of Truth

> **This README is the single source of truth for the project.**
> When in doubt, come back here. Do not proceed from memory.

---

## Table of Contents

1. [What We Are Building](#1-what-we-are-building)
2. [Why This Exists](#2-why-this-exists)
3. [The Golden Rules](#3-the-golden-rules)
4. [Full Stack at a Glance](#4-full-stack-at-a-glance)
5. [System Architecture](#5-system-architecture)
6. [RAG Pipeline (Core Logic)](#6-rag-pipeline-core-logic)
7. [Phase Roadmap](#7-phase-roadmap)
8. [Current Phase Tracker](#8-current-phase-tracker)
9. [Development Philosophy](#9-development-philosophy)
10. [Folder Structure Conventions](#10-folder-structure-conventions)
11. [Environment Variables Master List](#11-environment-variables-master-list)
12. [Database Design Principles](#12-database-design-principles)
13. [API Design Standards](#13-api-design-standards)
14. [Security Non-Negotiables](#14-security-non-negotiables)
15. [Testing Standards](#15-testing-standards)
16. [Definition of Done](#16-definition-of-done)
17. [What We Never Do](#17-what-we-never-do)
18. [Handoff Checklist](#18-handoff-checklist)
19. [Glossary](#19-glossary)
20. [Decision Log](#20-decision-log)

---

## 1. What We Are Building

**AI Document Reader DB** is an AI-powered document knowledge platform.

Users can:

- Upload **PDF**, **DOCX**, and **Image** documents
- Extract and store text securely
- Generate vector embeddings from document content
- Perform **semantic search** across documents
- **Chat with documents** using natural language
- Receive answers **strictly grounded in document content** (no hallucinations)
- View document summaries and metadata
- Manage document collections
- Manage their profile and settings

**Comparable systems:** ChatPDF · NotebookLM · PrivateGPT · LangChain RAG apps

---

## 2. Why This Exists

Organizations deal with large volumes of documents. Searching, reading, and extracting insights from them manually is slow and error-prone. This platform allows users to treat their document library as a queryable knowledge base — powered by AI but grounded strictly in real content.

---

## 3. The Golden Rules

> Read these before every coding session.

1. **Build one phase at a time.** Never jump ahead.
2. **No code before an approved plan.** Always teach → plan → code.
3. **The AI must never hallucinate.** Answers come only from retrieved document chunks. If information is missing: *"I could not find this information in the uploaded documents."*
4. **This is a production system.** No shortcuts, no TODOs left in production code.
5. **Feature-based folder structure always.** No layer-based folders (`controllers/`, `services/`).
6. **Every architectural decision must be documented** in the [Decision Log](#20-decision-log).
7. **Scope creep is the enemy.** The [What NOT To Build](#17-what-we-never-do) section is enforced.
8. **App Router only.** No Pages Router code. No mixing of the two.
9. **Server Components by default.** Only opt into `"use client"` when you have a specific reason. Document that reason inline.

---

## 4. Full Stack at a Glance

### Frontend

| Concern | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.6 |
| Styling | Tailwind CSS 4 |
| Server State | TanStack Query 5 |
| Client State | Zustand |
| HTTP Client | Axios (client) / fetch (server components) |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |

> **No Shadcn UI. No Radix UI. No component library.**
> All UI components are hand-built with Tailwind CSS. This is intentional — see [DL-005](#dl-005--tailwind-css-only-no-component-library).

### Backend

| Concern | Technology |
|---|---|
| Runtime | Node.js 22 LTS |
| Framework | NestJS 11 |
| Language | TypeScript 5.6 |
| Database | PostgreSQL 16 + PGVector |
| ORM | Prisma |
| Cache / Queue Broker | Redis 7 |
| Background Jobs | BullMQ |
| Auth | JWT + Passport |
| File Uploads | Multer |
| API Docs | Swagger (OpenAPI) |
| Validation | Class Validator + Class Transformer |

### AI Stack

| Concern | Technology |
|---|---|
| LLM | Ollama — Llama 3.1 8B |
| Embeddings | nomic-embed-text / bge-small-en-v1.5 |
| RAG Orchestration | LangChain JS |
| PDF Parsing | pdf-parse |
| DOCX Parsing | mammoth |
| Image OCR | tesseract.js |

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 15 Frontend                   │
│         App Router · Server Components · Tailwind        │
│         TanStack Query (client) · Zustand (client)       │
└───────────────────────┬─────────────────────────────────┘
                        │ REST / JSON
                        │ (Axios from Client Components)
                        │ (fetch from Server Components)
┌───────────────────────▼─────────────────────────────────┐
│                    NestJS API Server                     │
│          Auth · Documents · Search · Chat                │
│               BullMQ Workers (background)                │
└──────┬──────────────────────────────────┬───────────────┘
       │                                  │
┌──────▼──────┐                  ┌────────▼──────────────┐
│ PostgreSQL  │                  │        Redis 7         │
│ 16 +        │                  │  Cache · Queue Broker  │
│ PGVector    │                  └───────────────────────┘
└─────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│                    Ollama (local LLM)                    │
│        Llama 3.1 8B · nomic-embed-text                   │
└─────────────────────────────────────────────────────────┘
```

### Next.js Rendering Decision Tree

```
Is the component fetching data that doesn't need to be interactive?
  └── YES → Server Component (default, no "use client")
        └── Does it need user interaction (click, input, state)?
              └── YES → Client Component ("use client" at the leaf)
                    └── Does it need data from the API?
                          └── YES → TanStack Query useQuery hook
                          └── NO  → Local useState / useReducer
```

**Rule:** Push `"use client"` as far down the tree as possible. Server Components fetch data; Client Components handle interaction.

---

## 6. RAG Pipeline (Core Logic)

This is the heart of the system. Every engineer must understand this flow.

```
User Uploads Document
        │
        ▼
 Document Processing
 (pdf-parse / mammoth / tesseract.js)
        │
        ▼
   Text Chunking
 (fixed-size + overlap strategy)
        │
        ▼
 Embedding Generation
 (nomic-embed-text via Ollama)
        │
        ▼
 Store Chunks + Embeddings
        │
        ▼
     PGVector
 (pgvector extension in PostgreSQL)
        │
        ▼
──────────── QUERY TIME ────────────
        │
 User asks a question
        │
        ▼
 Embed the question
        │
        ▼
 Cosine Similarity Search
 (top-k chunks retrieved from PGVector)
        │
        ▼
 Inject chunks into LLM prompt as context
        │
        ▼
 Llama 3.1 8B generates answer
        │
        ▼
 Return answer + source citations
```

**Invariant:** The LLM prompt always contains the instruction:
> *"Only answer based on the provided context. If the answer is not in the context, respond: 'I could not find this information in the uploaded documents.'"*

---

## 7. Phase Roadmap

| Phase | Name | Status |
|---|---|---|
| 1 | Project Foundation | ⬜ Not Started |
| 2 | Authentication & User Management | ⬜ Not Started |
| 3 | Document Upload Infrastructure | ⬜ Not Started |
| 4 | Document Storage & Metadata | ⬜ Not Started |
| 5 | PDF / DOCX / Image Extraction | ⬜ Not Started |
| 6 | Chunking Strategy | ⬜ Not Started |
| 7 | Embedding Generation | ⬜ Not Started |
| 8 | PGVector Integration | ⬜ Not Started |
| 9 | Semantic Search | ⬜ Not Started |
| 10 | RAG Pipeline | ⬜ Not Started |
| 11 | Document Chat | ⬜ Not Started |
| 12 | Conversation History | ⬜ Not Started |
| 13 | Document Collections | ⬜ Not Started |
| 14 | Analytics Dashboard | ⬜ Not Started |
| 15 | Admin Panel | ⬜ Not Started |
| 16 | Observability & Monitoring | ⬜ Not Started |
| 17 | Performance Optimization | ⬜ Not Started |
| 18 | Production Deployment | ⬜ Not Started |

> Update status to 🔄 In Progress or ✅ Complete as work proceeds.

---

## 8. Current Phase Tracker

```
CURRENT PHASE:   [ PHASE 1 — Project Foundation ]
STARTED:         [ DATE ]
COMPLETED:       [ DATE ]
NEXT PHASE:      [ PHASE 2 — Authentication & User Management ]
```

**Before marking a phase complete, the [Definition of Done](#16-definition-of-done) must be satisfied.**

---

## 9. Development Philosophy

### Incremental by Default

Never generate the entire application at once. Implement exactly the current phase. The next phase will always be visible in the roadmap.

### Teach Before You Code

For every phase:
1. Explain the feature requirements and business value
2. Explain architectural decisions and tradeoffs
3. Share the implementation plan
4. Get approval
5. Only then write code

### Production Standards Always

There is no "we'll fix it later." Code written today must be production-grade:

- Proper error handling
- Logging at appropriate levels
- Input validation on every endpoint
- No hardcoded secrets
- No `any` types in TypeScript

### Server Components Are the Default

In Next.js App Router, every component is a Server Component unless explicitly marked `"use client"`. This is not optional — it is the architecture. Benefits:

- Zero JavaScript sent to the browser for data-fetching components
- Direct access to backend data without an extra API hop (where appropriate)
- Better SEO and initial page load performance

When you add `"use client"`, leave a comment explaining why:

```tsx
// "use client" — needed for drag-and-drop file upload interaction
"use client";
```

### Explain Every Decision

Every non-obvious decision gets documented in the [Decision Log](#20-decision-log). Future engineers (and your future self) will need to understand why.

---

## 10. Folder Structure Conventions

### Frontend (Next.js App Router) — Feature-Based

```
src/
├── app/                          ← App Router: all routes live here
│   ├── (auth)/                   ← Route group: no layout, no URL segment
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/              ← Route group: shared dashboard layout
│   │   ├── layout.tsx
│   │   ├── documents/
│   │   │   ├── page.tsx          ← Server Component: fetch + render list
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── upload/
│   │   │       └── page.tsx
│   │   ├── search/
│   │   │   └── page.tsx
│   │   ├── chat/
│   │   │   └── [documentId]/
│   │   │       └── page.tsx
│   │   └── collections/
│   │       └── page.tsx
│   ├── api/                      ← Next.js Route Handlers (if needed for BFF)
│   ├── layout.tsx                ← Root layout
│   ├── page.tsx                  ← Landing / redirect
│   └── not-found.tsx
│
├── features/                     ← Feature-scoped logic
│   ├── auth/
│   │   ├── components/           ← Client Components for login form, etc.
│   │   ├── hooks/                ← useLogin, useRegister (TanStack Query mutations)
│   │   ├── store/                ← Zustand slice for auth state (token, user)
│   │   └── api/                  ← Axios calls to NestJS auth endpoints
│   ├── documents/
│   │   ├── components/           ← DocumentCard, DocumentList, UploadDropzone
│   │   ├── hooks/                ← useDocuments, useUploadDocument
│   │   ├── store/                ← Zustand slice (upload progress, selected doc)
│   │   └── api/
│   ├── search/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   ├── chat/
│   │   ├── components/           ← ChatWindow, MessageBubble, ChatInput
│   │   ├── hooks/                ← useChat, useSendMessage
│   │   ├── store/                ← Zustand slice for conversation state
│   │   └── api/
│   └── collections/
│       ├── components/
│       ├── hooks/
│       └── api/
│
├── shared/
│   ├── components/               ← Button, Input, Modal, Spinner, etc.
│   ├── hooks/                    ← useDebounce, usePagination
│   ├── utils/                    ← formatDate, truncate, cn (classNames helper)
│   └── types/                    ← Shared TypeScript interfaces
│
└── lib/
    ├── axios.ts                  ← Axios instance with interceptors
    ├── queryClient.ts            ← TanStack Query client config
    └── zustand/
        └── store.ts              ← Root Zustand store (combines slices)
```

**Rules:**
- `app/` contains only routing concerns: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`
- Business logic, API calls, and state go in `features/`
- `shared/` is for truly reusable, feature-agnostic code only
- Never import from `features/auth` inside `features/documents` — cross-feature deps go through `shared/`

### Backend (NestJS) — Feature-Based

```
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.guard.ts
│   ├── dto/
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   └── strategies/
│       └── jwt.strategy.ts
├── documents/
│   ├── documents.module.ts
│   ├── documents.controller.ts
│   ├── documents.service.ts
│   ├── documents.processor.ts   ← BullMQ worker
│   ├── dto/
│   └── entities/
├── embeddings/
├── search/
├── chat/
├── collections/
├── users/
├── prisma/
│   └── prisma.service.ts
├── common/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── decorators/
│   └── pipes/
└── config/
    └── configuration.ts
```

**Rule:** Never create a top-level `controllers/` or `services/` folder. Features own their own files.

---

## 11. Environment Variables Master List

> Every variable that will ever be needed. Never hardcode any of these.

### Backend `.env`

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_doc_reader

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=7d

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=50

# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_LLM_MODEL=llama3.1:8b

# PGVector
VECTOR_DIMENSIONS=768

# BullMQ
QUEUE_CONCURRENCY=3
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=AI Document Reader DB
```

> Variables prefixed `NEXT_PUBLIC_` are exposed to the browser. All others are server-only.
> Never put secrets in `NEXT_PUBLIC_` variables.

---

## 12. Database Design Principles

- **All IDs** are `UUID` (not auto-increment integers)
- **All tables** have `created_at` and `updated_at` timestamps
- **Soft deletes** where business logic requires keeping audit history
- **Indexes** on every foreign key and every column used in WHERE clauses
- **PGVector** stores embeddings as `vector(768)` with `ivfflat` index for cosine similarity
- **Migrations** through Prisma Migrate only — never raw SQL in production without a migration file

### Core Tables (high-level)

| Table | Purpose |
|---|---|
| `users` | User accounts and profiles |
| `documents` | Document metadata and processing status |
| `document_chunks` | Text chunks with vector embeddings |
| `conversations` | Chat sessions per document |
| `messages` | Individual chat messages |
| `collections` | User-defined document groups |
| `collection_documents` | Many-to-many join |

---

## 13. API Design Standards

- All routes prefixed with `/api/v1/`
- **RESTful conventions** for all CRUD resources
- Every endpoint documented with `@ApiOperation`, `@ApiResponse` Swagger decorators
- Error responses always follow this shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["field: reason"],
  "timestamp": "2025-01-01T00:00:00.000Z",
  "path": "/api/v1/documents"
}
```

- Success responses always wrap data:

```json
{
  "data": { },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

- All list endpoints are **paginated** — never return unbounded arrays

### Next.js ↔ NestJS Communication Pattern

```
Server Component (Next.js)
  └── fetch() directly to NestJS API
        └── Pass JWT from cookie/header server-side

Client Component (Next.js)
  └── Axios instance (lib/axios.ts)
        └── TanStack Query wraps the Axios call
              └── JWT attached via Axios request interceptor
```

Next.js Route Handlers (`app/api/`) are used **only** when:
- You need to proxy a request to hide a secret from the browser
- You need to set/read HTTP-only cookies (auth flows)
- Otherwise, call the NestJS API directly

---

## 14. Security Non-Negotiables

- JWT tokens are short-lived (7d access; refresh token strategy in Phase 2)
- JWT stored in **HTTP-only cookies**, not `localStorage` — prevents XSS token theft
- Passwords hashed with **bcrypt** (cost factor 12)
- File uploads validated by **MIME type AND magic bytes** — never trust the file extension alone
- Allowed file types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/jpeg`, `image/png`, `image/webp`
- Maximum file size enforced at the Multer middleware level (50MB default)
- Rate limiting on auth endpoints: 5 requests / 15 minutes per IP
- All user input sanitized before being injected into prompts (prompt injection prevention)
- Users can only access their own documents — every query is scoped by `userId`
- No sensitive data in logs (no passwords, no JWT tokens)
- `NEXT_PUBLIC_` variables contain zero secrets — they are visible to everyone

---

## 15. Testing Standards

| Layer | Tool | Coverage Target |
|---|---|---|
| Unit (services, utils) | Jest | 80%+ |
| Integration (API endpoints) | Jest + Supertest | All happy paths + key error paths |
| Frontend Components | React Testing Library | Key interactive components |
| E2E | Playwright | Core user journeys |

**Core journeys that must have E2E tests:**
1. Register → Login → Upload document → Ask question → Receive answer
2. Create collection → Add documents → Search collection
3. View conversation history → Continue conversation

---

## 16. Definition of Done

A phase is only complete when ALL of the following are true:

- [ ] All planned features implemented
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Swagger docs updated (backend)
- [ ] Environment variables documented in this README
- [ ] No TypeScript `any` types introduced
- [ ] No `console.log` left in production code (use NestJS Logger on backend; remove on frontend)
- [ ] All `"use client"` directives have an inline comment explaining why
- [ ] Error handling covers all failure paths
- [ ] Security considerations reviewed
- [ ] Decision log updated with any new architectural choices
- [ ] Code reviewed (or self-reviewed against this checklist)
- [ ] Phase status updated in [Phase Roadmap](#7-phase-roadmap)

---

## 17. What We Never Do

These are explicit scope guards. Do not implement these until their designated phase.

| Forbidden until later | Reason |
|---|---|
| Pages Router code | App Router is the chosen strategy — mixing causes confusion |
| Next.js Route Handlers as a general BFF layer | Call NestJS directly; Route Handlers only for cookie/secret proxying |
| Multi-tenancy / organizations | Phase complexity — single-user model first |
| Real-time streaming chat (SSE/WebSocket) | Phase 11 is chat; streaming is a later optimization |
| Third-party cloud storage (S3, GCS) | Local storage first; cloud storage in Phase 18 |
| Fine-tuning models | Out of scope for this project |
| Plugin / extension system | Not in roadmap |
| Mobile app | Not in roadmap |
| Public sharing of documents | Phase 13+ only |
| Billing / subscription tiers | Not in roadmap |
| Component libraries (Shadcn, MUI, Chakra) | Tailwind-only UI — see DL-005 |

---

## 18. Handoff Checklist

Use this when handing the project to another engineer or resuming after a long break.

### Before Handing Off

- [ ] This README is fully up to date
- [ ] Current phase is clearly marked in the [Phase Tracker](#8-current-phase-tracker)
- [ ] All in-progress work is committed with meaningful commit messages
- [ ] `.env.example` and `.env.local.example` exist with all variables listed (no real values)
- [ ] `docker-compose.yml` works from a clean machine
- [ ] Decision log is current

### Onboarding a New Engineer (Steps in Order)

1. Read this entire README first
2. Read the master development prompt document
3. Run `docker-compose up` to start PostgreSQL, Redis, Ollama
4. Run `npx prisma migrate dev` to apply migrations
5. Run `npm run seed` to seed test data (if available)
6. Run the NestJS backend: `npm run start:dev`
7. Run the Next.js frontend: `npm run dev`
8. Look at the [Current Phase Tracker](#8-current-phase-tracker) — that is the only thing being worked on

### Key Things a New Engineer Must Know About This Stack

- **App Router only.** If you see `pages/` anywhere, that is wrong.
- **Server Components are the default.** `"use client"` is an exception, not the rule.
- **TanStack Query handles all async server state** in Client Components. Do not use `useEffect` + `fetch` directly.
- **Zustand handles UI state** (upload progress, selected document, conversation state). It does not cache server data — that is TanStack Query's job.
- **Never store the JWT in localStorage.** It lives in an HTTP-only cookie.
- **The NestJS API is the only backend.** Next.js Route Handlers are not a second backend.

---

## 19. Glossary

| Term | Definition |
|---|---|
| **RAG** | Retrieval Augmented Generation — a pattern where a language model answers questions using retrieved document context rather than only its training data |
| **Embedding** | A numerical vector representation of text that captures semantic meaning |
| **Chunk** | A small piece of a document (typically 512–1024 tokens) stored individually for retrieval |
| **PGVector** | A PostgreSQL extension that adds a `vector` data type and similarity search operators |
| **Cosine Similarity** | A metric for comparing two vectors — higher = more similar meaning |
| **Top-k Retrieval** | Fetching the k most semantically similar chunks to a user query |
| **BullMQ** | A Redis-backed queue system for running background jobs in Node.js |
| **Ollama** | A tool for running LLMs locally |
| **nomic-embed-text** | An open-source embedding model producing 768-dimensional vectors |
| **Llama 3.1 8B** | Meta's open-source large language model used for answer generation |
| **Prompt Injection** | An attack where malicious text in a document tries to hijack the LLM's behavior |
| **ivfflat** | An approximate nearest-neighbor index type in PGVector — faster than exact search at scale |
| **Server Component** | A Next.js component that renders on the server; zero JS sent to the browser; cannot use hooks or browser APIs |
| **Client Component** | A Next.js component marked `"use client"`; runs in the browser; can use hooks, events, and browser APIs |
| **Route Group** | A Next.js folder wrapped in `()` that groups routes without adding a URL segment — used to apply different layouts |
| **Route Handler** | A Next.js `app/api/route.ts` file that handles HTTP requests server-side — used sparingly in this project |
| **HTTP-only Cookie** | A cookie that cannot be read by JavaScript — the secure way to store JWTs in a browser |
| **BFF** | Backend for Frontend — a server layer that sits between the frontend and the real backend; we avoid this except for auth cookie handling |

---

## 20. Decision Log

> Every significant architectural decision is recorded here with its rationale. Future engineers must not reverse these without adding a new entry explaining why.

---

### DL-001 — PostgreSQL + PGVector over a dedicated vector database

**Date:** Project start
**Decision:** Use PostgreSQL 16 with the PGVector extension instead of a dedicated vector database like Pinecone, Weaviate, or Qdrant.
**Rationale:**
- Keeps the infrastructure footprint small (one database instead of two)
- Transactional consistency between document metadata and embeddings is guaranteed
- PGVector's `ivfflat` index is sufficient for the document volumes this system targets
- Reduces operational complexity and cost

**Tradeoff:** At very large scale (100M+ vectors), a dedicated vector DB would outperform PGVector. Acceptable risk for this project's scope.

---

### DL-002 — Ollama (local LLM) over OpenAI API

**Date:** Project start
**Decision:** Use Ollama running Llama 3.1 8B locally instead of calling OpenAI or Anthropic APIs.
**Rationale:**
- Document content stays private and never leaves the user's infrastructure
- No per-token API costs
- No dependency on third-party API availability

**Tradeoff:** Local inference is slower than cloud APIs and requires GPU hardware for good performance. CPU-only inference is possible but slow.

---

### DL-003 — NestJS over Express

**Date:** Project start
**Decision:** Use NestJS 11 as the backend framework.
**Rationale:**
- Built-in dependency injection aligns with enterprise architecture patterns
- Opinionated module structure prevents architectural drift across a long project
- First-class TypeScript support
- Built-in support for BullMQ, Prisma, Passport, Swagger via official packages

**Tradeoff:** More boilerplate than Express for simple endpoints. Worth it for a project of this scope.

---

### DL-004 — Feature-based folder structure

**Date:** Project start
**Decision:** All code is organized by feature (`documents/`, `auth/`, `chat/`) not by layer (`controllers/`, `services/`).
**Rationale:**
- Easier to navigate to all code related to a feature
- Easier to delete or extract a feature without hunting across multiple folders
- Scales better as the codebase grows

**Tradeoff:** Some duplication of patterns across features. Shared code goes in `common/` (backend) or `shared/` (frontend).

---

### DL-005 — Tailwind CSS only, no component library

**Date:** Project start
**Decision:** Build all UI components by hand with Tailwind CSS. No Shadcn UI, no Radix UI, no MUI.
**Rationale:**
- Full control over every pixel — no fighting a library's opinions
- No hidden accessibility or styling overrides from third-party components
- Smaller bundle — no unused component code shipped
- Forces a well-structured `shared/components/` folder that the team fully understands

**Tradeoff:** More upfront work to build Button, Input, Modal, etc. from scratch. Offset by the fact that these components are simple and only need to be built once.

---

### DL-006 — Next.js App Router with Server Components as default

**Date:** Project start
**Decision:** Use Next.js 15 App Router. Every component is a Server Component unless explicitly marked `"use client"`.
**Rationale:**
- Server Components eliminate unnecessary JavaScript in the browser for data-fetching layers
- Better initial page load performance and SEO
- Cleaner separation: server fetches data, client handles interaction
- App Router is the future of Next.js; Pages Router is in maintenance mode

**Tradeoff:** Mental model shift for engineers used to Pages Router or pure SPAs. The rendering decision tree in Section 5 must be understood and followed.

---

### DL-007 — JWT in HTTP-only cookies, not localStorage

**Date:** Project start
**Decision:** Store the JWT access token in an HTTP-only cookie set by the Next.js Route Handler after login, not in localStorage or a JavaScript-accessible cookie.
**Rationale:**
- HTTP-only cookies are not readable by JavaScript — XSS attacks cannot steal the token
- localStorage JWT storage is a well-known security anti-pattern (vulnerable to XSS)
- Next.js Route Handler at `app/api/auth/` handles setting and clearing the cookie

**Tradeoff:** Slightly more complex auth flow (requires a Route Handler for the cookie). Worth it for the security benefit.

---

*Add new entries here as architectural decisions are made during development.*

---

> **Last Updated:** [DATE]
> **Maintained By:** [NAME / TEAM]
> **Questions?** Refer to the master development prompt document first, then this README.
