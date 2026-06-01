export function toKSH(amount: number, decimals = 2): string {
  const numeric = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `KSh ${numeric.toLocaleString("en-KE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

export function usdToKSH(usd: number, rate: number, decimals = 2): string {
  const numericUsd = Number.isFinite(Number(usd)) ? Number(usd) : 0;
  const numericRate = Number.isFinite(Number(rate)) ? Number(rate) : 0;
  return toKSH(numericUsd * numericRate, decimals);
}
