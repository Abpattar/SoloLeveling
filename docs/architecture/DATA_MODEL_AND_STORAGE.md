# DATA_MODEL_AND_STORAGE.md

**Version 1.0 · 2026-10-11.** Schema owner: Agent 01 (`src/shared/db/migrations.ts`, migration #1). Every other agent writes SQL ONLY for tables it owns (see TBL list in the registry) and only against the exact DDL below. A needed column/table change is a CHANGE request, not a local edit.

## 1. Storage principles
- SQLite database file `recovery_fitness.db` via `expo-sqlite`; photos are files under the app-private document directory; **SQLite stores only relative photo paths and metadata, never image bytes**.
- API keys live in Android Keystore-backed secure storage only (`secureStorage`), never in SQLite, backups, logs, or source.
- Android auto-backup is disabled (`android.allowBackup: false` in `app.json`) so health records and photos are not silently copied to a cloud account; the app's own export/restore is the supported backup path.
- Derived values are never stored: **day numbers, milestone lock status, photo visibility, daily/weekly nutrition totals, and daily summaries are always computed** from stored facts (start date, early-unlock rows, entries). Cached values are not allowed in v1.
- Photo files: `<documentDirectory>/private-media/food/<entryId>.jpg` and `<documentDirectory>/private-media/progress/<photoId>.jpg`; DB stores `food/<entryId>.jpg` / `progress/<photoId>.jpg`. File names carry no date/meal/person information. Camera captures are taken with `exif: false`.

## 2. DDL (migration #1 — `PRAGMA user_version = 1`; `PRAGMA foreign_keys = ON` at open)
```sql
CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  height_cm REAL,
  unit_system TEXT NOT NULL DEFAULT 'metric' CHECK (unit_system IN ('metric','imperial')),
  baseline_weight_kg REAL,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  disclaimer_acknowledged_at TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE settings (            -- exactly one row: key 'app', value = JSON AppSettings (no secrets)
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE journeys (
  id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, start_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','completed')), completed_on TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_journeys_one_active ON journeys(status) WHERE status = 'active';
CREATE TABLE early_unlocks (
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  milestone_day INTEGER NOT NULL CHECK (milestone_day IN (30,60,90)),
  unlocked_at TEXT NOT NULL, PRIMARY KEY (journey_id, milestone_day)
);
CREATE TABLE exercises (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, instructions TEXT,
  sets INTEGER NOT NULL DEFAULT 1 CHECK (sets >= 1), reps INTEGER, duration_seconds INTEGER,
  rest_seconds INTEGER NOT NULL DEFAULT 0 CHECK (rest_seconds >= 0),
  schedule_days TEXT NOT NULL DEFAULT '[]',            -- JSON array of ISO weekdays 1..7
  clinician_notes TEXT,
  intensity TEXT CHECK (intensity IN ('light','moderate','vigorous')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT, local_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed','stopped')),
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  effort_rating INTEGER CHECK (effort_rating BETWEEN 1 AND 10), notes TEXT,
  pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
  symptom_flags TEXT NOT NULL DEFAULT '[]',            -- JSON array of SymptomFlag
  estimated_kcal REAL, created_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_local_date ON sessions(local_date);
CREATE TABLE session_exercise_results (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL, exercise_name TEXT NOT NULL,
  planned_sets INTEGER NOT NULL, planned_reps INTEGER, planned_duration_seconds INTEGER,
  completed_sets INTEGER NOT NULL DEFAULT 0, completed_reps INTEGER,
  active_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('completed','partial','skipped')),
  intensity TEXT CHECK (intensity IN ('light','moderate','vigorous')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_ser_session ON session_exercise_results(session_id);
CREATE TABLE meal_categories (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0, archived_at TEXT
);
INSERT INTO meal_categories (id, name, is_default, sort_order) VALUES
  ('meal-breakfast','Breakfast',1,0), ('meal-lunch','Lunch',1,1),
  ('meal-dinner','Dinner',1,2), ('meal-snacks','Snacks',1,3);
CREATE TABLE food_entries (
  id TEXT PRIMARY KEY,
  meal_category_id TEXT NOT NULL REFERENCES meal_categories(id) ON DELETE RESTRICT,
  image_path TEXT NOT NULL, captured_at TEXT NOT NULL, local_date TEXT NOT NULL,
  note TEXT, description TEXT, foods_json TEXT NOT NULL DEFAULT '[]', portion_text TEXT,
  calories_kcal REAL, protein_g REAL, carbs_g REAL, fat_g REAL,
  nutrition_source TEXT NOT NULL DEFAULT 'none'
    CHECK (nutrition_source IN ('none','ai_estimate','confirmed','manual','unknown')),
  confidence TEXT NOT NULL DEFAULT 'unknown' CHECK (confidence IN ('unknown','low','medium','high')),
  analysis_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (analysis_status IN ('not_requested','pending','in_progress','succeeded','failed','skipped_by_user')),
  analysis_opt_out INTEGER NOT NULL DEFAULT 0,
  analysis_provider TEXT, analysis_error TEXT, analyzed_at TEXT,
  clarification_json TEXT,                              -- JSON ClarificationQuestion or NULL
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_food_local_date ON food_entries(local_date);
CREATE TABLE progress_photos (
  id TEXT PRIMARY KEY, journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL, captured_at TEXT NOT NULL, captured_on TEXT NOT NULL,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  category TEXT CHECK (category IN ('front','side','back','other')), created_at TEXT NOT NULL
);
CREATE INDEX idx_photos_journey ON progress_photos(journey_id, captured_on);
CREATE TABLE measurements (
  id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK (type IN ('weight','waist','thigh','custom')),
  custom_label TEXT, value REAL NOT NULL, unit TEXT NOT NULL,
  measured_at TEXT NOT NULL, local_date TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
);
CREATE INDEX idx_meas_type_date ON measurements(type, local_date);
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY, local_date TEXT NOT NULL, recorded_at TEXT NOT NULL,
  pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
  stiffness_score INTEGER CHECK (stiffness_score BETWEEN 0 AND 10),
  swelling_level TEXT CHECK (swelling_level IN ('none','mild','moderate','significant')),
  symptom_flags TEXT NOT NULL DEFAULT '[]', notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_journal_date ON journal_entries(local_date);
```
**DB_SCHEMA_VERSION = 1.** **DB_TABLES_IN_RESTORE_ORDER** = `['profile','settings','journeys','early_unlocks','exercises','sessions','session_exercise_results','meal_categories','food_entries','progress_photos','measurements','journal_entries']` (delete in reverse order, insert in this order).

## 3. Column ↔ field mapping (selected non-obvious)
| Table.column | TS field | Notes |
|---|---|---|
| `food_entries.calories_kcal/protein_g/carbs_g/fat_g` | `nutrition.caloriesKcal/proteinGrams/carbsGrams/fatGrams` | NULL = unknown |
| `food_entries.foods_json` | `foods: FoodItem[]` | invalid JSON → `[]` |
| `food_entries.clarification_json` | `pendingClarification` | |
| `food_entries.analysis_opt_out` | `analysisOptOut` | per-photo "do not send" |
| `exercises.schedule_days` | `scheduleDays: Weekday[]` | |
| `sessions.symptom_flags`, `journal_entries.symptom_flags` | `symptomFlags` | |
| `progress_photos.captured_on` | `capturedOn` | local day at capture; day number = `getDayNumber(journey.startDate, capturedOn)` |
| `profile.*` | `Profile` | one row, id = 1, created lazily by `getProfile()` |

## 4. Totals & summaries (derivation rules)
- **Daily nutrition totals** (A3): include entries whose `nutrition_source ∈ {ai_estimate, confirmed, manual}` and `calories_kcal IS NOT NULL`; sum calories/protein (null protein counts as 0 but entry still counted); carbs/fat sum only non-null values (null if none). `bySource` splits the three sources; `entriesWithoutValues` counts entries with source `none`/`unknown` or null calories. Meal subtotals group by `meal_category_id`.
- **Workout calories** are per-session (`sessions.estimated_kcal`) and displayed separately; never added to intake; hidden when `settings.display.showCalorieEstimates === false`.
- **Weight trend** (A6): one point per date (latest entry that date, in kg) plus a 7-day trailing average over available points; fluctuations are not interpreted ("Day-to-day changes are normal" caption).

## 5. Persistence checks (must hold after app restart)
Exercises, sessions, food entries (+images), measurements, journal, journeys, early unlocks, settings and profile all reload identically; locked photos stay locked; pending analyses stay `pending`.
