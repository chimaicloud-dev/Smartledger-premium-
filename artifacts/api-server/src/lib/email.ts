import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

// SMTP account for the support mailbox (no Gmail involved)
const SMTP_USER = process.env.SMTP_USER || "support@smartledger-premium.com";
const FROM_ADDRESS = process.env.EMAIL_FROM || SMTP_USER;
const FROM_NAME = "SmartLedger Premium";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !pass) return null;
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass },
    });
  }
  return transporter;
}

// ---------- shared template ----------

const GOLD = "#E8A93C";
const BG = "#0E0F12";
const CARD = "#17181D";
const ROW_BORDER = "#26272e";
const MUTED = "#8b8e98";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type EmailRow = { label: string; value: string };

/**
 * Renders the SmartLedger Premium dark email shell.
 * The logo is pure text wrapped in translate="no" / notranslate so Gmail
 * and browsers never auto-translate the brand name.
 */
export function renderEmail(opts: {
  title: string;
  intro?: string;
  rows?: EmailRow[];
  outro?: string;
}): string {
  const { title, intro, rows, outro } = opts;

  const rowsHtml = rows && rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${ROW_BORDER};border-radius:14px;border-collapse:separate;overflow:hidden;">
        ${rows
          .map(
            (r, i) => `
          <tr>
            <td class="sl-row-label" style="padding:14px 16px;color:${MUTED};font-size:13px;width:36%;vertical-align:top;${i > 0 ? `border-top:1px solid ${ROW_BORDER};` : ""}">${esc(r.label)}</td>
            <td class="sl-row-value" style="padding:14px 16px;color:#ffffff;font-size:13px;font-weight:700;word-break:break-word;overflow-wrap:anywhere;${i > 0 ? `border-top:1px solid ${ROW_BORDER};` : ""}">${esc(r.value)}</td>
          </tr>`
          )
          .join("")}
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" translate="no">
<head>
<meta charset="utf-8">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  @media only screen and (max-width: 620px) {
    .sl-card { width: 100% !important; border-radius: 14px !important; }
    .sl-card-pad { padding-left: 16px !important; padding-right: 16px !important; }
    .sl-title { font-size: 20px !important; }
    .sl-logo { font-size: 22px !important; }
    /* Stack label above value so long values never force sideways scrolling */
    .sl-row-label { display: block !important; width: 100% !important; box-sizing: border-box !important; padding: 12px 14px 2px 14px !important; }
    .sl-row-value { display: block !important; width: 100% !important; box-sizing: border-box !important; padding: 0 14px 12px 14px !important; border-top: none !important; font-size: 14px !important; }
  }
</style>
<title>${esc(title)}</title>
</head>
<body bgcolor="${BG}" style="margin:0;padding:0;background-color:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BG}" style="background-color:${BG};padding:24px 0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="sl-card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${CARD}" style="max-width:600px;width:100%;background-color:${CARD};border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <!-- Header -->
          <tr>
            <td class="sl-card-pad" style="padding:32px 36px 24px 36px;border-bottom:1px solid ${ROW_BORDER};">
              <span class="notranslate sl-logo" translate="no" style="display:block;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">SmartLedger</span>
              <span class="notranslate" translate="no" style="display:block;color:${GOLD};font-size:12px;font-weight:700;letter-spacing:5px;margin-top:2px;">PREMIUM</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="sl-card-pad" style="padding:32px 36px 8px 36px;">
              <h1 class="sl-title" style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">${esc(title)}</h1>
              <div style="width:64px;height:4px;background-color:${GOLD};border-radius:2px;margin:14px 0 24px 0;"></div>
              ${intro ? `<p style="margin:0 0 24px 0;color:#c9ccd4;font-size:15px;line-height:1.6;">${intro}</p>` : ""}
              ${rowsHtml}
              ${outro ? `<p style="margin:24px 0 0 0;color:#c9ccd4;font-size:15px;line-height:1.6;">${outro}</p>` : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="sl-card-pad" style="padding:28px 36px 32px 36px;">
              <p style="margin:0;color:${MUTED};font-size:13px;text-align:center;line-height:1.7;">
                This is an automated notification from <span class="notranslate" translate="no">SmartLedger Premium</span>.<br>
                &copy; ${new Date().getFullYear()} <span class="notranslate" translate="no">Smartledger-premium</span> &middot; London, United Kingdom
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------- send helper (fire-and-forget safe) ----------

// Strict single-address check: rejects lists ("a@x.com, b@y.com"), spaces, and
// display-name tricks so a user-supplied value can never fan out to other recipients.
const SINGLE_EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

const EMAIL_MAX_ATTEMPTS = 2; // 1 initial attempt + 1 retry
const EMAIL_RETRY_DELAY_MS = 3_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts to send an email up to EMAIL_MAX_ATTEMPTS times.
 * Throws on final failure so the caller can surface the error.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const recipient = to.trim();
  if (!SINGLE_EMAIL_RE.test(recipient)) {
    console.warn("[email] invalid recipient address; skipping email:", subject);
    return;
  }
  const t = getTransporter();
  if (!t) {
    console.warn("[email] SMTP_HOST / SMTP_PASSWORD not set; skipping email:", subject);
    return;
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= EMAIL_MAX_ATTEMPTS; attempt++) {
    try {
      await t.sendMail({
        from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
        to: recipient,
        subject,
        html,
      });
      return; // success
    } catch (err) {
      lastErr = err;
      if (attempt < EMAIL_MAX_ATTEMPTS) {
        console.warn(
          `[email] attempt ${attempt}/${EMAIL_MAX_ATTEMPTS} failed for "${subject}"; retrying in ${EMAIL_RETRY_DELAY_MS}ms…`,
          err
        );
        await sleep(EMAIL_RETRY_DELAY_MS);
      }
    }
  }

  // All attempts exhausted — throw so dispatch() can log the alert.
  throw lastErr;
}

// On Vercel, the serverless invocation may be frozen as soon as the HTTP
// response is sent, killing in-flight SMTP sockets. waitUntil() keeps the
// invocation alive until the send promise settles. Outside Vercel it's a no-op.
function dispatch(sendPromise: Promise<void>, subject: string, to: string): void {
  const settled = sendPromise.catch((err) => {
    // All retries exhausted. Emit a prominent, monitorable alert so the admin
    // can notice the failure even when the email notification itself never arrived.
    const masked = to.replace(/^(.{2}).*(@.*)$/, "$1***$2");
    console.error(
      `[EMAIL_FAILURE_ALERT] Could not deliver email after ${EMAIL_MAX_ATTEMPTS} attempts.`,
      { subject, to: masked, error: String(err) }
    );
  });

  void (async () => {
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(settled);
    } catch {
      // not running on Vercel (or helper unavailable) — best-effort send
    }
  })();
}

// ---------- formatting helpers ----------

function fmtUsd(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date = new Date()): string {
  return d.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).replace(",", ",").replace(" at ", " at ");
}

// ---------- specific notifications ----------

export function sendWelcomeEmail(to: string, name: string): void {
  const html = renderEmail({
    title: "Welcome to SmartLedger Premium",
    intro: `Hi <strong>${esc(name)}</strong>, your account has been created successfully. You can now deposit funds, trade crypto and forex assets, and track your portfolio in real time.`,
    rows: [
      { label: "Account Email", value: to },
      { label: "Status", value: "Active" },
      { label: "Registered At", value: fmtDate() },
    ],
    outro: "If you did not create this account, please contact our support team immediately.",
  });
  dispatch(sendEmail(to, "Welcome to SmartLedger Premium", html), "Welcome to SmartLedger Premium", to);
}

/**
 * Masks a wallet address / account number for user-facing emails:
 * "bc1qjhcvevvflc8d3mwr7f4wulc884yjzpqsyrydcy" → "bc1qjh…ydcy".
 * Admin emails keep the full address.
 */
function maskAddress(addr: string): string {
  const a = addr.trim();
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function sendWithdrawalRequestedEmail(
  to: string,
  name: string,
  data: { amount: number; method: string; address?: string | null }
): void {
  const rows: EmailRow[] = [
    { label: "User", value: name },
    { label: "Amount", value: fmtUsd(data.amount) },
  ];
  if (data.address) rows.push({ label: "Wallet / Account", value: maskAddress(data.address) });
  rows.push(
    { label: "Method", value: data.method },
    { label: "Status", value: "Pending Review" },
    { label: "Submitted At", value: fmtDate() }
  );
  const html = renderEmail({
    title: "Withdrawal Requested",
    rows,
    outro: "Your withdrawal is being reviewed by our team. You will receive another email once it has been processed.",
  });
  const subject = `Withdrawal Requested — ${fmtUsd(data.amount)}`;
  dispatch(sendEmail(to, subject, html), subject, to);
}

export function sendWithdrawalCompletedEmail(
  to: string,
  name: string,
  data: { amount: number; method: string; address?: string | null }
): void {
  const rows: EmailRow[] = [
    { label: "User", value: name },
    { label: "Amount", value: fmtUsd(data.amount) },
  ];
  if (data.address) rows.push({ label: "Wallet / Account", value: maskAddress(data.address) });
  rows.push(
    { label: "Method", value: data.method },
    { label: "Status", value: "Completed" },
    { label: "Processed At", value: fmtDate() }
  );
  const html = renderEmail({
    title: "Withdrawal Completed",
    rows,
    outro: "Your funds have been sent. Depending on the network or bank, it may take some time to arrive.",
  });
  const subject = `Withdrawal Completed — ${fmtUsd(data.amount)}`;
  dispatch(sendEmail(to, subject, html), subject, to);
}

export function sendWithdrawalRejectedEmail(to: string, name: string, data: { amount: number; method: string }): void {
  const html = renderEmail({
    title: "Withdrawal Rejected",
    rows: [
      { label: "User", value: name },
      { label: "Amount", value: fmtUsd(data.amount) },
      { label: "Method", value: data.method },
      { label: "Status", value: "Rejected" },
      { label: "Reviewed At", value: fmtDate() },
    ],
    outro: "The withdrawn amount has been returned to your account balance. Please contact support if you believe this was a mistake.",
  });
  dispatch(sendEmail(to, "Withdrawal Rejected", html), "Withdrawal Rejected", to);
}

export function sendDepositReceivedEmail(
  to: string,
  name: string,
  data: { usdAmount: number; coin?: string | null; amount?: number | null; symbol?: string | null }
): void {
  const rows: EmailRow[] = [{ label: "User", value: name }];
  if (data.coin && data.amount && data.symbol) {
    rows.push({ label: "Asset", value: `${data.coin} (${data.symbol})` });
    rows.push({ label: "Amount", value: `${data.amount} ${data.symbol}` });
  }
  rows.push(
    { label: "USD Value", value: fmtUsd(data.usdAmount) },
    { label: "Status", value: "Pending Review" },
    { label: "Submitted At", value: fmtDate() }
  );
  const html = renderEmail({
    title: "Deposit Received",
    rows,
    outro: "Your deposit is awaiting confirmation by our team. Your balance will be credited once it has been approved.",
  });
  const subject = `Deposit Received — ${fmtUsd(data.usdAmount)}`;
  dispatch(sendEmail(to, subject, html), subject, to);
}

export function sendDepositApprovedEmail(
  to: string,
  name: string,
  data: { usdAmount: number; coin?: string | null; amount?: number | null; symbol?: string | null }
): void {
  const rows: EmailRow[] = [{ label: "User", value: name }];
  if (data.coin && data.amount && data.symbol) {
    rows.push({ label: "Asset", value: `${data.coin} (${data.symbol})` });
    rows.push({ label: "Amount", value: `${data.amount} ${data.symbol}` });
  }
  rows.push(
    { label: "USD Value", value: fmtUsd(data.usdAmount) },
    { label: "Status", value: "Approved & Credited" },
    { label: "Approved At", value: fmtDate() }
  );
  const html = renderEmail({
    title: "Deposit Approved",
    rows,
    outro: "Your deposit has been confirmed and your balance has been credited. Happy trading!",
  });
  const subject = `Deposit Approved — ${fmtUsd(data.usdAmount)}`;
  dispatch(sendEmail(to, subject, html), subject, to);
}

export function sendDepositRejectedEmail(to: string, name: string, data: { usdAmount: number }): void {
  const html = renderEmail({
    title: "Deposit Rejected",
    rows: [
      { label: "User", value: name },
      { label: "USD Value", value: fmtUsd(data.usdAmount) },
      { label: "Status", value: "Rejected" },
      { label: "Reviewed At", value: fmtDate() },
    ],
    outro: "Your deposit could not be confirmed. Please contact support for more information.",
  });
  dispatch(sendEmail(to, "Deposit Rejected", html), "Deposit Rejected", to);
}

export function sendPasswordResetEmail(to: string, resetUrl: string): void {
  const html = renderEmail({
    title: "Reset Your Password",
    intro: `We received a request to reset the password for your SmartLedger Premium account.<br><br>Click the button below to choose a new password. This link is valid for <strong>1 hour</strong> and can only be used once.`,
    rows: [
      { label: "Account Email", value: to },
      { label: "Requested At", value: fmtDate() },
      { label: "Link Expires", value: "1 hour from now" },
    ],
    outro: `<a href="${resetUrl}" style="display:inline-block;margin-top:8px;padding:14px 28px;background-color:${GOLD};color:#0E0F12;font-weight:700;font-size:15px;border-radius:10px;text-decoration:none;">Reset Password</a><br><br>If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.`,
  });
  dispatch(sendEmail(to, "Reset Your Password — SmartLedger Premium", html), "Reset Your Password — SmartLedger Premium", to);
}
// ---------- admin notifications ----------

// Admin notifications go to the support mailbox by default (override with ADMIN_NOTIFY_EMAIL).
const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || SMTP_USER;

export function notifyAdminDepositReceived(
  userName: string,
  data: { usdAmount: number; coin?: string | null; amount?: number | null; symbol?: string | null }
): void {
  const rows: EmailRow[] = [{ label: "User", value: userName }];
  if (data.coin && data.amount && data.symbol) {
    rows.push({ label: "Asset", value: `${data.coin} (${data.symbol})` });
    rows.push({ label: "Amount", value: `${data.amount} ${data.symbol}` });
  }
  rows.push(
    { label: "USD Value", value: fmtUsd(data.usdAmount) },
    { label: "Status", value: "Pending Review" },
    { label: "Submitted At", value: fmtDate() }
  );
  const html = renderEmail({
    title: "New Deposit Submitted",
    rows,
    outro: "A user has submitted a deposit. Please log in to the admin panel to review and approve or reject it.",
  });
  const subject = `[Admin] New Deposit — ${fmtUsd(data.usdAmount)} from ${userName}`;
  dispatch(sendEmail(ADMIN_EMAIL, subject, html), subject, ADMIN_EMAIL);
}

export function notifyAdminWithdrawalRequested(
  userName: string,
  data: { amount: number; method: string; address?: string | null }
): void {
  const rows: EmailRow[] = [{ label: "User", value: userName }];
  rows.push({ label: "Amount", value: fmtUsd(data.amount) });
  if (data.address) rows.push({ label: "Wallet / Account", value: data.address });
  rows.push(
    { label: "Method", value: data.method },
    { label: "Status", value: "Pending Review" },
    { label: "Submitted At", value: fmtDate() }
  );
  const html = renderEmail({
    title: "New Withdrawal Request",
    rows,
    outro: "A user has requested a withdrawal. Please log in to the admin panel to review and approve or reject it.",
  });
  const subject = `[Admin] New Withdrawal — ${fmtUsd(data.amount)} from ${userName}`;
  dispatch(sendEmail(ADMIN_EMAIL, subject, html), subject, ADMIN_EMAIL);
}

export function notifyAdminNewUser(userEmail: string, name: string): void {
  const html = renderEmail({
    title: "New User Registered",
    rows: [
      { label: "Name", value: name },
      { label: "Email", value: userEmail },
      { label: "Registered At", value: fmtDate() },
    ],
    outro: "A new user has created an account on SmartLedger Premium.",
  });
  dispatch(sendEmail(ADMIN_EMAIL, `[Admin] New User — ${name}`, html), `[Admin] New User — ${name}`, ADMIN_EMAIL);
}

export function notifyAdminKycSubmitted(userEmail: string, name: string): void {
  const html = renderEmail({
    title: "New KYC Submission",
    rows: [
      { label: "Name", value: name },
      { label: "Email", value: userEmail },
      { label: "Status", value: "Pending Review" },
      { label: "Submitted At", value: fmtDate() },
    ],
    outro: "A user has submitted KYC verification. Please log in to the admin panel to review and approve or reject it.",
  });
  dispatch(sendEmail(ADMIN_EMAIL, `[Admin] KYC Submission — ${name}`, html), `[Admin] KYC Submission — ${name}`, ADMIN_EMAIL);
}

export function sendKycStatusEmail(to: string, approved: boolean): void {
  const html = renderEmail({
    title: approved ? "Identity Verified" : "Verification Rejected",
    rows: [
      { label: "User", value: to },
      { label: "KYC Status", value: approved ? "Verified" : "Rejected" },
      { label: "Reviewed At", value: fmtDate() },
    ],
    outro: approved
      ? "Your identity has been verified. You now have full access to all SmartLedger Premium features."
      : "Your identity verification was not successful. Please re-submit your documents or contact support.",
  });
  const subject = approved ? "Identity Verified — SmartLedger Premium" : "Verification Rejected";
  dispatch(sendEmail(to, subject, html), subject, to);
}
