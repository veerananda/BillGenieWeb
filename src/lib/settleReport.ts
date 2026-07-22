import type { ExpenseSettleReport } from '../services/api';

function formatCurrency(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Plain-text settle report for share / clipboard. */
export function buildSettleReportText(report: ExpenseSettleReport): string {
  const lines: string[] = [
    'BILLGENIE — MONTHLY SETTLEMENT REPORT',
    report.restaurant_name || 'Restaurant',
    `Period: ${report.period_label}`,
    '',
    '── SUMMARY ──',
    `Total expenses: ${formatCurrency(report.total_expenses)}`,
    `  Manual expenses: ${formatCurrency(report.manual_expenses)}`,
    `  Stock refill: ${formatCurrency(report.stock_expenses)}`,
    `Orders taken: ${report.total_orders}`,
    `Revenue generated: ${formatCurrency(report.total_revenue)}`,
    `Average order value: ${formatCurrency(report.average_order_value)}`,
    `Net (revenue − expenses): ${formatCurrency(report.net)}`,
    '',
    '── TOP SELLING ITEMS ──',
  ];

  if (!report.top_items?.length) {
    lines.push('No sales in this period.');
  } else {
    report.top_items.forEach((item, i) => {
      lines.push(
        `${i + 1}. ${item.name} — qty ${item.quantity} · ${formatCurrency(item.revenue)}`
      );
    });
  }

  if (report.expense_lines?.length) {
    lines.push('', '── EXPENSE BREAKDOWN ──');
    for (const line of report.expense_lines) {
      lines.push(`• ${line.name}: ${formatCurrency(line.amount)}`);
    }
  }

  lines.push('', `Generated: ${new Date(report.generated_at || Date.now()).toLocaleString('en-IN')}`);
  return lines.join('\n');
}

/** HTML settle report for print / PDF download. */
export function buildSettleReportHtml(report: ExpenseSettleReport): string {
  const topRows =
    report.top_items?.length > 0
      ? report.top_items
          .map(
            (item, i) =>
              `<tr><td>${i + 1}</td><td>${escapeHtml(item.name)}</td><td>${item.quantity}</td><td>${formatCurrency(item.revenue)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="4">No sales in this period.</td></tr>';

  const expenseRows =
    report.expense_lines?.length > 0
      ? report.expense_lines
          .map(
            (line) =>
              `<tr><td>${escapeHtml(line.name)}</td><td>${line.source === 'stock' ? 'Stock' : 'Manual'}</td><td>${formatCurrency(line.amount)}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="3">No expenses recorded.</td></tr>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Settlement — ${escapeHtml(report.period_label)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111; padding: 24px; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; margin: 24px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
    .sub { color: #666; font-size: 13px; margin-bottom: 20px; }
    .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
    .kpi .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
    .kpi .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #eee; }
    th { color: #6b7280; font-size: 11px; text-transform: uppercase; }
    .foot { margin-top: 28px; font-size: 11px; color: #9ca3af; }
  </style>
</head>
<body>
  <h1>Monthly Settlement Report</h1>
  <div class="sub">${escapeHtml(report.restaurant_name || 'Restaurant')} · ${escapeHtml(report.period_label)}</div>

  <div class="kpis">
    <div class="kpi"><div class="label">Total expenses</div><div class="value">${formatCurrency(report.total_expenses)}</div></div>
    <div class="kpi"><div class="label">Revenue</div><div class="value">${formatCurrency(report.total_revenue)}</div></div>
    <div class="kpi"><div class="label">Orders taken</div><div class="value">${report.total_orders}</div></div>
    <div class="kpi"><div class="label">Avg order value</div><div class="value">${formatCurrency(report.average_order_value)}</div></div>
    <div class="kpi"><div class="label">Stock spend</div><div class="value">${formatCurrency(report.stock_expenses)}</div></div>
    <div class="kpi"><div class="label">Net</div><div class="value">${formatCurrency(report.net)}</div></div>
  </div>

  <h2>Top selling items</h2>
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead>
    <tbody>${topRows}</tbody>
  </table>

  <h2>Expense breakdown</h2>
  <table>
    <thead><tr><th>Name</th><th>Type</th><th>Amount</th></tr></thead>
    <tbody>${expenseRows}</tbody>
  </table>

  <div class="foot">Generated ${escapeHtml(new Date(report.generated_at || Date.now()).toLocaleString('en-IN'))} · BillGenie</div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
