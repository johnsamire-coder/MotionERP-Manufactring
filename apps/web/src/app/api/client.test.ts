import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUTH_REQUIRED_EVENT, installAuthFetch, setAccessToken } from './client';

function fakeWindow(status = 200) {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const target = new EventTarget() as EventTarget & {
    fetch: typeof fetch;
    location: { href: string };
  };
  target.location = { href: 'http://localhost:5173/' };
  target.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) });
    return new Response('{}', { status });
  }) as typeof fetch;
  installAuthFetch(target as unknown as typeof window);
  return { target, calls };
}

afterEach(() => setAccessToken(null));

describe('installAuthFetch (plan item 5.3)', () => {
  it('adds the login token to API requests only', async () => {
    setAccessToken('tok-1');
    const { target, calls } = fakeWindow();
    await target.fetch('http://localhost:3000/api/v1/audit/logs');
    await target.fetch('https://example.com/other');
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer tok-1');
    expect(calls[1]!.headers.get('Authorization')).toBeNull();
  });

  it('keeps an explicit Authorization header', async () => {
    setAccessToken('tok-1');
    const { target, calls } = fakeWindow();
    await target.fetch('http://localhost:3000/api/v1/x', {
      headers: { Authorization: 'Bearer other' },
    });
    expect(calls[0]!.headers.get('Authorization')).toBe('Bearer other');
  });

  it('asks for login on 401', async () => {
    setAccessToken('expired');
    const { target } = fakeWindow(401);
    const onAuth = vi.fn();
    target.addEventListener(AUTH_REQUIRED_EVENT, onAuth);
    await target.fetch('http://localhost:3000/api/v1/x');
    expect(onAuth).toHaveBeenCalledTimes(1);
  });
});
