/*
 * Sales summary for the admin: money received between two dates (Lagos time).
 * "Received" = orders whose status is paid, counted by the day they were paid, using the ITEMS total
 * (the online payment fee a customer pays goes to Paystack, so it is not counted as your sale).
 */
const DAY = 24 * 3600e3;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_DAYS = 366;
export const lagosDay = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });

const startOf = (date) => new Date(`${date}T00:00:00+01:00`);

/** Validates ?from=YYYY-MM-DD&to=YYYY-MM-DD. Returns { ok, from, to, startIso, endIso, days } or { ok:false, message }. */
export function parseRange(from, to) {
  if (!DATE_RE.test(String(from)) || !DATE_RE.test(String(to))) return { ok: false, message: 'Choose a start and an end date.' };
  const s = startOf(from);
  const e = startOf(to);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return { ok: false, message: 'Choose valid dates.' };
  if (e < s) return { ok: false, message: 'The end date must not be before the start date.' };
  const days = Math.round((e - s) / DAY) + 1;
  if (days > MAX_DAYS) return { ok: false, message: 'Please choose a range of one year or less.' };
  return { ok: true, from, to, days, startIso: s.toISOString(), endIso: new Date(e.getTime() + DAY).toISOString() };
}

const emptyMethod = () => ({ orders: 0, revenue: 0 });

/** paidRows: paid orders in range. pendingRows: awaiting-payment orders created in range. */
export function summarize(range, paidRows, pendingRows = []) {
  const byDay = new Map();
  const start = startOf(range.from).getTime();
  for (let i = 0; i < range.days; i++) byDay.set(lagosDay(start + i * DAY + 12 * 3600e3), { orders: 0, revenue: 0 });

  const totals = { orders: 0, revenue: 0, discount: 0 };
  const byMethod = { cash: emptyMethod(), bank: emptyMethod(), paystack: emptyMethod() };
  for (const r of paidRows) {
    const total = Number(r.total) || 0;
    totals.orders += 1; totals.revenue += total; totals.discount += Number(r.discount) || 0;
    const m = byMethod[r.method] || (byMethod[r.method] = emptyMethod());
    m.orders += 1; m.revenue += total;
    const d = byDay.get(lagosDay(r.paid_at || r.created_at));
    if (d) { d.orders += 1; d.revenue += total; }
  }
  const pending = { orders: pendingRows.length, total: pendingRows.reduce((n, r) => n + (Number(r.total) || 0), 0) };
  return {
    from: range.from, to: range.to, days: range.days, totals, byMethod, pending,
    average: totals.orders ? Math.round(totals.revenue / totals.orders) : 0,
    daily: [...byDay].map(([date, v]) => ({ date, ...v })),
  };
}
