import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import type { DashboardData } from '@/types/api';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  month: (month: string) => ['dashboard', month] as const,
};

export function useDashboard(month: string) {
  return useQuery({
    queryKey: dashboardKeys.month(month),
    queryFn: () => api<DashboardData>(`/api/dashboard?month=${month}`),
    // keepPreviousData: switching months shows last month's numbers dimmed
    // while the new ones load — no skeleton flash between months
    placeholderData: keepPreviousData,
  });
}
