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

// `Screen` wraps every screen in SafeAreaView, which needs native insets a test host cannot
// provide. A plain View with a zero-inset context renders the same tree without the native module.
jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- factory scope forbids outer refs.
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 320, height: 640 };
  return {
    SafeAreaProvider: ({ children }: { children: unknown }) => children,
    SafeAreaConsumer: ({ children }: { children: (i: typeof insets) => unknown }) => children(insets),
    SafeAreaView: View,
    SafeAreaInsetsContext: { Consumer: ({ children }: { children: (i: typeof insets) => unknown }) => children(insets) },
    SafeAreaFrameContext: { Consumer: ({ children }: { children: (f: typeof frame) => unknown }) => children(frame) },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

// expo-router needs a navigation container that a unit test cannot provide. `useLocalSearchParams`
// is a jest.fn so a test can hand a route the params it is checking. Route files themselves are
// covered by src/shell/__tests__/routes.test.ts as static text, not by rendering.
jest.mock('expo-router', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    canGoBack: jest.fn(() => true),
    setParams: jest.fn(),
  };
  return {
    router,
    useRouter: () => router,
    useLocalSearchParams: jest.fn(() => ({})),
    useGlobalSearchParams: jest.fn(() => ({})),
    usePathname: jest.fn(() => '/'),
    useSegments: jest.fn(() => []),
    useFocusEffect: jest.fn(),
    useNavigation: () => router,
    Redirect: () => null,
    Link: () => null,
    Stack: () => null,
    Tabs: () => null,
  };
});

