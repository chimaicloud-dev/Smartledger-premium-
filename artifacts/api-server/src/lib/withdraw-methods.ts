// Maps frontend withdrawal method ids to the coin symbol they debit.
export const METHOD_SYMBOLS: Record<string, string> = {
  btc: "BTC",
  eth: "ETH",
  usdt_trc20: "USDT",
  usdt_erc20: "USDT",
  bnb: "BNB",
  sol: "SOL",
  xrp: "XRP",
  ltc: "LTC",
  trx: "TRX",
  doge: "DOGE",
};

export function isCanonicalWithdrawalMethod(method: string): boolean {
  return Object.prototype.hasOwnProperty.call(METHOD_SYMBOLS, method);
}

export function methodToSymbol(method: string): string | null {
  const m = METHOD_SYMBOLS[method.toLowerCase()];
  if (m) return m;
  // Allow passing a raw symbol directly (e.g. "BTC")
  const sym = method.toUpperCase();
  if (Object.values(METHOD_SYMBOLS).includes(sym)) return sym;
  return null;
}
