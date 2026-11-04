# CasePilot AI — Implementation Plan

> Builds [ARCHITECTURE.md](ARCHITECTURE.md) on the schedule from blueprint §10. The plan gives eight
> working days plus a half-day of setup, with a working vertical slice by the end of Day 3.

## How to read this plan

**Streams.** Each day's work is split into three streams. With two people, one takes WEB and the
other takes API and AI together.

| Stream | Owns |
|---|---|
| **WEB** | React app, UI and PWA |
| **API** | Cloud Functions, rules, data model, infrastructure |
| **AI** | Text extraction, prompts, citation checks, evals |

**Gates.** Four gates mark the points where the team stops, demos to itself, and decides whether to
apply the [cut list](#cut-list).

**Solo builder.** Expect the Day 5 gate around Day 6–7, and start the cut list on Day 3.

**Done means:**
- typed end to end through `packages/shared`
- tested at the layer listed in ARCHITECTURE §10
- deployed to `casepilot-neural-ninjas`

---

## Day 0 — Setup (half day, before kickoff)

- [x] **Firebase projects.**
  - [x] One project, `casepilot-neural-ninjas`, used for dev and the demo.
  - [x] Upgrade it to the Blaze plan.
  - [ ] Set a budget alert.
  - [x] Create Firestore (Native) in **`asia-south1`**. This cannot be changed later.
  - [x] Create the default Storage bucket in **`asia-south1`**, with CORS from `storage.cors.json`.
  - [ ] Grant the Storage service agent the cross-service rules role: run
        `npx firebase deploy --only storage` interactively and answer Yes. Needed before Day 3.
- [x] **Auth.** Email/Password and Google enabled through `firebase deploy --only auth`. The
      `web.app` and `firebaseapp.com` domains are authorized by default.
- [ ] **App Check.** Register the web app with reCAPTCHA Enterprise and create debug tokens for
      local development. Don't enforce yet.
- [ ] **Anthropic (Claude).**
  - [x] Get an API key.
  - [ ] Set a monthly spend limit on it in the Claude Console.
  - [x] Run `npx firebase functions:secrets:set ANTHROPIC_API_KEY`.
- [x] **Repository.**
  - [x] npm workspaces skeleton: `apps/web`, `functions`, `packages/shared`.
  - [x] Shared `tsconfig`, ESLint, Prettier.
  - [x] GitHub Actions running typecheck, lint, tests, build and rules tests.
- [ ] **Synthetic documents.**
  - [x] Turn the blueprint §9 sample order into a PDF and a DOCX (`seed/samples`).
  - [ ] Write the eval variants: conditional direction, relative deadline, prompt injection,
        Hindi order, blank page.
  - [x] Stamp every file "FICTIONAL SAMPLE".
- [ ] **PWA assets.**
  - [x] App icons at 64, 192, 512 and maskable 512, generated from `apps/web/public/logo.svg`.
  - [ ] Two install screenshots.

---

## Day 1 — Sign in and open a workspace

**WEB**
- [x] Vite + React + TypeScript; Tailwind + shadcn/ui theme.
- [x] App shell: sidebar, top bar, mobile bottom bar.
- [x] Router with the full route tree from ARCHITECTURE §4.2, lazy-loaded; placeholder pages are
      fine.
- [x] `RequireAuth` and `RequireOrg` guards. Login with Email/Password and Google. Onboarding that
      creates an organization and picks the workspace type.
- [x] PWA:
  - [x] `vite-plugin-pwa` with `injectManifest` and `sw.ts` (precache, SPA fallback with the `/__/`
        denylist).
  - [x] Manifest.
  - [x] Update-available toast.
  - [x] Install button.

**API**
- [x] `firebase.json` with emulators, Hosting rewrites and cache headers.
- [x] Functions scaffold: `setGlobalOptions`, `parseInput`, `requireMember`, `audit`, `HttpsError`
      helpers.
- [x] `createOrganization` writes the org, the owner membership, `users.memberships` and an audit
      entry in one transaction.
- [x] `firestore.rules`: deny by default; members read their org; users read their own doc;
      client writes denied. Covered by 11 rules tests.
- [x] `packages/shared`: enums, the permission matrix, path builders, and Zod schemas for org and
      member.

**AI**
- [x] The extraction Zod schema from blueprint §8, nullable rather than optional, checked for
      Structured Outputs strict mode.
- [x] `extract.v1` prompt, with forged page markers stripped from document text.
- [x] `AiProvider` interface and fixture provider.

**Gate G1.** On the dev project, a new user signs in, creates a workspace and lands on the
dashboard. Chrome offers to install the app. Reloading while offline shows the app shell.

> **Status, 4 Nov 2026:** passed on the local emulators (backend path checked over HTTP).
> Deployed to `casepilot-neural-ninjas`: Hosting, Firestore rules and indexes, Storage rules,
> sign-in providers and `createOrganization`. Still to check by hand on the live app: sign up,
> create a workspace, install the PWA.

---

## Day 2 — Cases and team

**WEB**
- [x] `useLiveQuery` for collections in `lib/live.ts`, next to the existing `useLiveDoc`.
- [x] Cases list: live, with client-side search and filters for status, court and assigned lawyer.
- [x] New and edit case forms (React Hook Form + shared Zod schemas). Archive action.
- [x] Case layout with header and tabs. Overview page.
- [x] Team page:
  - [x] Member list.
  - [x] Invite dialog that shows the link.
  - [x] Role change.
  - [x] `/invite/:orgId/:inviteId` accept flow.
- [x] Org switcher.

**API**
- [x] `createCase`, `updateCase`, `archiveCase`, `inviteMember`, `revokeInvitation`,
      `acceptInvitation`, `updateMember`. Every callable rejects signed-out callers first.
- [x] Rules for cases, members and invitations, with client writes denied.
- [x] `firestore.indexes.json` with every index from ARCHITECTURE §7. Deploy now, because builds
      take time.
- [x] Rules tests: Org B cannot read Org A's case; a viewer cannot write; a client write to `cases`
      is denied.

**AI**
- [x] `validateFile`: PDF and DOCX signatures, encrypted PDF, zip-bomb cap.
- [x] `extractPdf` (`unpdf`, per page), `extractDocx` (`mammoth`, sections) and the chunker.
- [x] Unit tests on the synthetic files (`seed/samples`: the blueprint §9 order as PDF and DOCX,
      plus a blank PDF).

**Done when** cases can be created, edited and archived; a second organization cannot see them,
with the rules tests passing; and an invite can be sent and accepted.

> **Status, 4 Nov 2026:** done. 12 rules tests and 13 function integration tests
> (`npm run test:integration`) cover the flows above against the emulators. Deployed to
> `casepilot-neural-ninjas`.

---

## Day 3 — Upload to summary (vertical slice)

**WEB**
- [x] Documents tab:
  - [x] Drag-and-drop with `uploadBytesResumable` progress.
  - [x] Live `ProcessingStatus` chips.
  - [x] Retry on failed documents.
- [x] PDF viewer (`react-pdf`, lazy) fed by `getBlob`.
- [x] AI review page v0: the summary and extracted items, read-only, with page numbers.

**API**
- [x] `startUpload`, `storage.rules`, `storage.cors.json` applied to the dev bucket.
- [x] `onUploadFinalized`: validation, SHA-256, duplicate detection, rejection cleanup.
- [x] `processDocument` and `runAnalysis` task-queue functions, the job claim and lease, and
      deterministic IDs.
- [x] `analyzeDocument` for retries.

**AI**
- [x] Claude provider: `claude-opus-5-5`, structured outputs, refusal fallback, Zod revalidation.
- [x] Page-marked prompt input with marker spoofing stripped.
- [x] Citation verifier (ARCHITECTURE §6.2).
- [x] Record the first good live run on the sample order as the fixture (`functions/fixtures/recordings.live.json`).

**Gate G2: vertical slice.** On dev, uploading the sample order shows a summary and directions with
page references within about a minute. If not, apply the cut list before starting Day 4.

> **Status, 4 Nov 2026:** built, tested and deployed. 20 integration tests cover upload, rejection,
> extraction, analysis, citation checks and re-runs. A live Claude run on the sample order took 36 s
> from upload to review, with all 16 citations verified. Live uploads on `casepilot-neural-ninjas`
> wait on the Storage cross-service permission (Day 0).

---

## Day 4 — Review and approval

**WEB**
- [ ] ReviewWorkspace: split pane, source chip → jump to page → highlight quote.
- [ ] Approve, edit and reject per item; bulk approve for items with no warnings.
- [ ] Warnings for unverified citations, relative deadlines and conditional directions.
- [ ] Date confirmation: a relative deadline needs a date entered by the reviewer, or stays null.
- [ ] Role gating with `can()`: a viewer sees a read-only review.

**API**
- [ ] `reviewAnalysis` as described in ARCHITECTURE §5.6:
  - [ ] Hashed task and event IDs created with `tx.create`.
  - [ ] Per-item decisions.
  - [ ] Recompute `nextHearingDate`.
  - [ ] One audit entry per decision.
- [ ] `org.policy.paralegalCanApprove` honoured.
- [ ] Function tests:
  - [ ] Approving the same two items twice yields two tasks.
  - [ ] A viewer gets `permission-denied`.
  - [ ] Each decision writes an audit entry.

**AI**
- [ ] Tune `extract.v1` on the conditional-direction and relative-deadline fixtures.
- [ ] Eval runner v0 over the `evals/` fixtures, including the prompt-injection file.

**Done when** a lawyer can approve, edit and reject suggestions, and approved items appear as tasks
and events.

---

## Day 5 — Tasks, timeline, dashboard

**WEB**
- [ ] Case tasks: list and kanban views.
- [ ] Global `/tasks`: collection-group query, "Assigned to me", overdue badges.
- [ ] Timeline:
  - [ ] Verified and `needs_review` styles.
  - [ ] Add event.
  - [ ] Verify or correct a date.
- [ ] Dashboard: KPI cards, hearing agenda (verified hearings), urgent tasks, recent activity.
- [ ] `/calendar` as a simple agenda of verified events.

**API**
- [ ] `createTask`, `updateTask`, `createEvent`, `updateEvent`, `verifyEvent`, `listCaseActivity`.
- [ ] Collection-group rules for tasks and events.
- [ ] Shared IST date helpers (`dueDateOnly`, overdue logic).
- [ ] `updateCase` refreshes `caseTitle` copies.

**AI**
- [ ] Stretch: `actionPlan.v1` (Prompt B), which adds proposals to the analysis with
      `duplicateOfTaskId`.

**Gate G3: MVP definition of done** (blueprint §2). On dev, run the whole path:
1. Create a case.
2. Upload the sample order.
3. Review the summary with its sources.
4. Approve tasks.
5. Track them on the timeline and the task board.

A second organization sees nothing of it. **P0 is complete at this gate.**

---

## Day 6 — Copilot, Hindi, offline

**WEB**
- [ ] Copilot chat:
  - [ ] Suggested questions.
  - [ ] Answers with source chips that open the PDF at the cited page.
  - [ ] An "insufficient evidence" state.
- [ ] Hindi summary toggle; i18n for navigation and key labels.
- [ ] Offline UX:
  - [ ] Banner.
  - [ ] Actions disabled offline.
  - [ ] "Showing saved data" badge.
  - [ ] Trusted-device setting.
  - [ ] Sign-out wipes the cache.
- [ ] Loading, empty and error states on every screen.

**API**
- [ ] `askCaseCopilot`: MiniSearch retrieval, `chunkId` resolution, quote check.
- [ ] `translateSummary`.
- [ ] Usage counter and quota.
- [ ] `recoverStuckJobs` scheduled function.

**AI**
- [ ] `copilot.v1` (Prompt C) and `translate.v1`.
- [ ] Copilot evals: a supported question cites real chunks; an unsupported question returns
      `insufficientEvidence`.

**Done when** the copilot answers the sample questions with citations that resolve, and an
unsupported question says the documents don't establish the answer.

---

## Day 7 — Hardening and code freeze

- [ ] **Authorization.** Finish the role × callable test matrix. Add Storage tenant-isolation tests.
- [ ] **Bad files.** A renamed `.exe`, an encrypted PDF, an oversize file and a blank PDF are each
      rejected or flagged, with a clear message.
- [ ] **AI reliability.** Run the blueprint §12 checklist through `npm run eval`, and record the
      results for the pitch.
- [ ] **Idempotency.** Re-enqueue a finished job and replay `reviewAnalysis`; neither creates
      duplicates.
- [ ] **Lock down.**
  - [ ] Enforce App Check on Functions and Storage.
  - [ ] Add the CSP header.
  - [ ] CI bundle grep shows no API key.
- [ ] **PWA checklist.** Install on Android Chrome, desktop Chrome and iOS Safari; update prompt;
      offline reload on a trusted device; sign-out wipe; Cache Storage holds only the app shell.
- [ ] **Performance.** Route splitting confirmed; pdf.js worker cached on first use.
- [ ] **Gate G4: code freeze at end of day.** Only fixes after this point.

---

## Day 8 — Demo readiness

- [ ] **Demo data.**
  - [ ] `seed/` script creates the demo organization, members and case `CP-DEMO-001` on
        `casepilot-neural-ninjas`.
  - [ ] `seed/reset` restores it.
  - [ ] A processed fallback analysis is present and carries the "Replayed analysis" badge.
- [ ] **Deploy.** Deploy the tagged build to `casepilot-neural-ninjas`. Set `minInstances: 1` on the four
      demo-path functions.
- [ ] **Rehearse.** Run the blueprint §11 script three times from a clean browser session, once on
      the installed PWA. Record a backup video.
- [ ] **Pitch material.** Export the architecture diagram from ARCHITECTURE §2. Prepare the measured
      eval metrics, including failures and limitations, and the pitch.
- [ ] **After judging.** Revert `minInstances`.

---

## Cut list

Apply from the top when a gate slips. Each line saves roughly half a day.

1. `/calendar` page: link to the timeline instead.
2. Prompt B "Regenerate action plan".
3. Kanban view: keep the list.
4. Hindi summaries and Hindi UI strings.
5. Invitations: seed members with a script instead.
6. Case copilot (P1): cut only if G3 slips past Day 6.

**Never cut:** source references and citation checks, human review before any task or event exists,
tenant isolation tests, audit log, honest fixture labelling.

---

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Claude latency or outage during the demo | Medium | Labelled fixture fallback; `minInstances` warm; rehearsal includes the fallback path |
| Model output fails schema or citation checks | Medium | Zod revalidation; failed analyses retry; unverified items are flagged, not dropped; the eval suite catches regressions |
| Composite indexes still building at the gate | Medium | Deploy indexes on Day 2; the Firestore error message links to the missing index |
| Google sign-in breaks in the installed iOS app | Medium | Redirect fallback, same-origin `authDomain`, `/__/` denylist in the service worker; test on a real iPhone by Day 7 |
| `getBlob` fails in the browser | High on first try | Apply `storage.cors.json` on Day 3 for every bucket and origin, including localhost |
| Workspace package missing at functions deploy | Medium | tsup bundles `packages/shared`; CI runs a deploy dry-run build |
| Region created wrong | Low, but permanent | Day 0 checklist; verify in the console before writing data |
| DOCX citations confuse users | Low | Show "Section n" for DOCX; the demo uses the PDF |
| Cost runaway from retries or abuse | Low | Task-queue `maxAttempts` and `maxConcurrentDispatches`, per-org quota, App Check, Anthropic spend cap |

---

## Acceptance coverage (blueprint §12)

| Checklist area | How it's proven | When |
|---|---|---|
| Core workflow: org, case, upload, extraction, approve/edit/reject, verify date, complete task with audit | Playwright demo-path test with fixture AI, plus a manual run on dev with the live model | G3, re-run Day 7 |
| AI reliability: unknown dates, relative deadlines, conditional directions, garbled text, injection, copilot citations, insufficient evidence, no duplicates | `npm run eval`, plus function tests for duplicates | Day 4 → Day 7 |
| Security: unauthenticated, cross-org, viewer approval, file access, key not in bundle, no content in logs, server-side checks, file signatures | Rules tests, role × callable matrix, Storage rules tests, CI bundle grep, log review | Day 2 → Day 7 |
| Demo readiness: resettable seed, loading/empty/error states, safe AI retry, clean-session run, fallback document | Seed and reset scripts, rehearsal checklist | Day 8 |
