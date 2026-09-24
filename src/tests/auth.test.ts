import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import { hashSessionToken } from '@/lib/session';
import { cookieStore } from './mocks/next-headers';
import { req, createTestUser, createUserWithSession, authenticate, clearAuth } from './helpers';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as logoutHandler } from '@/app/api/auth/logout/route';
import { GET as meHandler } from '@/app/api/me/route';

describe('POST /api/auth/register', () => {
  it('creates the user, seeds 9 default categories, hashes the password, opens a session', async () => {
    const res = await registerHandler(
      req('POST', '/api/auth/register', {
        name: 'Alice',
        email: 'alice@EXAMPLE.com',
        password: 'password123',
      }),
    );
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.user).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
    expect(body.user.password).toBeUndefined();

    const dbUser = await prisma.user.findUnique({ where: { email: 'alice@example.com' } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.password).not.toBe('password123');
    expect(await prisma.category.count({ where: { userId: dbUser!.id } })).toBe(9);

    const token = cookieStore.get('session_token');
    expect(token).toBeTruthy();
    // Stored hashed, not in plaintext
    expect(await prisma.session.findUnique({ where: { sessionToken: token! } })).toBeNull();
    expect(
      await prisma.session.findUnique({ where: { sessionToken: hashSessionToken(token!) } }),
    ).not.toBeNull();
  });

  it('rejects duplicate emails case-insensitively (409)', async () => {
    await createTestUser({ email: 'bob@test.dev' });
    const res = await registerHandler(
      req('POST', '/api/auth/register', {
        name: 'Bob',
        email: 'BOB@test.dev',
        password: 'password123',
      }),
    );
    expect(res.status).toBe(409);
  });

  it('returns 400 with details for invalid input', async () => {
    const res = await registerHandler(
      req('POST', '/api/auth/register', { name: 'A', email: 'nope', password: '123' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
    expect(Array.isArray(body.details)).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with a case-insensitive email and sets the session cookie', async () => {
    const { user, password } = await createTestUser({ email: 'carol@test.dev' });
    const res = await loginHandler(
      req('POST', '/api/auth/login', { email: 'CAROL@test.dev', password }),
    );
    expect(res.status).toBe(200);
    expect(cookieStore.get('session_token')).toBeTruthy();
    expect((await res.json()).user.id).toBe(user.id);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it('returns 401 for a wrong password', async () => {
    await createTestUser({ email: 'dave@test.dev' });
    const res = await loginHandler(
      req('POST', '/api/auth/login', { email: 'dave@test.dev', password: 'wrong-password' }),
    );
    expect(res.status).toBe(401);
    expect(cookieStore.get('session_token')).toBeUndefined();
  });

  it('returns 401 for an unknown email', async () => {
    const res = await loginHandler(
      req('POST', '/api/auth/login', { email: 'ghost@test.dev', password: 'password123' }),
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the session row and clears the cookie', async () => {
    const { user, token } = await createUserWithSession();
    authenticate(token);
    const res = await logoutHandler(req('POST', '/api/auth/logout'));
    expect(res.status).toBe(200);
    expect(cookieStore.get('session_token')).toBeUndefined();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('GET /api/me', () => {
  it('returns the current user when authenticated', async () => {
    const { user, token } = await createUserWithSession();
    authenticate(token);
    const res = await meHandler(req('GET', '/api/me'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toMatchObject({ id: user.id, email: user.email });
    expect(body.user.password).toBeUndefined();
  });

  it('returns 401 without a session cookie', async () => {
    clearAuth();
    expect((await meHandler(req('GET', '/api/me'))).status).toBe(401);
  });
});
