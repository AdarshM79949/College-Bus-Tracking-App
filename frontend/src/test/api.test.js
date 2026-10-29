import { describe, test, expect, vi, beforeEach } from 'vitest';
import { apiFetch, setToken, getToken } from '../api';

beforeEach(() => {
  global.fetch = vi.fn();
  localStorage.clear();
});

describe('apiFetch', () => {
  test('setToken/getToken round trip', () => {
    setToken('abc');
    expect(getToken()).toBe('abc');
    setToken(null);
    expect(getToken()).toBeNull();
  });

  test('sends Authorization header when token present', async () => {
    setToken('tok');
    global.fetch.mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ ok: true }) });
    await apiFetch('/x');
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer tok');
  });

  test('throws on non-OK response with server message', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Invalid creds' }),
    });
    await expect(apiFetch('/x', { auth: false })).rejects.toThrow('Invalid creds');
  });
});
