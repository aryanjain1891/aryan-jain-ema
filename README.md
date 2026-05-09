# Insurance Triager

An AI-powered intake and triage system for auto insurance claims (FNOL — First Notice of Loss). Insurance Triager helps claimants file a claim in minutes and gives insurers a structured, AI-assisted assessment so each case lands with the right adjuster — fast.

This README is written from a **user perspective**: what the product does, who it's for, and how to use it. Technical setup details live at the bottom.

---

## Who is this for?

Insurance Triager has two distinct experiences, intentionally kept separate:

- **Claimants (policyholders)** — people who just had an incident and need to file a claim.
- **Insurers (claims teams, adjusters, fraud reviewers)** — people who triage, assess, and route claims internally.

Claimants never see assessment details, fraud flags, or routing decisions. Insurers get the full picture in a dedicated dashboard.

---

## What the product does

### 1. Guided claim intake (Claimant view)

When a claimant lands on the home page, they see a clean intake form. They are walked through:

- **Policy details** — policy number and an upload slot for the policy document (PDF or image). The system parses the document to validate that the policy is real and active.
- **Vehicle details** — make, model, year, VIN, license plate, ownership status, odometer, purchase date.
- **Incident details** — type of incident (collision, theft, vandalism, weather, etc.), date, location, and a free-text description of what happened.
- **Photo & document upload** — photos of the damage, scene, and any supporting documents (FIR, driver's license, etc.).

Everything is stored in the backend the moment it's submitted, so nothing is lost if the user steps away.

### 2. Smart follow-up questions

Once the initial form is submitted, the AI reviews what was provided and asks **adaptive follow-up questions** only where there's a real gap — for example:

- "Was anyone injured?"
- "Is the vehicle currently drivable?"
- "Can you upload a clearer photo of the rear bumper?"

The claimant answers these inline and submits. Optional questions (like "any additional photos?") are not treated as missing information if skipped.

### 3. Confirmation

After follow-ups, the claimant sees a confirmation screen with their **claim number**. They are told the claim is being reviewed and that an adjuster will be in touch. They do **not** see severity scores, fraud signals, or routing — that is reserved for the insurer side.

### 4. Insurer Dashboard (Insurer view)

Accessed via the **Insurer Portal** button on the home page. Protected by a password (`insurer-portal` in this prototype).

The dashboard shows every submitted claim with:

- **Claim list** — claim number, vehicle, incident type, date, location, status, severity, routing decision, and a fraud-investigation badge when relevant.
- **Claim detail view** — full incident description, vehicle and policy details, all uploaded files (with image previews), and the complete Q&A history with the claimant.
- **AI Assessment**, including:
  - **Routing decision** — straight-through, junior adjuster, senior adjuster, specialist, or fraud investigation.
  - **Severity** — low, medium, high, critical.
  - **Estimated repair cost range** and **estimated timeline**.
  - **Vehicle match analysis** — does the vehicle in the photos match the policy vehicle? Any discrepancies are listed.
  - **Damage assessment** — damage types, affected areas, repair complexity, drivability, total-loss risk, safety concerns.
  - **Eligibility alignment** — does the event fall within policy coverage? Are exclusions triggered?
  - **Evidence consistency** — do plates, damage patterns, timestamps, and metadata all line up?
  - **Completeness of information** — are all mandatory fields and required images present?
  - **Gaps & concerns** — outstanding questions or missing evidence (skipped optional items like "additional photos" are excluded).
  - **Legitimacy / fraud indicators** — image authenticity checks and red-flag summary.
  - **Reasoning** — a plain-language explanation of how the AI reached its conclusion.
- **Export PDF** — generate a complete claim report as a downloadable PDF for offline review or sharing.

---

## Typical user journeys

### Claimant journey
1. Open the app → land on the intake page.
2. Fill in policy, vehicle, and incident details; upload photos and the policy document.
3. Submit → answer a few AI-generated follow-up questions.
4. See the confirmation screen with the claim number. Done.

### Insurer journey
1. Click **Insurer Portal** → enter the password.
2. Browse the list of submitted claims; spot fraud-flagged or high-severity claims at a glance.
3. Open a claim → review the full intake, uploaded evidence, Q&A history, and AI assessment.
4. Decide the next action (assign, request more info, escalate to fraud, approve straight-through).
5. Export a PDF report if needed.

---

## Design principles

- **Two audiences, two views.** Claimants get a calm, focused intake. Insurers get a power-user dashboard. Neither sees the other's surface.
- **AI assists, humans decide.** The assessment is a recommendation with reasoning — not an automated approval.
- **Evidence-first.** Photos, documents, and metadata are checked against the claimant's own statements to surface inconsistencies early.
- **Don't badger users.** Follow-up questions only appear where the AI genuinely needs more information; optional items don't get flagged as missing.

---

## Prototype notes

This project is a **prototype for demonstration purposes**. All sample data is intentionally public. The insurer portal is gated by a simple shared password rather than full authentication. None of this is intended for production use as-is.

---

## Tech overview (for developers)

- **Frontend:** React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui, lucide-react icons.
- **Backend:** Lovable Cloud (managed Supabase) — Postgres database, file storage, and edge functions.
- **AI:** Lovable AI Gateway (Google Gemini & OpenAI GPT models) for policy parsing, follow-up question generation, and damage / claim assessment.
- **PDF export:** `jspdf`.

### Edge functions
- `parse-policy-document` — extracts structured data from uploaded policy PDFs/images.
- `validate-policy` — checks that a policy is valid and active.
- `assess-claim` — runs the multi-modal claim assessment (text + images).
- `finalize-assessment` — produces the final routing decision, severity, gaps, and reasoning.

### Database tables
- `claims` — the master claim record (incident, vehicle, policy, AI assessment, routing).
- `claim_files` — uploaded photos and documents tied to a claim.
- `claim_questions` — AI-generated follow-up questions and the claimant's answers.

### Run locally
```bash
npm install
npm run dev
```
The app runs against the Lovable Cloud project configured in `.env` (auto-managed — do not edit by hand).

### Routes
- `/` — claimant intake.
- `/insurer` — insurer dashboard (password-gated).

### Insurer portal password
`insurer-portal` (prototype only).
