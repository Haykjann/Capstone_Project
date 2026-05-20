// Fix #12: single source of truth for date formatting shared across admin and employee views

export function toDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(dateStr: string): string {
  const dt = new Date(`${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(dt);
}

export function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function startOfQuarter(now = new Date()): Date {
  const month = now.getMonth();
  const quarterStart = month - (month % 3);
  return new Date(now.getFullYear(), quarterStart, 1);
}
