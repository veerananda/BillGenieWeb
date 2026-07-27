export type ExpenseMonthOption = {
  year: number;
  month: number;
  key: string;
  label: string;
};

/** Calendar months from start (inclusive) through the current month, newest first. */
export function buildExpenseMonthOptions(start?: Date | string | null): ExpenseMonthOption[] {
  const now = new Date();
  const endY = now.getFullYear();
  const endM = now.getMonth();

  let startDate = start ? new Date(start) : new Date(endY, endM - 35, 1);
  if (Number.isNaN(startDate.getTime())) {
    startDate = new Date(endY, endM - 35, 1);
  }

  let y = startDate.getFullYear();
  let m = startDate.getMonth();
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
