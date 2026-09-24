import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET /api/categories
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ data: categories });
  } catch (error) {
    console.error('List Categories Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/categories
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const category = await prisma.category.create({
      data: {
        name,
        userId: user.id,
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    // Handles Prisma unique constraint violation (duplicate category name per user)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 });
    }
    console.error('Create Category Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
