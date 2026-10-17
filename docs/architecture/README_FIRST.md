# README_FIRST — Recovery & Fitness App: multi-agent project pack (v1.0, 2026-10-11)

**What this is:** architecture + contracts + 7 ready-to-paste agent prompts + 1 OpenCode integration prompt. **No app code was written or tested.** Nothing here has been run on a device.

## 1. Keep these as the canonical set (do not edit by hand)
`SHARED_CONTRACT.md` · `SHARED_SYMBOL_REGISTRY.md` · `DATA_MODEL_AND_STORAGE.md` · `MASTER_REQUIREMENTS.md` · `MASTER_ARCHITECTURE.md` · `FILE_OWNERSHIP_MAP.md` · `ERROR_HANDLING_AND_SECURITY.md` · `CODING_CONVENTIONS.md` · `AGENT_INTEGRATION_PROTOCOL.md` · `GLOBAL_ACCEPTANCE_TESTS.md`.
(Merged on purpose to save your tokens: requirements+traceability → `MASTER_REQUIREMENTS`; dependency map and agent rationale → `MASTER_ARCHITECTURE`; directory tree → `FILE_OWNERSHIP_MAP`; change control → `AGENT_INTEGRATION_PROTOCOL`; checklist → `integration/MANUAL_ASSEMBLY_GUIDE`; templates → `integration/TEMPLATES`.)

## 2. What to attach and paste for each agent (all seven run at the same time, in separate sessions)
Attach to **every** agent: `SHARED_CONTRACT.md`, `SHARED_SYMBOL_REGISTRY.md`, `DATA_MODEL_AND_STORAGE.md`, `CODING_CONVENTIONS.md`, `ERROR_HANDLING_AND_SECURITY.md`. Then paste the agent's own prompt:

| Agent | Paste | Builds | Size |
|---|---|---|---|
| 1 | `agent-prompts/AGENT_01_PROMPT.md` | Foundation: config, shared types/db/files/settings/safety/UI kit | largest |
| 2 | `AGENT_02_PROMPT.md` | Exercises, session mode, history, reminders | large |
| 3 | `AGENT_03_PROMPT.md` | Food photo log, totals | medium |
| 4 | `AGENT_04_PROMPT.md` | AI estimation (consent, providers) + backup/restore | medium |
| 5 | `AGENT_05_PROMPT.md` | Progress photos, locks, comparisons, Journeys | medium |
| 6 | `AGENT_06_PROMPT.md` | Measurements, journal, charts, daily summary | medium |
| 7 | `AGENT_07_PROMPT.md` | Routes, onboarding, Today, Settings, README | small (any weak model works) |

Give Agent 1 your strongest model if you can; its types/DB are what everyone compiles against. If an agent cuts off, tell it "continue".

## 3. After the agents finish
Follow `integration/MANUAL_ASSEMBLY_GUIDE.md`: laptop setup → assemble folder → checklist → run OpenCode with `opencode/OPENCODE_MASTER_INTEGRATION_PROMPT.md` → build APK → on-phone verification. Files that should sit in the combined folder for OpenCode: the whole pack in `docs/architecture/`, the PDF in `docs/brief/`, and all `handover/AGENT-0X/` folders.

## 4. Decisions I made for you — please skim (change any before starting the agents)
1. **7 agents, not 4–5:** keeps every package within a free model's output limits. Agent 7 is tiny.
2. **Journeys (your "Journey 1, 2, 3" idea):** at Day 90 nothing happens automatically. If you do not start a new journey, new photos are visible immediately (as you asked). If you tap **Start Journey 2** (allowed only once Day 90 is unlocked), Journey 1 is saved and unlocked, and Journey 2 starts **today** with its own Day 30/60/90 locks. I interpreted "from that 90th day" as "from the moment you start it"; if you want to pick a different start date, say so before running Agent 5.
3. **AI providers:** two adapters, **both shipped OFF**: **Groq** (free plan; states no default retention, ≤ 30-day temporary logs, zero-retention option; US data) and **Google Gemini** (free tier **may use your photos to improve Google products and human reviewers may read them**; paid tier does not). I recommend Groq first if you ever enable it. Quality on South Indian dishes is untested — try your own photos. Nothing is sent until you complete the opt-in in Settings; progress photos are never sent. *Approval needed (non-blocking):* tell me if you want either adapter dropped.
4. **`android.allowBackup: false`:** stops Android from silently copying your health data/photos to a Google account; your own Backup export is the backup path (so a new phone needs a restore from your export).
5. **Backup format:** a folder (not ZIP) via Android's folder picker — more reliable for hundreds of MB of photos. Unencrypted, with a warning, as you chose.
6. **Workout calories** use rough constants (light 2.5 / moderate 3.5 / vigorous 5.0 × kg × active hours), shown only with a weight and an intensity, hideable, never combined with food calories.
7. **Expo SDK 57** (stable); SDK 58 is still beta — do not upgrade mid-project.

## 5. Verified vs not verified
Verified 2026-10-11 from official sources: Expo SDK 57/58 status and requirements, local Android build prerequisites, expo-file-system and expo-notifications capabilities, Groq vision model/limits/data policy, Gemini free-tier data use, OpenCode capabilities. **Not verified (OpenCode must check):** exact Expo API call shapes agents write from memory, Gemini request shape and current free model ID, Groq model ID at release time, SAF folder copy behavior, notification timing on your phone, AI estimate quality. Details: `MASTER_ARCHITECTURE.md` §7–8.

## 6. Pack map
`MASTER_REQUIREMENTS` (66 requirements) · `GLOBAL_ACCEPTANCE_TESTS` (52 tests) · registry (302 symbol IDs across 23 areas) · `agent-prompts/` (7) · `opencode/` (1) · `integration/` (assembly guide, templates).
