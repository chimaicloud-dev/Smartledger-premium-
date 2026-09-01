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

const BASE58 = "[1-9A-HJ-NP-Za-km-z]";

export function isValidWithdrawalAddress(method: string, address: string): boolean {
  switch (method) {
    case "btc":
      return /^(?:bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(address);
    case "eth":
    case "usdt_erc20":
    case "bnb":
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case "usdt_trc20":
    case "trx":
      return new RegExp(`^T${BASE58}{33}$`).test(address);
    case "sol":
      return new RegExp(`^${BASE58}{32,44}$`).test(address);
    case "xrp":
      return new RegExp(`^r${BASE58}{24,34}$`).test(address);
    case "ltc":
      return /^(?:ltc1[ac-hj-np-z02-9]{11,71}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,34})$/i.test(address);
    case "doge":
      return /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
    default:
      return false;
  }
}
