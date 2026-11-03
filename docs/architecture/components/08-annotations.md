# 08 · Comment / Annotation Service

**Location:** `apps/collab`  ·  **Phase:** 4

## Responsibility
Real-time, element-anchored comments on canvas frames. Model in [interfaces.md §4](../interfaces.md#4-annotation-model--comment-service-exported-to-cogitatoannotations).

## Behavior
- Click an element in a live frame → frame bridge reports its `data-kit-id` → comment pins to it.
- Typed comments: intent, spec, question, feedback.
- Threads, resolve, presence/cursors.
- Version-aware: comments show which commit they were made on; outdated ones are flagged.
- Detached comments (element removed) fall back to `fallbackRect` and are listed for triage.
- Export endpoint used by `prepare-handoff`.

## Key decisions
- Realtime is solved: use an off-the-shelf backend rather than building sync.

## Open questions
- Backend: Liveblocks vs Supabase (Postgres + realtime) vs Yjs on our own server. Tradeoffs: cost, self-hosting, auth integration.
- Auth: GitHub sign-in (everyone already has repo access) is the leaning.
- Can the Claude Code session read open comments, so a designer can say "address the open feedback"? (High value; needs an authenticated MCP tool.)

## Done when
- Two people on different machines see each other's comments and cursors on the same frame within a second, and comments survive a redesign of the surrounding screen.
