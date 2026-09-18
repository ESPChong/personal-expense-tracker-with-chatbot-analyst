import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (sessionToken) {
      await prisma.session.deleteMany({
        where: { sessionToken },
      });

      cookieStore.delete('session_token');
      cookieStore.delete('user_data');
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
