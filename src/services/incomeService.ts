import { prisma } from '@/lib/prisma';

// Evaluate and post pending recurring income entries for a specific month
export async function processRecurringIncome(userId: string, year: number, month: number) {
  const periodString = `${year}-${String(month).padStart(2, '0')}`;

  // Determine the last day of the target month to handle dayOfMonth boundaries
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const currentDay = new Date().getUTCDate();
  const currentMonth = new Date().getUTCMonth() + 1;
  const currentYear = new Date().getUTCFullYear();

  // Fetch all active income templates for the user
  const activeIncomes = await prisma.income.findMany({
    where: { userId, active: true },
  });

  for (const income of activeIncomes) {
    // Cap the target day to the last day of the month if it exceeds it
    const targetDay = Math.min(income.dayOfMonth, lastDayOfMonth);

    // Check if the target date has passed in the current context
    let shouldPost = false;
    if (year < currentYear) {
      shouldPost = true;
    } else if (year === currentYear && month < currentMonth) {
      shouldPost = true;
    } else if (year === currentYear && month === currentMonth && currentDay >= targetDay) {
      shouldPost = true;
    }

    if (shouldPost) {
      // Check if an entry already exists for this period to avoid duplicates
      const existingEntry = await prisma.incomeEntry.findUnique({
        where: { incomeId_period: { incomeId: income.id, period: periodString } },
      });

      if (!existingEntry) {
        // Create the income entry for the period
        await prisma.incomeEntry.create({
          data: {
            amount: income.amount,
            date: new Date(year, month - 1, targetDay),
            period: periodString,
            incomeId: income.id,
            userId,
          },
        });
      }
    }
  }
}
