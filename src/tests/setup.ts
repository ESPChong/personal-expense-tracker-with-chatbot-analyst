import { beforeEach } from 'vitest';
import { prisma } from '@/lib/prisma';
import { cookieStore } from './mocks/next-headers';

beforeEach(async () => {
  // Clean slate between every test
  await prisma.incomeEntry.deleteMany();
  await prisma.income.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.category.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  cookieStore.clear();
});
