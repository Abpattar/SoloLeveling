# MASTER_REQUIREMENTS.md (requirements + traceability)

**Version 1.0.** Source column: `B§n` = brief section n; `[USER]` = user's Phase 0 answers (override/extend the brief). Pri: M = must, S = should. Agent = implementing owner(s). Tests = IDs in GLOBAL_ACCEPTANCE_TESTS.md (GAT) plus module unit tests. Status starts at `SPEC`; OpenCode updates to `INTEGRATED` / `VERIFIED` / `BLOCKED` in `FINAL_INTEGRATION_REPORT.md`.

| ID | Requirement | Source | Pri | Agent | Key symbols / files | GAT |
|---|---|---|---|---|---|---|
| REQ-PRD-001 | Personal use only; no accounts, social features, or cloud backend | B§1 | M | all | architecture | 001 |
| REQ-PRD-002 | Android first, portable architecture | B§1 | M | all | Expo SDK 57 | 045 |
| REQ-PRD-003 | Local-first: photos/health records on device; nothing uploaded without opt-in | B§1,§12 | M | A4, A1 | API-AI-001/002, CONTRACT §7 | 013 |
| REQ-PRD-004 | Records/reminds only exercises the user enters; no diagnosis, prescribing, auto-progression | B§1,§12 | M | A1, A2 | API-SAFE-001, training | 005 |
| REQ-PRD-005 | Dependable basics before clever features (verification follows brief phases 1→6) | B§1 | S | OpenCode | OpenCode prompt | 045 |
| REQ-PRD-006 | Free/local tools; no paid services or subscriptions by default | B§0,§15 [USER] | M | all | approved dependency list | 012 |
| REQ-NAV-001 | Sections exist: Today, Exercises, Session mode, Food log, Measurements, Progress photos, Progress, Recovery journal | B§2 | M | A7 + modules | CONTRACT §4 | 051 |
| REQ-EXR-001 | Add/edit/reorder/pause/remove exercises with name, instructions, sets, reps, duration, rest, schedule, clinician notes (+ optional intensity) | B§3 | M | A2 | API-TRN-001..007 | 003 |
| REQ-EXR-002 | User's own list is the source of truth; no built-in medical library | B§3 | M | A2 | training | 005 |
| REQ-EXR-003 | Configurable local notifications to start a session | B§3,§9 | M | A2 | API-REM-001/002, CMP-REM-001 | 006 |
| REQ-SES-001 | Session mode: one exercise at a time; set/rep counters; timers; rest periods | B§3 | M | A2 | CMP-TRN-003, sessionMachine | 004 |
| REQ-SES-002 | Pause, skip, stop; saves date/time, exercises, sets/reps/duration, optional effort and symptom notes | B§3 | M | A2 | API-TRN-008, 012 | 004 |
| REQ-SES-003 | Worsening/new symptoms → conservative stop-and-contact-clinician advice; plan never auto-changes | B§3 | M | A1, A2 | API-SAFE-001, CMP-SAFE-001/002 | 009 |
| REQ-SES-004 | [USER] symptom checklist + optional 0–10 pain; user-set optional alert level; no invented clinical thresholds | [USER] | M | A1, A2, A7 | TYPE-SAFE-001..003, settings.safety | 009, 010 |
| REQ-SES-005 | Completion history and session detail | B§3 | S | A2 | CMP-TRN-005/006 | 004 |
| REQ-SES-006 | Today shows today's plan, completion state | B§2 | M | A2, A7 | CMP-TRN-007 | 004 |
| REQ-FOOD-001 | Camera-first logging per breakfast/lunch/dinner/snacks + custom categories; multiple entries per meal | B§4 | M | A3 | CMP-FOOD-002, API-FOOD-001..006 | 037, 048 |
| REQ-FOOD-002 | Image stored privately with date/time, category, optional note, processing status | B§4 | M | A3, A1 | API-FILE-001, TYPE-FOOD-008 | 027, 037 |
| REQ-FOOD-003 | Calories/protein from photo only via configured, consented vision AI; photos alone are not exact | B§4 | M | A4, A3 | API-AI-002 | 013..016 |
| REQ-FOOD-004 | Estimates shown with uncertainty; at most one lightweight confirmation when it materially changes the estimate | B§4 | M | A4, A3 | TYPE-AI-001, API-FOOD-015 | 038 |
| REQ-FOOD-005 | Food search is never the normal workflow (no food database) | B§4 | M | A3 | — | 037 |
| REQ-FOOD-006 | User can correct food/portion, edit calories/protein, mark unknown; nothing learned silently | B§4 | M | A3 | API-FOOD-009..013 | 038 |
| REQ-FOOD-007 | Daily totals sum saved entries (calories, protein, optional carbs/fat); weekly averages/trends | B§4 | M | A3, A6 | API-FOOD-017/018 | 039, 042 |
| REQ-FOOD-008 | If AI unavailable the photo still saves; nutrition entered manually later; logging never fails because of an API | B§4,§12 | M | A3 | API-FOOD-006/010 | 037, 038 |
| REQ-FOOD-009 | Recognition only when configured + consented; strict-privacy option = manual entry | B§4 | M | A4, A3 | API-AI-001 | 013 |
| REQ-FOOD-010 | Never claim estimates are exact | B§4 | M | A3, A6 | CONST-TEXT-004, NutritionBadge | 014 |
| REQ-FOOD-011 | [USER] Estimator handles Indian/South Indian dishes and household portions (bowl, cup, piece, common servings) | [USER] | M | A4 | prompt.ts | 038 |
| REQ-FOOD-012 | [USER] Research free providers; AI stays disabled until user approves provider/cost/privacy; global opt-in + per-photo opt-out | [USER] | M | A4, A3 | CONTRACT §7, API-AI-003 | 013, 015, 016 |
| REQ-NUT-001 | Daily summary: food estimates, calories/protein, optional macros, exercise status, measurements | B§8 | M | A6 | API-PRG-001 | 049 |
| REQ-NUT-002 | Meal-level subtotals; edit an entry whose estimate is wrong | B§8 | M | A3, A6 | TYPE-FOOD-011 | 039 |
| REQ-NUT-003 | Confirmed values visibly distinct from AI estimates and manual entries | B§8 | M | A3, A6 | NutritionBadge | 014 |
| REQ-NUT-004 | No diet prescriptions; optional user-set targets only | B§8 | M | A3, A6 | CMP-FOOD-006 | 039 |
| REQ-MEAS-001 | Profile: height, preferred units, start date, optional baseline weight | B§5 | M | A7, A1, A5 | API-SET-001/002, API-PHOTO-002 | 002, 041 |
| REQ-MEAS-002 | Dated weight entries; simple trend graph; no interpretation of daily fluctuation | B§5 | M | A6 | API-BODY-001/005, LineChart | 041, 042 |
| REQ-MEAS-003 | Optional waist/thigh/user-defined measurements with unit and date | B§5 | M | A6 | TYPE-BODY-001..003 | 041 |
| REQ-MEAS-004 | Show change from baseline and weekly/monthly trends without claiming proof of muscle recovery | B§5 | M | A6 | trends.ts | 041, 042 |
| REQ-ACT-001 | Track completed exercise type, duration, sets, repetitions | B§6 | M | A2 | TYPE-TRN-008/009 | 004 |
| REQ-ACT-002 | Workout calories only when a reasonable estimate exists; labelled as estimate | B§6 | M | A1, A2 | API-ACT-001/002, CONST-TEXT-006 | 029, 031 |
| REQ-ACT-003 | Workout calories distinct from daily energy expenditure; no double counting | B§6 | M | A2, A6 | DailySummary.estimatedWorkoutKcal | 030 |
| REQ-ACT-004 | User can hide calorie-burn estimates | B§6 | M | A7, A2, A6 | settings.display.showCalorieEstimates | 029 |
| REQ-ACT-005 | [USER] Optional light/moderate/vigorous intensity per exercise drives the estimate | [USER] | M | A2, A1 | INTENSITY_MET | 031 |
| REQ-PHO-001 | Day 1 = chosen start date; day numbers are local calendar days | B§7 | M | A1, A5 | API-DATE-006 | 024 |
| REQ-PHO-002 | Progress-photo prompt after each completed session; skip never blocks completion | B§7 | M | A5, A2 | CMP-PHOTO-007 | 052 |
| REQ-PHO-003 | App-private storage; no public gallery; no automatic upload | B§7 | M | A1, A5 | API-FILE-001, PhotoCapture | 027 |
| REQ-PHO-004 | Photos and thumbnails hidden until Day 30/60/90; locked status + unlock date only | B§7 | M | A5 | TYPE-PHOTO-005/006 | 021, 022 |
| REQ-PHO-005 | Day 1 vs Day 30/60/90 comparisons; selected-day timeline/collage for eligible photos | B§7 | M | A5 | API-PHOTO-012/013 | 032 |
| REQ-PHO-006 | Deliberate "Unlock early" with confirmation; never silent | B§7 | M | A5 | API-PHOTO-009 | 023 |
| REQ-PHO-007 | Delete and export photos; explain app-private storage is not an absolute guarantee | B§7 | M | A5 | API-PHOTO-010/011, CONST-TEXT-005 | 028, 043 |
| REQ-PHO-008 | [USER] Unlock at first milestone ≥ day number; after Day 90 new photos visible; early unlock = next pending only; warn when editing start date; "motivation, not encryption" | [USER] | M | A5 | CONTRACT §10 | 022..025, 028 |
| REQ-PHO-009 | [USER] Journeys: after Day 90 the journey is saved and the user may start Journey 2, 3… (each 90 days, own locks) | [USER] | M | A5, A7 | API-PHOTO-005 | 026 |
| REQ-REM-001 | Configurable daily exercise reminder; optional meal/photo prompts; optional end-of-day summary | B§9 | M | A2 | CMP-REM-001, CONTRACT §9 | 006 |
| REQ-REM-002 | Android local notifications; handle permission denial; explain battery optimisation | B§9 | M | A2 | CONST-TEXT-008 | 008 |
| REQ-REM-003 | No duplicate reminders; no nagging for tasks known complete | B§9 | M | A2 | scheduler.ts | 006, 007 |
| REQ-JRN-001 | Optional pain, stiffness, swelling, general notes — tracking only | B§2 | M | A6 | API-JRN-001..006 | 011, 047 |
| REQ-DATA-001 | SQLite for all records; photo paths/metadata in DB, files on disk | B§10 | M | A1 | DATA_MODEL | 044 |
| REQ-DATA-002 | Export/backup and restore; explain local-only data can be lost | B§10,§12 | M | A4 | API-BKP-001..003 | 033, 034 |
| REQ-DATA-003 | [USER] Backups include all data and locked photos, preserve dates and lock states, unencrypted with warning, restore needs confirmation | [USER] | M | A4 | CONTRACT §8 | 033..036 |
| REQ-DATA-004 | All data persists across restart | B§14 | M | all | DATA_MODEL §5 | 044 |
| REQ-PRIV-001 | No analytics trackers; no images in logs/crash reports | B§12 | M | all | API-CORE-007 | 012, 020 |
| REQ-PRIV-002 | API keys outside source control, stored securely | B§10 | M | A1, A4 | API-SEC-001..003 | 019 |
| REQ-PRIV-003 | Explain cloud vision retention/terms; allow disabling | B§12 | M | A4 | CONTRACT §7 catalog | 015 |
| REQ-REL-001 | Camera, notification, network/API failures handled gracefully | B§12 | M | A1, A2, A3, A4 | PhotoCapture, REM, AI | 008, 038 |
| REQ-TECH-001 | React Native + Expo (SDK 57), TypeScript, Android | B§10 | M | A1 | CONTRACT §1 | 045 |
| REQ-TECH-002 | README: build/run, permissions, local storage, optional API configuration, privacy trade-offs, known limitations | B§14 | M | A7, OpenCode | README.md | 046 |
| REQ-TECH-003 | [USER] Dev APK on phone from Ubuntu 24.04; clear setup instructions; no device assumptions | [USER] | M | OpenCode, A7 | MANUAL_ASSEMBLY_GUIDE | 045 |
| REQ-TECH-004 | Tests for: offline food save, recognition failure, manual correction, portion scaling, duplicate reminders, date/milestone math, early unlock, deletion, persistence after restart | B§15 | M | owners | module tests | 006, 023, 024, 037, 038, 043, 044 |
