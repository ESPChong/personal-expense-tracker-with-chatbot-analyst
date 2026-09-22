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
    const { name, amount, date, categoryId } = body;

    // Basic validation
    if (!name || !amount || !date) {
      return NextResponse.json({ error: 'Name, amount, and date are required' }, { status: 400 });
    }

    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'Amount must be an integer (cents)' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        name,
        amount,
        date: new Date(date),
        categoryId: categoryId || null,
        userId: user.id,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Create Expense Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
