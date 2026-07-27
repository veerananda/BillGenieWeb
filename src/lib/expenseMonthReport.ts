export type ExpenseMonthReport = {
  year: number;
  month: number;
  period_label: string;
  restaurant_name?: string;
  total_revenue: number;
  total_expenses: number;
  net: number;
  total_orders: number;
};

function formatMoney(amount: number): string {
  return `₹${Number(amount || 0).toFixed(2)}`;
}

export function buildExpenseMonthReportText(report: ExpenseMonthReport): string {
  const lines = [
    report.restaurant_name || 'BillGenie',
    `Monthly report — ${report.period_label}`,
    '--------------------------------',
    `Revenue: ${formatMoney(report.total_revenue)}`,
    `Expenses: ${formatMoney(report.total_expenses)}`,
    `Net profit: ${formatMoney(report.net)}`,
    `Total orders: ${report.total_orders}`,
    '--------------------------------',
    `Generated ${new Date().toLocaleString('en-IN')}`,
  ];
  return lines.join('\n');
}

export function buildExpenseMonthReportHtml(report: ExpenseMonthReport): string {
  const title = `Monthly report — ${report.period_label}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 24px; font-family: ui-sans-serif, system-ui, sans-serif; color: #111827; }
    .card { max-width: 420px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .sub { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .row:last-child { border-bottom: 0; }
    .label { color: #6b7280; }
    .value { font-weight: 700; }
    .net { color: ${report.net >= 0 ? '#059669' : '#dc2626'}; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${report.restaurant_name || 'BillGenie'}</h1>
    <p class="sub">${title}</p>
    <div class="row"><span class="label">Revenue</span><span class="value">${formatMoney(report.total_revenue)}</span></div>
    <div class="row"><span class="label">Expenses</span><span class="value">${formatMoney(report.total_expenses)}</span></div>
    <div class="row"><span class="label">Net profit</span><span class="value net">${formatMoney(report.net)}</span></div>
    <div class="row"><span class="label">Total orders</span><span class="value">${report.total_orders}</span></div>
  </div>
</body>
</html>`;
}
