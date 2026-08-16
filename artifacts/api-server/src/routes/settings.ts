import { Router, type IRouter } from "express";
import { db, siteSettingsTable } from "@workspace/db";

const router: IRouter = Router();

const PUBLIC_KEYS = new Set([
  "payment_btc_address", "payment_eth_address",
  "payment_usdt_trc20_address", "payment_usdt_erc20_address",
  "payment_bnb_address", "payment_sol_address", "payment_xrp_address",
  "payment_ltc_address", "payment_trx_address", "payment_doge_address",
  "payment_bank_name", "payment_bank_account_name",
  "payment_bank_account_number", "payment_bank_routing", "payment_bank_swift",
  "home_hero_title", "home_hero_subtitle", "home_badge_text",
  "home_feature1_title", "home_feature1_desc",
  "home_feature2_title", "home_feature2_desc",
]);

export const DEFAULT_SETTINGS: Record<string, string> = {
  payment_btc_address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  payment_eth_address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  payment_usdt_trc20_address: "TDsG7ND7s5e4oCKAE1kcHmzJEknxnUFAHY",
  payment_usdt_erc20_address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  payment_bnb_address: "bnb136ns6lfw4zs5hg4n85vdthaad7hq5m4gtkgf23",
  payment_sol_address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  payment_xrp_address: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
  payment_ltc_address: "LTdsVS8VDw6syvfQADdhf2PHAm3rMGJvPX",
  payment_trx_address: "TDsG7ND7s5e4oCKAE1kcHmzJEknxnUFAHY",
  payment_doge_address: "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L",
  payment_bank_name: "First National Bank",
  payment_bank_account_name: "Smartledger Premium LLC",
  payment_bank_account_number: "1234567890",
  payment_bank_routing: "021000021",
  payment_bank_swift: "FNBAUS33",
  home_hero_title: "Invest, trade, and hold crypto securely.",
  home_hero_subtitle: "Smartledger-premium provides a professional, high-liquidity environment for both beginners and institutional traders.",
  home_badge_text: "Trusted by 10M+ Users Worldwide",
  home_feature1_title: "Bank-grade Security",
  home_feature1_desc: "Your assets are protected by industry-leading protocols.",
  home_feature2_title: "Deep Liquidity",
  home_feature2_desc: "Execute large trades instantly with minimal slippage.",
};

router.get("/public", async (_req, res) => {
  const rows = await db.select().from(siteSettingsTable);
  const result: Record<string, string> = { ...DEFAULT_SETTINGS };
  rows.filter((r) => PUBLIC_KEYS.has(r.key)).forEach((r) => {
    result[r.key] = r.value;
  });
  res.json(result);
});

export default router;
