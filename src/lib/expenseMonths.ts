export type ExpenseMonthOption = {
  year: number;
  month: number;
  key: string;
  label: string;
};

/**
 * Calendar months from restaurant creation month (inclusive) through the current month,
 * newest first. Months older than creation are never included.
 * If creation date is missing/invalid, only the current month is returned.
 */
export function buildExpenseMonthOptions(start?: Date | string | null): ExpenseMonthOption[] {
  const now = new Date();
  const endY = now.getFullYear();
  const endM = now.getMonth();

  let startDate = start ? new Date(start) : now;
  if (Number.isNaN(startDate.getTime())) {
    startDate = now;
  }

  // Never start before creation month; also never start after current month.
  let y = startDate.getFullYear();
  let m = startDate.getMonth();
  if (y > endY || (y === endY && m > endM)) {
    y = endY;
    m = endM;
  }

  const options: ExpenseMonthOption[] = [];

  while (y < endY || (y === endY && m <= endM)) {
    options.push({
      year: y,
      month: m + 1,
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: new Date(y, m, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
    });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  return options.reverse();
}

export function currentExpenseMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
