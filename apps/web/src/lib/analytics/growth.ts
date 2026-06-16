export function computeGrowth(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function getPeriodWindows() {
  const now = new Date();
  const currentEnd = now;
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - 30);

  const previousEnd = new Date(currentStart);
  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - 30);

  return { currentStart, currentEnd, previousStart, previousEnd };
}

export function dateRangeFilter(start: Date, end: Date) {
  return { gte: start, lte: end };
}
