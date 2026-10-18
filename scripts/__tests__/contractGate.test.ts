/**
 * INTEGRATION CONTRACT: GAT-052 / GAT-053
 * Purpose: proves the Stage 8 gate is wired and self-consistent — the script exists, runs, exits
 *          0 on the real tree, and still reports the violations it is supposed to report. A gate
 *          that always says OK is worthless, so this exercises it against a deliberately broken
 *          copy of the repo.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function runCheck(cwd) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [join(cwd, 'scripts', 'check-contract.mjs')],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { code: 0, output: stdout };
  } catch (error) {
    return {
      code: error.status ?? 1,
      output: `${error.stdout ?? ''}${error.stderr ?? ''}`,
    };
  }
}

describe('contract-check gate', () => {
  it('passes on the real tree', () => {
    const result = runCheck(ROOT);
    expect(result.code).toBe(0);
    expect(result.output).toContain('OK');
  });

  it('fails on a shared → module import (§2.7)', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'contract-'));
    try {
      cpSync(join(ROOT, 'src'), join(sandbox, 'src'), { recursive: true });
      cpSync(join(ROOT, 'scripts'), join(sandbox, 'scripts'), { recursive: true });

      const sharedFile = join(sandbox, 'src', 'shared', 'utils', '__probe.ts');
      writeFileSync(
        sharedFile,
        "import { getActiveJourney } from '@/modules/photos';\nexport const probe = getActiveJourney;\n",
      );

      const result = runCheck(sandbox);
      expect(result.code).toBe(1);
      expect(result.output).toContain('layering');
      expect(result.output).toContain('must not import');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('fails on a disallowed module edge (§2.8)', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'contract-'));
    try {
      cpSync(join(ROOT, 'src'), join(sandbox, 'src'), { recursive: true });
      cpSync(join(ROOT, 'scripts'), join(sandbox, 'scripts'), { recursive: true });

      // body → food is not one of the allowed edges.
      const bodyFile = join(sandbox, 'src', 'modules', 'body', '__probe.ts');
      writeFileSync(
        bodyFile,
        "import { FoodLogScreen } from '@/modules/food';\nexport const probe = FoodLogScreen;\n",
      );

      const result = runCheck(sandbox);
      expect(result.code).toBe(1);
      expect(result.output).toContain('not an allowed edge');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('fails on a missing CONTRACT §4 route file', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'contract-'));
    try {
      cpSync(join(ROOT, 'src'), join(sandbox, 'src'), { recursive: true });
      cpSync(join(ROOT, 'scripts'), join(sandbox, 'scripts'), { recursive: true });

      rmSync(join(sandbox, 'src', 'app', 'backup.tsx'), { force: true });

      const result = runCheck(sandbox);
      expect(result.code).toBe(1);
      expect(result.output).toContain('routes');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('fails on forbidden net-calorie wording (GAT-030)', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'contract-'));
    try {
      cpSync(join(ROOT, 'src'), join(sandbox, 'src'), { recursive: true });
      cpSync(join(ROOT, 'scripts'), join(sandbox, 'scripts'), { recursive: true });

      const file = join(sandbox, 'src', 'shared', 'constants', '__probe.ts');
      writeFileSync(file, "export const label = 'your net calories today';\n");

      const result = runCheck(sandbox);
      expect(result.code).toBe(1);
      expect(result.output).toContain('forbidden wording');
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });
});