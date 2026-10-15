export const toPercent = (value: number): number => {
  const ratio = Number.isFinite(value) ? value : 0
  return Math.round(Math.min(Math.max(ratio, 0), 1) * 100)
}
