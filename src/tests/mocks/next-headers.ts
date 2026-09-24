// Stand-in for next/headers, aliased in vitest.config.ts.
// Exposes a shared cookie jar so tests can simulate authenticated requests.

export const cookieStore = new Map<string, string>();

type SetArgs = [string, string] | [{ name: string; value: string }];

export async function cookies() {
  return {
    get(name: string) {
      const value = cookieStore.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll() {
      return [...cookieStore.entries()].map(([name, value]) => ({ name, value }));
    },
    set(...args: SetArgs) {
      const [name, value] =
        typeof args[0] === 'string' ? [args[0], args[1]] : [args[0].name, args[0].value];
      cookieStore.set(name, value);
      return { name, value };
    },
    delete(name: string) {
      cookieStore.delete(name);
    },
  };
}

export async function headers() {
  return { get: () => undefined };
}
