# PDIF V1 — Implementation Task List
## "Path B, Accelerated" — 6-Week Build Plan

---

## ⚠️ SCOPE LOCK — READ THIS FIRST

**V1 delivers exactly ONE thing: The core coaching loop.**

> Listen to a customer conversation → Understand what's being discussed → Suggest the next great transportation consulting question → Remember everything learned

**V1 does NOT include:**
- Hypothesis engine (V2)
- Business case builder (V2)
- Competitive intelligence engine (V2)
- Persona intelligence engine (V2)
- ROI engine (V2)
- Cross-account pattern recognition (V2)
- Manager coaching dashboard (V2)
- Meeting platform bots / Teams / Zoom integration (V2)
- Mobile app (V2)
- 17-category full confidence engine (V2 — V1 gets 5 categories)

**If during development a new idea comes up that isn't on this list, the answer is: "That's a great V2 feature. Let's write it down and keep moving."**

---

## WHAT WE'RE KEEPING FROM THE EXISTING APP

These already work and stay untouched:
- ✅ Login / authentication
- ✅ Account creation with business card OCR
- ✅ Industry segment detection (including custom segments)
- ✅ Contact management
- ✅ Desktop launcher (LAUNCH.bat)
- ✅ Backend server (Fastify)
- ✅ Database connection (Neon PostgreSQL)

---

## WHAT WE'RE BUILDING NEW

The live session experience — completely rebuilt from scratch:
- 🆕 Better transcription (Deepgram instead of browser speech)
- 🆕 Discovery Graph (the platform's memory)
- 🆕 PDIF Phase Engine (5-phase framework)
- 🆕 Transportation-aware question suggestions
- 🆕 5-category confidence scoring
- 🆕 Pre-session briefing
- 🆕 Post-session summary
- 🆕 Salesforce CRM export

---

## WEEK-BY-WEEK PLAN

---

## WEEK 1: Foundation
### "Build the memory and the ears"

The goal this week: The platform can listen to a conversation and remember what it hears.

---

### TASK 1.1 — New Database Schema
**What this is**: Redesigning the database tables that store everything the platform knows about a customer's transportation operation.

**Why it matters**: The current database thinks in MEDDIC (12 elements). The new one thinks in transportation operations (entities, relationships, phases, confidence). This is the foundation everything else sits on.

**What gets built**:
- `pdif_sessions` table — tracks a live coaching session with PDIF phase, start/end time, and status
- `discovery_graph_nodes` table — stores every fact, contact, process, pain point, and system mentioned
- `discovery_graph_edges` table — stores relationships between those facts ("John REPORTS_TO Sarah", "Manual Planning CAUSES Route Inefficiency")
- `confidence_scores` table — tracks the 5 V1 confidence categories per session
- `question_suggestions` table — logs what was suggested and whether it was used
- `pdif_phases` table — tracks which phase each session is in and when it transitioned

**Your action**: None yet — I'll write all the code. You just need the servers running.

---

### TASK 1.2 — Run Database Migration
**What this is**: Applying the new database design to the actual live database (Neon PostgreSQL).

**What you'll do**:
1. I'll write the migration script
2. You'll run one command in the terminal: `pnpm db:push`
3. I'll verify it worked

**Risk**: Low — we're adding new tables, not changing existing ones. Nothing currently working will break.

---

### TASK 1.3 — Deepgram Transcription Integration
**What this is**: Replacing the browser's built-in speech recognition with Deepgram — a professional transcription service that handles noise, accents, and multiple speakers.

**Why it matters**: The current transcription breaks in noisy rooms, doesn't know who is speaking, and fails in non-Chrome browsers. Deepgram is what professional conversation intelligence platforms use.

**What you'll need**:
- A Deepgram account (free tier available: https://deepgram.com)
- An API key from Deepgram's dashboard

**What I'll build**:
- Backend service that opens a Deepgram connection when a session starts
- Real-time streaming: audio captured in browser → sent to Deepgram → transcription comes back in ~1 second
- Speaker diarization: knows whether the rep or the customer is talking
- Transportation industry vocabulary boost (deadhead, cross-dock, LTL, etc.)

**Your action**: Sign up for Deepgram, get an API key, give it to me. I'll do everything else.

---

### TASK 1.4 — Discovery Graph Service
**What this is**: Building the "memory" of the platform — the service that takes things mentioned in conversation and stores them as structured knowledge.

**Example**: Customer says "We have about 200 trucks and plan routes manually each morning."
- The graph creates a node: `Fleet { size: 200, confidence: 0.85 }`
- The graph creates a node: `PlanningProcess { method: "manual", frequency: "daily", confidence: 0.90 }`
- The graph creates an edge: `Fleet → USES → ManualPlanning`
- The graph generates an alert: "Low-confidence utilization — worth exploring"

**What I'll build**:
- `DiscoveryGraphService` — the core service
- Entity extraction: reads transcript segments and identifies facts worth storing
- Relationship detection: understands how facts connect to each other
- Confidence tracking: how sure are we about each fact based on the evidence
- Gap detection: what important information is still unknown

---

## WEEK 2: Intelligence
### "Build the brain"

The goal this week: The platform understands what's being discussed and knows what to ask next.

---

### TASK 2.1 — Transportation Knowledge Pack (V1)
**What this is**: Loading the platform with transportation domain expertise it uses to generate intelligent questions.

**This is NOT a database of questions.** It's structured knowledge about how transportation operations work — causal patterns, operational norms, financial relationships — that the AI uses to reason.

**Contents**:
- 50 causal patterns (e.g., "manual planning + 100+ trucks → likely route inefficiency > 20%")
- Industry benchmarks for the 4 most common segments (3PL, Manufacturing, Building Supply, Food & Bev)
- PTV solution mapping (which product solves which problem)
- 300 transportation-specific question templates organized by topic
- Transportation terminology dictionary for Deepgram vocabulary boost

**Your action**: None. I'll build this entirely.

---

### TASK 2.2 — PDIF Phase Engine
**What this is**: The system that tracks which of the 5 discovery phases a session is in and adjusts what it suggests accordingly.

**How it works**:
- Phase 1 (DISCOVER): Questions explore who the company is, what they do, how big they are
- Phase 2 (DIAGNOSE): Questions probe operational problems and quantify pain
- Phase 3 (DESIGN): Questions map to solutions and desired outcomes
- Phase 4 (DEMONSTRATE): Questions validate readiness and identify what to show
- Phase 5 (DELIVER): Questions establish buying process, timeline, success metrics

**Important**: Phases are not mandatory gates. The rep can be in any phase at any time. The engine shows a PRIMARY recommendation but never blocks.

**What I'll build**:
- Phase detection: based on what's been discussed, where is this conversation?
- Phase transition logic: when should the platform suggest moving to the next phase?
- Phase-appropriate question filtering: DISCOVER questions don't show during DELIVER

---

### TASK 2.3 — Question Suggestion Engine
**What this is**: The core AI intelligence — the system that picks the best 2-3 questions to suggest at any moment.

**How it reasons**:
1. What do we already know? (from Discovery Graph)
2. What's the most valuable unknown? (from gap analysis)
3. What hypothesis needs validation? (from pattern matching)
4. What fits the current conversation thread? (from recent transcript)
5. What phase are we in? (from Phase Engine)
6. Who are we talking to? (from contact roles identified)

**Output**: 2-3 questions, each with a one-line "why this matters" explanation.

**Example output**:
```
💡 "What does your average driver's day look like from start to finish?"
   → Helps understand route length and overtime risk

💡 "How do you handle it when a delivery gets rescheduled at the last minute?"
   → Tests exception handling maturity

💡 "What systems does your planning team use today?"
   → Maps technology stack for integration planning
```

**What I'll build**:
- Question scoring algorithm (business value × conversational fit × novelty)
- Transportation knowledge retrieval (pulls relevant domain knowledge)
- Natural language formatting (consultant voice, not checklist voice)
- 8-10 second refresh cycle (updates silently as conversation progresses)

---

### TASK 2.4 — 5-Category Confidence Scoring (V1)
**What this is**: A simplified version of the 17-category confidence engine from the full architecture. V1 tracks the 5 most important things to understand.

**The 5 V1 categories**:
1. **Company & Operations** — Do we understand how their business runs?
2. **Fleet & Network** — Do we understand their vehicles, routes, and geography?
3. **Technology & Data** — Do we understand their current systems?
4. **Financial Drivers** — Do we understand their costs and budget?
5. **Buying Process** — Do we understand who decides and how?

Each shows as a simple percentage (0-100%) that only increases when actual evidence is captured — not just when a question is asked.

---

## WEEK 3: The Core Loop
### "Connect everything and make it work end-to-end"

The goal this week: A rep can open the app, start a session, speak naturally, and see intelligent transportation consulting questions appear in real time.

---

### TASK 3.1 — Session Backend API
**What this is**: The backend routes that the frontend calls during a live session.

**Endpoints being built**:
- `POST /api/sessions` — Start a new session
- `POST /api/sessions/:id/transcript` — Send a transcript segment for processing
- `GET /api/sessions/:id/suggestions` — Get current question suggestions
- `GET /api/sessions/:id/confidence` — Get current confidence scores
- `GET /api/sessions/:id/graph` — Get what's been learned so far
- `POST /api/sessions/:id/end` — End a session and trigger post-session processing

---

### TASK 3.2 — Live Session UI (New)
**What this is**: The completely new session screen — built from scratch, designed for the "invisible consultant" philosophy.

**The screen has 3 zones**:

**Zone 1 — Primary (always visible, zero attention required)**:
- Current PDIF phase indicator (which phase is active)
- Recording status (subtle dot showing it's listening)
- Session timer

**Zone 2 — Glanceable (0.5 second attention budget)**:
- 2-3 question suggestions (large text, easy to read mid-conversation)
- One-line "why this matters" under each
- Tap to mark as asked

**Zone 3 — Background (available when there's a pause)**:
- Confidence meters for 5 categories
- Recent discoveries (what the platform just learned)
- Phase progress

**Design principle**: A rep should be able to glance at the screen for half a second and get the information they need. Nothing should demand attention or interrupt the conversation.

---

### TASK 3.3 — Real-Time Update Flow
**What this is**: Wiring together all the pieces so the full loop works:

```
Rep speaks → Deepgram transcribes → Backend processes → 
Graph updates → Suggestions refresh → UI updates
```

Target latency: Under 8 seconds from speech to updated suggestions appearing on screen.

**What I'll build**:
- WebSocket connection between frontend and backend (keeps the session live)
- Processing pipeline (transcript → entity extraction → graph update → suggestion refresh)
- Optimistic updates (UI updates immediately on what we know, refines as AI processes)

---

### TASK 3.4 — Offline Fallback Mode
**What this is**: What happens when internet connection is poor or drops.

**Behavior**:
- If Deepgram is unavailable: Fall back to browser speech recognition (worse quality but still works)
- If backend AI is unavailable: Show cached suggestions from before the connection dropped
- If connection drops entirely: Keep transcribing locally, sync when reconnected
- Visual indicator: Clear "offline" / "syncing" / "connected" status always visible

---

## WEEK 4: Before and After
### "Make the sessions valuable beyond the conversation itself"

The goal this week: The platform is useful before you walk into the meeting and after you walk out.

---

### TASK 4.1 — Pre-Session Briefing
**What this is**: A screen the rep sees before starting a session that tells them everything they need to know in 30-60 seconds.

**Contents**:
- Quick summary of what's known about the account (from previous sessions)
- Top 3 hypotheses to explore this session (what's worth investigating)
- Suggested opening questions (so the rep never starts cold)
- Attendee notes (who's in this meeting, what they care about)
- What was promised last time (action items from previous session)
- External news since the last session (company announcements, industry news)

**This replaces** the mental work of "what should I ask today?" The platform does that work for you.

---

### TASK 4.2 — Post-Session Summary
**What this is**: An automatic debrief generated within 2 minutes of ending a session.

**Contents**:
- Session quality score (how complete was the discovery?)
- Key things learned this session (with evidence from the transcript)
- Updated opportunity size (how much value has been identified so far?)
- Gaps to close next session (what's still unknown?)
- Suggested follow-up actions with recommended owners
- Draft follow-up email (ready to send, customizable)
- Draft CRM update (what fields to update in Salesforce)

**The goal**: Zero post-meeting admin. Everything the rep would normally spend 30 minutes writing is done automatically.

---

### TASK 4.3 — Salesforce CRM Export (Basic)
**What this is**: Pushing key session outputs into Salesforce automatically.

**V1 scope** (keep it simple):
- Update Opportunity stage based on PDIF phase
- Create a Task for follow-up actions
- Log the session as a completed Activity
- Update custom fields: discovery confidence score, opportunity value estimate

**What you'll need**: Salesforce connected app credentials (I'll walk you through this step by step when we get there)

---

## WEEK 5: Polish and Pilot
### "Make it work reliably for real users"

The goal this week: Fix everything that breaks during testing and get ready for the first real users.

---

### TASK 5.1 — Error Handling and Graceful Degradation
**What this is**: Making sure the app never crashes or leaves the rep stuck during a customer meeting.

**Scenarios covered**:
- Deepgram drops mid-session → fall back to browser STT, show notification
- OpenAI times out → show cached suggestions, show "AI thinking..." indicator
- Backend unreachable → full offline mode, sync when reconnected
- Session accidentally closed → restore from local storage on reopen
- Browser refreshed mid-session → rejoin session with full context

---

### TASK 5.2 — Performance Optimization
**What this is**: Making sure the app is fast enough to use during a live customer conversation.

**Targets**:
- Question suggestions refresh: under 8 seconds
- Page load time: under 2 seconds
- Transcription latency: under 1.5 seconds from speech to text on screen
- No lag or stutter during active sessions

---

### TASK 5.3 — Internal Pilot Setup
**What this is**: Setting up the first real users — PTV sales reps — to use the platform in actual customer meetings.

**What I'll prepare**:
- Onboarding guide (what is this, how to use it, what to expect)
- Feedback collection form (what worked, what didn't, what was missing)
- Session monitoring (can watch sessions in real time to catch issues)
- Usage analytics (are reps actually using it? when? for how long?)

**What you'll do**:
- Identify 3-5 reps willing to try it in real meetings
- Set up their accounts
- Brief them on what V1 does and doesn't do (set expectations correctly)
- Collect feedback after each session

---

### TASK 5.4 — V2 Feature Capture System
**What this is**: A structured way to capture ideas that come up during piloting that aren't in V1 scope.

**Why it matters**: During pilot, everyone will say "it would be great if it also did X." Without a system, those requests derail V1. With a system, they feed V2 planning.

**What I'll build**: A simple in-app feedback button that captures:
- The feature idea
- Which session it came from
- Which rep suggested it
- Automatically tagged as "V2 candidate"

---

## WEEK 6: Hardening
### "Make it production-ready"

The goal this week: The platform can handle real enterprise usage without falling over.

---

### TASK 6.1 — Security Review
**What this is**: Making sure customer data is properly protected.

**Checklist**:
- All transcript data encrypted at rest
- Session data only visible to the account team
- API keys stored securely (not in code)
- GDPR consent flow working correctly
- Audit log recording who accessed what

---

### TASK 6.2 — Load Testing
**What this is**: Testing that the platform handles multiple reps using it simultaneously.

**Target**: 20 concurrent sessions without performance degradation. (Sufficient for initial pilot; scale testing for V2.)

---

### TASK 6.3 — Documentation
**What this is**: Written instructions for everyone who needs them.

**Documents I'll write**:
- Rep user guide: how to use the platform in a meeting (with screenshots)
- Admin guide: how to add users, configure accounts
- Technical runbook: how to restart services if something goes wrong (for your IT team)
- Known limitations: what V1 does and doesn't do (sets correct expectations)

---

### TASK 6.4 — V1 Launch Checklist
**What this is**: The final gate before declaring V1 complete.

**Criteria**:
- [ ] Core loop works end-to-end (transcription → suggestions → graph update)
- [ ] Pre-session briefing generates correctly
- [ ] Post-session summary generates within 2 minutes
- [ ] Salesforce export works
- [ ] Offline fallback works
- [ ] 20 concurrent sessions without issues
- [ ] Security checklist complete
- [ ] 3+ internal reps have tested in real meetings
- [ ] Feedback collected and reviewed
- [ ] Known bugs documented with V2 fix plan

---

## DECISION LOG
### For tracking when scope questions come up

| Date | Question | Decision | Reason |
|------|----------|----------|--------|
| — | Should we include hypothesis engine in V1? | No — V2 | Adds 3+ weeks; core loop proves concept without it |
| — | Should we include manager dashboard in V1? | No — V2 | No data yet to make it useful |
| — | Should we include Teams/Zoom bots in V1? | No — V2 | High complexity, low V1 priority |

---

## WHAT SUCCESS LOOKS LIKE

V1 is successful when:

1. A rep uses it in a real customer meeting and says "it suggested a question I wouldn't have thought of"
2. The post-session summary saves them at least 15 minutes of admin work
3. The pre-session briefing means they walk in prepared without doing manual research
4. They want to use it again in their next meeting

That's it. Those four things. Everything else is V2.

---

## HOW WE'LL WORK TOGETHER

**My role**: Write all the code, design all the technical decisions, handle everything that requires technical expertise.

**Your role**:
- Make product decisions (what does the user experience feel like?)
- Provide access credentials when needed (Deepgram API key, Salesforce credentials, etc.)
- Test the platform from a user perspective (does this make sense? does this work the way a rep would use it?)
- Keep us on scope (when ideas come up, we evaluate against the V1 criteria above)

**When you're unsure about a decision**: Ask me. I'll explain the tradeoffs in plain language.

**When I suggest something that expands scope**: Challenge me. My job is to build what was planned, not add features.

**When something doesn't work as expected**: Tell me exactly what you did and what you saw. I'll fix it.

---

## NEXT IMMEDIATE ACTION

We start with Task 1.1 — the new database schema.

Before I write a single line of code, I need you to answer one question:

**Do you want to keep the existing `ptv_discovery_coach` database on Neon as-is (as a backup) and create a new database for V1, or should I migrate the existing database?**

Recommendation: Create a new database. It keeps the existing app fully functional as a reference while we build the new one. Zero risk of breaking what already works.

Your call.
