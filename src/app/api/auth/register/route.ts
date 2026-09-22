import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerSchema } from '@/lib/validations';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// Default categories applied to new accounts
const DEFAULT_CATEGORIES = [
  'groceries',
  'utilities',
  'rent',
  'education',
  'daily essentials',
  'food',
  'travel',
  'entertainment',
  'healthcare',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = registerSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: result.error.issues,
        },
        { status: 400 },
      );
    }

    const { name, email, password } = result.data;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'User with this email already exists',
        },
        { status: 409 },
      );
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Transaction: Create user and default categories simultaneously
    const user = await prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      // Prepare default category records
      const categoryData = DEFAULT_CATEGORIES.map((catName) => ({
        name: catName,
        userId: newUser.id,
      }));

      // Insert default categories
      await tx.category.createMany({
        data: categoryData,
      });

      return newUser;
    });

    // Create session
    const sessionToken = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Store session in db
    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expiresAt,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    // Store user info in a separate cookie for client access
    cookieStore.set(
      'user_data',
      JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
      }),
      {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: expiresAt,
        path: '/',
      },
    );

    return NextResponse.json(
      {
        success: true,
        user,
        message: 'User registered successfully',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
