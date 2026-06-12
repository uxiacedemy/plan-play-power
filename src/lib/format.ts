export function formatXAF(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "0 FCFA";
  return new Intl.NumberFormat("fr-CM", { maximumFractionDigits: 0 }).format(Math.round(v)) + " FCFA";
}
