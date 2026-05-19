export const toKSH = (amount, decimals = 2) => {
  const numeric = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `KSh ${numeric.toLocaleString("en-KE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
};

export const usdToKSH = (usd, rate) => toKSH(Number(usd) * Number(rate));
