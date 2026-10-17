/**
 * INTEGRATION CONTRACT: test bootstrap
 * Purpose: make `expo-crypto` deterministic under Jest by backing `randomUUID` with Node's crypto,
 * so `newId()` (API-CORE-005) works in every test, and keep secrets off disk during tests.
 */
jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- factory scope forbids outer refs.
  const nodeCrypto = require('node:crypto') as typeof import('node:crypto');
  const actual = jest.requireActual('expo-crypto');
  return {
    ...actual,
    randomUUID: () => nodeCrypto.randomUUID(),
    getRandomBytes: (size: number) => new Uint8Array(nodeCrypto.randomBytes(size)),
    getRandomValues: (array: Uint8Array) =>
      nodeCrypto.getRandomValues(array as unknown as Uint8Array<ArrayBuffer>),
  };
});

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    isAvailableAsync: jest.fn(async () => true),
  };
});