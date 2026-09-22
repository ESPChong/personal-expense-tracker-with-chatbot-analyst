import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, amount, dayOfMonth } = body;

    if (!amount || !dayOfMonth) {
      return NextResponse.json({ error: 'Amount and dayOfMonth are required' }, { status: 400 });
    }

    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'Amount must be an integer (cents)' }, { status: 400 });
    }

    if (typeof dayOfMonth !== 'number' || dayOfMonth < 1 || dayOfMonth > 31) {
      return NextResponse.json({ error: 'dayOfMonth must be between 1 and 31' }, { status: 400 });
    }

    const income = await prisma.income.create({
      data: {
        name: name || null,
        amount,
        dayOfMonth,
        active: true,
        userId: user.id,
      },
    });

    return NextResponse.json(income, { status: 201 });
  } catch (error) {
    console.error('Create Income Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
