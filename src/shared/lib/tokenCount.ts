/** Decimal units stay consistent across languages, including quadrillions. */
export function formatTokenCount(value: number): string {
  const count = Math.max(0, Number.isFinite(value) ? value : 0);
  const units = ["", "K", "M", "B", "T", "Q"];
  let index = Math.min(5, Math.max(0, Math.floor(Math.log10(count || 1) / 3)));
  let scaled = count / 1000 ** index;
  if (index < 5 && Number(scaled.toFixed(2)) >= 1000) {
    index++;
    scaled = count / 1000 ** index;
  }
  return `${Number(scaled.toFixed(index ? 2 : 0))}${units[index]}`;
}
