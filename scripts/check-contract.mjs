#!/usr/bin/env node
/**
 * INTEGRATION CONTRACT: GAT-052 / GAT-053
 * Purpose: Stage 8 integration gate. Enforces the rules that are cheap to check statically so a
 *          human does not have to read every file to know the architecture still holds:
 *
 *   1. Layering   — SHARED_CONTRACT.md §2.7. src/shared never imports modules/shell/app; modules
 *                   only reach other modules through their index.ts; only the edges in §2.8 exist.
 *   2. Hygiene    — no `any`, no `@ts-ignore`, no `console.*` outside the single logger sink.
 *   3. SQL        — no string-concatenated SQL; queries must be parameterized (SHARED_CONTRACT §2.5).
 *   4. Safety     — no "net calories"/TDEE wording anywhere (GAT-030).
 *   5. Routes     — every CONTRACT §4 route file exists, renders its named component, and stays a
 *                   thin wrapper with no business logic.
 *
 * Exit code 0 when clean, 1 otherwise. No dependencies beyond Node's stdlib.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

/** SHARED_CONTRACT.md §2.8 — the only module → module edges allowed. */
const ALLOWED_MODULE_EDGES = new Map([
  ['training', ['photos']],
  ['reminders', ['training', 'food']],
  ['food', ['nutrition-ai']],
  ['progress', ['training', 'food', 'body', 'journal']],
  // backup, photos, nutrition-ai, body and journal import no modules at all.
  ['backup', []],
  ['photos', []],
  ['nutrition-ai', []],
  ['body', []],
  ['journal', []],
]);

/** SHARED_CONTRACT.md §4 — route file → component it must render. */
const ROUTE_TABLE = [
  ['(tabs)/index.tsx', 'TodayScreen'],
  ['(tabs)/exercises.tsx', 'ExerciseListScreen'],
  ['(tabs)/food.tsx', 'FoodLogScreen'],
  ['(tabs)/photos.tsx', 'PhotosHomeScreen'],
  ['(tabs)/progress.tsx', 'ProgressScreen'],
  ['onboarding.tsx', 'OnboardingScreen'],
  ['settings.tsx', 'SettingsScreen'],
  ['exercise/new.tsx', 'ExerciseEditorScreen'],
  ['exercise/[exerciseId].tsx', 'ExerciseEditorScreen'],
  ['session/run.tsx', 'SessionRunScreen'],
  ['session/complete/[sessionId].tsx', 'SessionCompleteScreen'],
  ['session/history.tsx', 'SessionHistoryScreen'],
  ['session/[sessionId].tsx', 'SessionDetailScreen'],
  ['food/capture.tsx', 'FoodCaptureScreen'],
  ['food/entry/[entryId].tsx', 'FoodEntryScreen'],
  ['food/categories.tsx', 'MealCategoriesScreen'],
  ['photos/capture.tsx', 'ProgressPhotoCaptureScreen'],
  ['photos/compare/[journeyId]/[milestoneDay].tsx', 'PhotoComparisonScreen'],
  ['photos/timeline/[journeyId].tsx', 'PhotoTimelineScreen'],
  ['photos/journeys.tsx', 'JourneysScreen'],
  ['measurements.tsx', 'MeasurementsScreen'],
  ['journal/index.tsx', 'JournalScreen'],
  ['journal/[entryId].tsx', 'JournalEntryScreen'],
  ['summary/[date].tsx', 'DailySummaryScreen'],
  ['backup.tsx', 'BackupScreen'],
];

const failures = [];
const fail = (file, rule, message) => failures.push({ file, rule, message });

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(SRC);
const rel = (f) => relative(ROOT, f).split(sep).join('/');

/** Import specifiers in a source file, from `import ... from 'x'` and `require('x')`. */
function importsOf(text) {
  const specs = [];
  const importRe = /(?:^|\n)\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of text.matchAll(importRe)) specs.push(m[1]);
  for (const m of text.matchAll(requireRe)) specs.push(m[1]);
  return specs;
}

function moduleOf(file) {
  const parts = rel(file).split('/');
  const idx = parts.indexOf('modules');
  if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
  if (parts.includes('shell')) return 'shell';
  if (parts.includes('app')) return 'app';
  if (parts.includes('shared')) return 'shared';
  return null;
}

/** Strip comments and string bodies so pattern checks do not fire on prose or test fixtures. */
function codeOf(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/(['"])(?:\\.|(?!\1)[^\\\n])*\1/g, "''");
}

// ---------------------------------------------------------------- 1. layering
for (const file of files) {
  const owner = moduleOf(file);
  if (owner === null) continue;
  const isTest = file.includes(`${sep}__tests__${sep}`);

  for (const spec of importsOf(readFileSync(file, 'utf8'))) {
    // §2.7 — shared must never reach up, and production code must not import test helpers.
    if (owner === 'shared') {
      if (/^@\/modules\//.test(spec)) {
        fail(rel(file), 'layering', `src/shared must not import ${spec} (§2.7)`);
      }
      if (/^@\/shell\//.test(spec) || /^@\/app\//.test(spec)) {
        fail(rel(file), 'layering', `src/shared must not import ${spec} (§2.7)`);
      }
      if (!isTest && /@\/shared\/.*\/testing\//.test(spec)) {
        fail(rel(file), 'layering', `production code must not import test helper ${spec} (§2.7)`);
      }
      continue;
    }

    const moduleImport = spec.match(/^@\/modules\/([a-z-]+)(\/(.*))?$/);
    if (!moduleImport) continue;

    const [, target, , internal] = moduleImport;

    // §2.7 — a module may always import its OWN files by relative path. The index-only and
    // edge rules below apply to reaching a DIFFERENT module.
    if (target === owner) {
      continue;
    }

    if (owner === 'shell' || owner === 'app') {
      // §2.7 — shell and app may import any module index, but never a module internal file.
      if (internal) {
        fail(rel(file), 'layering', `${owner} must import @/modules/${target}, not its internal ${spec}`);
      }
      continue;
    }

    // A module reaching a different module: index only, and only along a §2.8 edge.
    // Tests are exempt from the edge rule — a test may set up any module it exercises — but they
    // still import through the public index.
    if (internal) {
      fail(rel(file), 'layering', `modules must import @/modules/${target}, not its internal ${spec} (§2.7)`);
      continue;
    }
    if (isTest) {
      continue;
    }
    const allowed = ALLOWED_MODULE_EDGES.get(owner) ?? [];
    if (!allowed.includes(target)) {
      fail(rel(file), 'layering', `${owner} → ${target} is not an allowed edge (§2.8)`);
    }
  }
}

// ------------------------------------------------------- 2. language hygiene
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const code = codeOf(text);
  const isTest = file.includes(`${sep}__tests__${sep}`);

  if (/:\s*any\b|<any>/.test(code)) {
    fail(rel(file), 'hygiene', 'uses `any` (hard rule 1)');
  }
  if (/@ts-ignore|@ts-expect-error/.test(code)) {
    fail(rel(file), 'hygiene', 'uses @ts-ignore / @ts-expect-error (hard rule 1)');
  }
  // logger.ts is the single sanctioned console sink.
  if (!rel(file).endsWith('src/shared/utils/logger.ts')) {
    const consoleUse = code.match(/console\.[a-z]+/g);
    if (consoleUse) {
      fail(rel(file), 'hygiene', `uses ${[...new Set(consoleUse)].join(', ')} outside the logger sink`);
    }
  }
  if (!isTest && /await\s+import\(/.test(code)) {
    fail(rel(file), 'hygiene', 'dynamic await import() is not allowed');
  }
}

// ------------------------------------------------------------- 3. SQL safety
/**
 * Interpolating a *SQL fragment* is safe and is how these repositories are written, because SQLite
 * cannot bind identifiers or LIMIT/OFFSET. Interpolating a *value* is not. So the rule is: a SQL
 * template must start with a statement keyword, and every expression it interpolates must be a
 * known-safe fragment identifier. Anything else is a value and gets flagged.
 *
 * Allowlist, with the reason each one is safe:
 *  - where / whereClause / filterClause — assembled from `"col = ?"` clauses; values stay bound.
 *  - orderBy / limitClause / limit — limit is validated with Number.isInteger and clamped to 500.
 *  - columns / *_COLUMNS / columns.join('') / placeholders — column names checked against the live
 *    schema; placeholders are generated '?' marks.
 *  - table / MAX_PER_RUN — iterated from DB_TABLES_IN_RESTORE_ORDER, or a literal constant.
 */
const SQL_FRAGMENT_ALLOWLIST = new Set([
  'where',
  'whereClause',
  'filterClause',
  'orderBy',
  'limitClause',
  'limit',
  'columns',
  'columns.join(\'\')',
  'columns.join(", ")',
  'placeholders',
  'table',
  'MAX_PER_RUN',
]);

/** Column-list constants such as FOOD_ENTRY_COLUMNS. */
const isColumnListConstant = (expr) => /^[A-Za-z_]*_?COLUMNS$/.test(expr);

const isSqlFragment = (expr) =>
  SQL_FRAGMENT_ALLOWLIST.has(expr) || isColumnListConstant(expr);

for (const file of files) {
  if (file.includes(`${sep}__tests__${sep}`)) continue; // tests may build fixture SQL
  const code = codeOf(readFileSync(file, 'utf8'));

  for (const m of code.matchAll(/`([^`]*\$\{[^`]*`)/g)) {
    const template = m[1];
    const trimmed = template.trimStart();
    if (!/^(SELECT|INSERT|UPDATE|DELETE|WITH|REPLACE)\b/i.test(trimmed)) {
      continue; // not a SQL statement — an ordinary template string
    }
    const expressions = [...template.matchAll(/\$\{([^}]*)\}/g)].map((e) => e[1].trim());
    const unsafe = expressions.filter((expr) => !isSqlFragment(expr));
    if (unsafe.length > 0) {
      fail(
        rel(file),
        'sql',
        `SQL interpolates a value, not a fragment: ${unsafe.join(', ')} — use a parameterized query (§2.5)`,
      );
    }
  }

  if (/"(?:SELECT|INSERT|UPDATE|DELETE)\s[^"]*"\s*\+/.test(code)) {
    fail(rel(file), 'sql', 'SQL built by string concatenation — use a parameterized query');
  }
}

// --------------------------------------------------------- 4. medical safety
const FORBIDDEN_WORDING = [
  /\bnet\s+calories?\b/i,
  /\bTDEE\b/i,
  /\btotal\s+daily\s+energy\s+expenditure\b/i,
];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN_WORDING) {
    if (pattern.test(text)) {
      fail(rel(file), 'safety', `forbidden wording ${pattern} (GAT-030: workout calories are never combined with intake)`);
    }
  }
}

// ------------------------------------------------------------------ 5. routes
const appDir = join(SRC, 'app');
for (const [routeFile, component] of ROUTE_TABLE) {
  const full = join(appDir, routeFile);
  if (!existsSync(full)) {
    fail(`src/app/${routeFile}`, 'routes', 'route file from CONTRACT §4 is missing');
    continue;
  }
  const text = readFileSync(full, 'utf8');
  if (!text.includes(component)) {
    fail(`src/app/${routeFile}`, 'routes', `does not render ${component}`);
  }
  const codeLines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('*'));
  if (codeLines.length > 15) {
    fail(`src/app/${routeFile}`, 'routes', `route file is ${codeLines.length} lines; CONTRACT §4 allows ≤ 15`);
  }
  for (const spec of importsOf(text)) {
    if (/^@\/modules\/[a-z-]+\/(?!index)/.test(spec)) {
      fail(`src/app/${routeFile}`, 'routes', `imports module internals: ${spec}`);
    }
  }
}

// -------------------------------------------------------------------- report
const byRule = new Map();
for (const f of failures) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}

console.log(`contract-check: ${files.length} TypeScript files under src/`);
for (const [rule, list] of byRule) {
  console.log(`\n✖ ${rule} (${list.length})`);
  for (const f of list) {
    console.log(`  ${f.file}\n      ${f.message}`);
  }
}

if (failures.length > 0) {
  console.log(`\nFAILED — ${failures.length} violation(s) across ${byRule.size} rule(s).`);
  process.exit(1);
}

console.log('\nOK — layering, hygiene, SQL, safety and routes all conform.');