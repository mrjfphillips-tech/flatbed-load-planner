# PTV Discovery Coach — Project Progress

## What This App Is
An AI-powered sales coaching tool that listens to live customer discovery calls and privately guides PTV sales reps through a MEDDIC-based discovery framework. The rep is the only one aware of it. It transcribes the conversation in real time, suggests the next best question, scores the customer's responses, and generates a post-call summary with action items and next steps.

---

## Current Status: In Development

### ✅ Completed

#### Specs & Architecture
- Full requirements document (15 requirements, 54 correctness properties)
- Technical design document (React/Vite frontend, Node.js/Express backend, PostgreSQL/Prisma, Auth0, GPT-4o, Whisper WASM, Tesseract.js)
- Implementation task list (23 milestones, all marked complete)
- Electron packaging spec (requirements + design) for Windows .exe installer

#### Backend (packages/backend)
- Prisma schema — all 14 tables including industry_segment, coaching_note fields
- AIEngineService — GPT-4o wrapper with MEDDIC scoring, QIS evaluation, dynamic question generation, industry-aware prompts
- SessionService — CRUD, auto-save, finalize, summary generation
- ContactService — full CRUD, business card OCR field mapping, session linking
- ExportAdapterService — Salesforce REST API + Microsoft Graph API with contact deduplication
- QuestionBankService — CRUD, bulk CSV upload with validation
- PreferenceService — question starring, weighted ranking, personalization
- OfflineRecoveryService — audio upload, Whisper transcription, full MEDDIC analysis pipeline
- All routes wired: sessions, accounts, questions, contacts, summaries, offline recovery

#### Frontend (packages/frontend)
- SessionController — live session orchestration, WebSocket, question accept/skip/alternatives
- MEDDICDashboard — 12-element confidence meters, Rep-only visibility
- AccountSummary — session history, gap highlights, contacts grouped by persona
- ContactProfile — add/edit/delete contacts, session attendance linking
- BusinessCardScanner — camera/upload, OCR field mapping, unmatched text chips
- OCRCapture — document/image capture, Tesseract.js integration
- ExportPanel — Salesforce, M365, SMS, email export with preview
- SMSEmailExport — Web Share API / mailto
- QuestionBankAdmin — add/edit/deactivate questions, bulk CSV upload
- PreferredQuestionsManager — star/unstar, profile view
- AudioExportComponent — MP3/WAV download, ZIP attachments, error boundary
- OfflineRecoveryUpload — audio file upload, progress polling, account selector
- DiscreetModeToggle — single-tap UI collapse
- ROICalculator — 7 value streams, miles/km toggle, multi-currency, EBIT framing ✅ NEW
- IndustrySegmentSelector — 8 industry segments, shown at session start ✅ NEW
- TranscriptionEngine — Whisper WASM wrapper, Web Audio API, audio loss detection

#### Electron (packages/electron)
- main.ts — app lifecycle, BrowserWindow, tray icon, IPC handlers, Auth0 PKCE protocol handler
- preload.ts — contextBridge IPC bridge
- config.ts — environment resolution (dev/staging/prod)
- auth.ts — Auth0 PKCE flow
- storage.ts — safeStorage + AES-256-GCM fallback for OpenAI key
- wasm.ts — Whisper/Tesseract resource path resolver
- electron-builder.yml — NSIS installer, ptv_logo.ico, auto-updater

#### Data / Content
- starter-question-bank.csv — ~200 questions across all 12 MEDDIC elements, all buyer personas, with coaching notes
- industry-manufacturing-distribution.csv — 25 industry-specific questions
- industry-building-supply.csv — 25 industry-specific questions (from HD Supply discovery template)
- universal-discovery-framework.csv — 30 questions from PTV Global Discovery Playbook
- roi-calculator-template.json — v3.0, 7 value streams, global units/currency support
- demo.html — interactive UI mockup (opens in any browser, no Node.js needed)
- demo-script.html — 12-minute demo walkthrough script (print to PDF with Ctrl+P)

---

### 🔲 Still To Do

1. **Account-first navigation redesign** — ✅ DONE in demo-v2.html. Accounts home screen with search, health scores, industry badges. Clicking into an account shows Overview, Live Session, ROI, Leexi, Contacts under that account context.
2. **MEDDIC score deltas** — ✅ DONE in demo-v2.html. Leexi import now shows +/- point changes per element with color coding (green for gains, red for drops, gray for no change). Includes "still needs attention" callout for critical gaps.
3. **Quick Account Capture (tradeshow mode)** — ✅ DONE in demo-v2.html. "+ New Account" opens a fast-capture form with business card scan, industry selector, quick note, and "Create & Start Session" button for immediate recording.
4. **Activity Timeline & Calendar** — ✅ DONE in demo-v2.html. Account overview shows chronological timeline of all activities (calls, imports, account creation). "Schedule Follow-up" form with date, time, purpose, attendees, and Outlook calendar integration.
5. **Title-based persona detection + MEDDIC role mapping** — Each contact gets two fields after OCR or manual entry: (a) Persona Tier (auto-detected from title, editable) and (b) MEDDIC Deal Role (manually assigned or AI-suggested, editable). 

   **Persona Tier** (auto-detected from title, drives question tone):
   - C-suite: VP Supply Chain, COO, CEO, President, Chief → strategic/financial questions
   - Senior Leader: Director, Head of → strategic with operational depth
   - Line Manager: Manager, Supervisor → process and day-to-day questions
   - Operational: Dispatcher, Planner, Coordinator, Analyst → tactical, hands-on
   - Technical: IT, Systems, Architect, Engineer → integration, security, architecture

   **MEDDIC Deal Role** (assigned by rep, drives deal strategy):
   - Economic Buyer: VP Supply Chain, COO, Head of Logistics — the person who controls budget
   - Champion: Director of Transportation, Head of Routing/Planning, sharp Sr. Analyst — internal advocate with influence + access to EB
   - Technical Buyer: IT/Integration lead, Data/API team — evaluates technical fit
   - End User: Dispatchers, route planners, drivers (indirectly) — daily users of the solution
   - Decision Influencer: Finance (cost justification), Customer Service (failed deliveries), Warehouse/cross-dock ops

   **How it works in the app:**
   - After business card OCR, the app auto-suggests both Persona Tier and MEDDIC Deal Role based on title
   - Rep can override either one (titles don't always reflect authority)
   - The Account Overview shows a "Deal Map" visualization: which MEDDIC roles are filled vs. missing
   - If no Economic Buyer is mapped → critical gap alert
   - If no Champion is mapped → critical gap alert
   - Messaging alignment per role: EB → ROI/risk/strategic, Champion → win internally/look good, Technical → feasibility/integration, Users → ease/workflow
   - Multi-threading tracker: shows minimum coverage (1 EB, 1-2 Champions, 1 Technical Buyer)
   - Champion quality test: "Do they have influence? Access to EB? Do they care enough to push?" — if not, they're a coach, not a Champion

6. **Gamification features (future beta)** — drive rep adoption through scoring and feedback loops:
   - Session score: total MEDDIC points earned per call
   - Streak tracking: "3 sessions in a row with 10+ points gained"
   - Team leaderboard: manager view showing which reps are improving fastest
   - Milestone badges: "First 100% element", "All 12 above 60%", "ROI fully validated"
   - Discovery readiness score: per-account indicator of when enough info exists to move to proposal
   - Weekly digest: automated email to managers summarizing team discovery activity
4. **QuestionBankService** — update bulk CSV upload to handle coaching_note and industry_segment columns
5. **Node.js installation** — required to run the app. Download from nodejs.org (Windows .msi)
6. **GitHub push** — push all code to https://github.com/mrjfphillips-tech/discovery-coach.git
7. **Backend deployment** — choose hosting (Azure, AWS, Railway) for the shared central server
8. **Auth0 tenant setup** — create Auth0 application for PKCE flow
9. **OpenAI API key** — needed for GPT-4o and Whisper API calls
10. **Leexi API key** — needed for Leexi integration (Settings → Company Settings → API Keys)

---

## To Resume in a New Session
Open Kiro, open this workspace, and say:
> "Continue working on the PTV Discovery Coach. Read PROGRESS.md for context."

The most impactful next steps are:
1. Install Node.js and run `npm install` from the ptv-discovery-coach folder
2. Push to GitHub
3. Wire up the industry selector and ROI calculator in demo.html

---

## Key File Locations
| What | Where |
|---|---|
| Demo UI | ptv-discovery-coach/demo.html |
| Demo Script | ptv-discovery-coach/demo-script.html |
| Question Bank | ptv-discovery-coach/data/starter-question-bank.csv |
| ROI Calculator | ptv-discovery-coach/data/roi-calculator-template.json |
| Requirements | .kiro/specs/ptv-discovery-coach/requirements.md |
| Design | .kiro/specs/ptv-discovery-coach/design.md |
| Tasks | .kiro/specs/ptv-discovery-coach/tasks.md |
