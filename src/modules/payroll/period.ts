export type PeriodType = "week" | "fortnight";
export function weekEnvelope(from: string, to: string): { from: string; to: string } {
  return { from: periodBounds("week", from).from, to: periodBounds("week", to).to };
}
export function periodBounds(type: PeriodType, anchor: string): { from: string; to: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) throw new Error("Fecha inválida");
  const date = new Date(`${anchor}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== anchor) throw new Error("Fecha inválida");
  if (type === "week") {
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
  }
  if (type !== "fortnight") throw new Error("Tipo de período inválido");
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return date.getUTCDate() <= 15
    ? { from: `${year}-${month}-01`, to: `${year}-${month}-15` }
    : { from: `${year}-${month}-16`, to: new Date(Date.UTC(year, date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) };
}
