export function formatNaira(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseInt(amount, 10) : (amount ?? 0);
  const safe = isNaN(n) ? 0 : n;
  return "₦" + safe.toLocaleString("en-NG");
}

export function parseNairaInput(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[₦,\s]/g, "");
  const lower = cleaned.toLowerCase();
  let mult = 1;
  let numStr = cleaned;
  if (lower.endsWith("k")) {
    mult = 1000;
    numStr = cleaned.slice(0, -1);
  } else if (lower.endsWith("m")) {
    mult = 1000000;
    numStr = cleaned.slice(0, -1);
  }
  const n = parseFloat(numStr);
  if (isNaN(n)) return 0;
  return Math.round(n * mult);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generateReference(prefix: string): string {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${rand}`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
