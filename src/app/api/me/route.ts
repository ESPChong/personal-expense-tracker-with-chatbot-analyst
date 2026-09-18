import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        },
        { status: 401 },
      );
    }

    // Find Session
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not authenticated',
        },
        { status: 401 },
      );
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      await prisma.session.delete({
        where: { id: session.id },
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Session expired',
        },
        { status: 401 },
      );
    }
    return NextResponse.json({
      success: true,
      user: session.user,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
