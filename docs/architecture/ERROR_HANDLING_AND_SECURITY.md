# ERROR_HANDLING_AND_SECURITY.md

**Version 1.0.** Privacy, safety and reliability rules from the brief (§1, §4, §7, §12) translated into enforceable constraints. Weakening any rule to make a build or test pass is forbidden (CHANGE request + user approval required).

## 1. Privacy and security rules
| ID | Rule | Enforced where | Verified by |
|---|---|---|---|
| SEC-01 | Local-first: all records and photos stay on device by default | Architecture; no backend | GAT-001 |
| SEC-02 | No analytics, crash reporters, ads, remote config; no network code outside `src/modules/nutrition-ai/**` | Dependency list; layering script (grep for `fetch(`, `XMLHttpRequest`, `WebSocket`, analytics package names) | GAT-012 |
| SEC-03 | A meal image leaves the device only if: `ai.externalAnalysisEnabled` ∧ provider chosen ∧ consent matches provider+disclosureVersion ∧ API key present ∧ entry not opted out | A3 `analyzeFoodEntry` (opt-out), A4 `getAnalysisAvailability` + `estimateNutritionFromImage` | GAT-013..016 |
| SEC-04 | Progress photos are never sent anywhere; estimator rejects any URI not under `food/` | A4 | GAT-017 |
| SEC-05 | Only hosts `api.groq.com` and `generativelanguage.googleapis.com` may be contacted | A4 `httpClient.ts` allow-list | GAT-018 |
| SEC-06 | API keys only in secure storage; never in SQLite, backup, logs, source, `app.json` | A1 `secureStorage`, A4 | GAT-019 |
| SEC-07 | Images/base64/URIs/notes never logged; no images in error messages | A1 `logger` redaction; code review | GAT-020 |
| SEC-08 | Locked progress photos expose no path/thumbnail/URI until unlocked (`imageUri: null`) | A5 data layer | GAT-021..026 |
| SEC-09 | Early unlock needs explicit confirmation and only unlocks the next pending milestone | A5 service + UI `confirmAction` | GAT-023 |
| SEC-10 | Photos stored in app-private storage with opaque names; capture without EXIF; no gallery writes | A1 `photoStorage`, `PhotoCapture` | GAT-027 |
| SEC-11 | Android auto-backup disabled | `app.json` | GAT-040 |
| SEC-12 | Backups are unencrypted by user decision; UI must show `BACKUP_PRIVACY_WARNING` before export and before restore | A4 | GAT-033 |
| SEC-13 | Restore requires explicit confirmation, validates before touching data, is atomic, resets AI consent, never imports keys | A4 | GAT-034..036 |
| SEC-14 | Lock note and storage caveats are shown in UI (`LOCK_NOTE_TEXT`) | A5, A7 | GAT-028 |

## 2. Medical-safety rules
| ID | Rule | Where | Test |
|---|---|---|---|
| SAF-01 | First launch requires the fixed disclaimer acknowledgement | A7 onboarding | GAT-002 |
| SAF-02 | Exercises come only from the user's own entries; no built-in medical exercise library; no automatic progression/regression of reps, sets, duration, rest | A2 | GAT-005 |
| SAF-03 | Symptom flags or user-set pain alert level ⇒ `SafetyAdviceCard` with fixed text; app invents no clinical threshold; plan never changes | A1 `evaluateSymptomReport`, A2, A6 | GAT-009..011 |
| SAF-04 | No diagnosis, rehab-stage, return-to-sport, or diet-prescription output anywhere; nutrition targets are user-entered | all | review |
| SAF-05 | Estimates labelled approximate (`ESTIMATE_DISCLAIMER_TEXT`, badges AI estimate / Confirmed / Manual / Unknown); no false precision (kcal to integer, grams to 1 decimal) | A3, A6 | GAT-014 |
| SAF-06 | Workout calories are rough, hideable, separate from intake and never summed with it; no TDEE/net calories | A1, A2, A6 | GAT-029..031 |
| SAF-07 | Measurements/photos are not presented as proof of muscle recovery; daily weight changes are not interpreted | A6 | review |

## 3. Reliability and error-handling rules
1. **Food logging never fails because of AI.** `createFoodEntryFromPhoto` succeeds with only a local save; analysis errors become entry status (`pending` for offline/network/rate-limit, `failed` otherwise) with a retry button; manual nutrition entry is always available.
2. **Permissions:** camera denial → explanation + "Open settings" (`PhotoCapture`); notification denial → toggles stay off with explanation + "Open settings"; never request at launch.
3. **Writes are transactional:** multi-row writes (`saveSession`, restore) use `db.transaction`. A failed photo copy must not leave a DB row; a failed DB insert must delete the copied photo.
4. **Deletion:** deleting an entry/photo removes the DB row and the file; a missing file is not an error.
5. **Persistence:** all state survives app restart (DATA_MODEL §5). Pending analyses resume (`processPendingAnalyses`).
6. **Date safety:** day numbers use device local calendar days and `LocalDate` math only (no `Date` subtraction/86400000); timezone/DST changes cannot shift milestones or reminder dates.
7. **Reminders:** idempotent rebuild; no duplicates; skip completed tasks; permission/battery explanation (CONTRACT §9).
8. **User-visible errors** are short and actionable ("Couldn't reach the analysis service. Your photo is saved; try again later."). Raw provider responses and stack traces are never shown or logged.
9. **Defensive parsing:** every JSON column and every AI response is validated; failures degrade to safe defaults.

## 4. Text that must be shown (verbatim constants, CONTRACT §6)
Disclaimer (onboarding + Settings About), safety advice (symptom triggers), estimate disclaimer (food entry + Settings About), lock note (Photos + Settings About), backup warning (Backup screen + before restore), battery note (Reminder settings). Provider disclosure (CONTRACT §7) must be shown before external analysis can be enabled.
