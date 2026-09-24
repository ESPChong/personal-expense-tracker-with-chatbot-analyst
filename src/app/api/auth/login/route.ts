import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loginSchema } from '@/lib/validations';
import { generateSessionToken, hashSessionToken } from '@/lib/session';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

// Lazily computed hash used to equalize response times when the email is unknown,
// preventing user enumeration via timing.
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash() {
  dummyHashPromise ??= bcrypt.hash('timing-equalization-dummy', 12);
  return dummyHashPromise;
}

export async function POST(request: Request) {
  try {
    const result = loginSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: result.error.issues },
        { status: 400 },
      );
    }
    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, password: true },
    });

    // Always run a bcrypt comparison, even for unknown emails
    const passwordHash = user?.password ?? (await getDummyHash());
    const isPasswordValid = await bcrypt.compare(password, passwordHash);
    if (!user || !isPasswordValid) {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    // Housekeeping: purge this user's already-expired sessions
    await prisma.session.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: { sessionToken: hashSessionToken(sessionToken), userId: user.id, expiresAt },
    });

    const cookieStore = await cookies();
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email },
      message: 'Logged in successfully',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
