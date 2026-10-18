const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'android/**', 'ios/**', 'dist/**', 'coverage/**', '.expo/**'],
  },
  {
    rules: {
      'no-console': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      // SHARED_CONTRACT.md §3 type declarations are copied verbatim and use `Array<T>`.
      '@typescript-eslint/array-type': 'off',
    },
  },
  {
    files: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
    rules: {
      // jest.mock() is hoisted, so imports that must be mocked are declared after it on purpose.
      'import/first': 'off',
    },
  },
  {
    // Build/verification scripts are run in a terminal and their only output channel IS stdout.
    // The no-console rule exists to keep app code logging through `logger`, not to silence CLIs.
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
];