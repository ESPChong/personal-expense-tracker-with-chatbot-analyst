import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  req,
  createUserWithSession,
  authenticate,
  clearAuth,
  seedCategory,
  seedExpense,
} from './helpers';
import { GET as getDashboard } from '@/app/api/dashboard/route';

function currentPeriod() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return {
    year,
    month,
    prevYear,
    prevMonth,
    current: `${year}-${String(month).padStart(2, '0')}`,
  };
}

describe('GET /api/dashboard', () => {
  it('aggregates summary, category breakdown and recent activity', async () => {
    const { user, token } = await createUserWithSession();
    authenticate(token);
    const { year, month, prevYear, prevMonth, current } = currentPeriod();

    const food = await seedCategory(user.id, 'food');
    const travel = await seedCategory(user.id, 'travel');
    await seedExpense(user.id, {
      name: 'A',
      amount: 5000,
      date: new Date(year, month - 1, 10),
      categoryId: food.id,
    });
    await seedExpense(user.id, {
      name: 'B',
      amount: 2500,
      date: new Date(year, month - 1, 12),
      categoryId: travel.id,
    });
    await seedExpense(user.id, {
      name: 'C',
      amount: 10000,
      date: new Date(prevYear, prevMonth - 1, 10),
    });
    await prisma.income.create({
      data: { name: 'Salary', amount: 100000, dayOfMonth: 1, userId: user.id },
    });

    const res = await getDashboard(req('GET', `/api/dashboard?month=${current}`));
    expect(res.status).toBe(200);
    const body = await res.json();

    // 100000 income - 17500 total expenses; month: 100000 income, 7500 expenses
    expect(body.summary).toEqual({
      totalSavings: 82500,
      monthIncome: 100000,
      monthExpenses: 7500,
      netThisMonth: 92500,
    });

    expect(body.spendingByCategory[0]).toMatchObject({ name: 'food', amount: 5000 });
    expect(body.spendingByCategory[0].percentage).toBeCloseTo(66.67, 1);

    // 3 expenses + 1 posted income entry
    expect(body.recentActivity).toHaveLength(4);
    for (let i = 1; i < body.recentActivity.length; i++) {
      expect(new Date(body.recentActivity[i - 1].date).getTime()).toBeGreaterThanOrEqual(
        new Date(body.recentActivity[i].date).getTime(),
      );
    }
  });

  it('is idempotent — recurring income is posted exactly once per period', async () => {
    const { user, token } = await createUserWithSession();
    authenticate(token);
    await prisma.income.create({ data: { amount: 50000, dayOfMonth: 1, userId: user.id } });
    const { current } = currentPeriod();

    await getDashboard(req('GET', `/api/dashboard?month=${current}`));
    await getDashboard(req('GET', `/api/dashboard?month=${current}`));

    expect(await prisma.incomeEntry.count({ where: { userId: user.id, period: current } })).toBe(1);
  });

  it('rejects unauthorized requests and invalid months', async () => {
    clearAuth();
    expect((await getDashboard(req('GET', '/api/dashboard'))).status).toBe(401);

    const { token } = await createUserWithSession();
    authenticate(token);
    expect((await getDashboard(req('GET', '/api/dashboard?month=2025-13'))).status).toBe(400);
    expect((await getDashboard(req('GET', '/api/dashboard?month=banana'))).status).toBe(400);
  });
});
