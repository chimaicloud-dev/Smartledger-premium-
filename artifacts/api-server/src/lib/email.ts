import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import brandLogoDataUrl from "../assets/email-logo.png";

// SMTP account for the support mailbox (no Gmail involved)
const SMTP_USER = process.env.SMTP_USER || "support@smartledger-premium.com";
const FROM_ADDRESS = process.env.EMAIL_FROM || SMTP_USER;
const FROM_NAME = "SmartLedger Premium";
const BRAND_NAME = "SmartLedger Premium";
const BRAND_GOLD = "#D8A83E";
const BRAND_TEAL = "#16A6B6";
const BRAND_LOGO_CID = "smartledger-premium-logo";
const BRAND_LOGO_CONTENT = Buffer.from(brandLogoDataUrl.split(",", 2)[1] ?? "", "base64");

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
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 6_000,
    });
  }
  return transporter;
}

// ---------- shared template ----------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s: string): string {
  return esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function plainTextToHtml(s: string): string {
  return esc(s).replace(/\r?\n/g, "<br>");
}

function subject(title: string): string {
  return `[${BRAND_NAME}] ${title}`;
}

export type EmailRow = { label: string; value: string };

/**
 * Compact, email-client-safe SmartLedger Premium shell inspired by the
 * proportions and hierarchy of leading exchange transaction emails.
 * The brand mark is an image, so translation tools cannot alter it.
 */
export function renderEmail(opts: {
  title: string;
  recipientName?: string;
  intro?: string;
  rows?: EmailRow[];
  outro?: string;
}): string {
  const { title, recipientName, intro, rows, outro } = opts;
  const rowsHtml = rows && rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;">
        ${rows
          .map(
            (r) => `
          <tr>
            <td class="sl-row-label" style="padding:4px 16px 4px 0;color:#595959;font-size:14px;line-height:1.45;width:38%;vertical-align:top;white-space:nowrap;">${esc(r.label)}</td>
            <td class="sl-row-value" style="padding:4px 0;color:#151515;font-size:14px;line-height:1.45;font-weight:600;word-break:break-word;overflow-wrap:anywhere;">${esc(r.value)}</td>
          </tr>`
          )
          .join("")}
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<![endif]-->
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  @media only screen and (max-width: 620px) {
    .sl-outer-pad { padding-left: 18px !important; padding-right: 18px !important; }
    .sl-card { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
    .sl-card-pad { padding-left: 14px !important; padding-right: 14px !important; }
    .sl-title { font-size: 25px !important; }
    .sl-row-label, .sl-row-value { font-size: 13px !important; }
  }
</style>
<title>${esc(title)}</title>
</head>
<body bgcolor="#ffffff" style="margin:0;padding:0;background-color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">
    <tr>
      <td class="sl-outer-pad" align="center" style="padding:24px 20px;">
        <table role="presentation" class="sl-card" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;width:100%;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <!-- Header -->
          <tr>
            <td class="sl-card-pad" style="padding:0 14px;">
              <div style="height:6px;background-color:${BRAND_TEAL};font-size:0;line-height:0;">&nbsp;</div>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:34px 0 44px 0;">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <img src="cid:${BRAND_LOGO_CID}" width="62" height="62" alt="SmartLedger Premium" class="notranslate" translate="no" style="display:block;width:62px;height:62px;border:0;border-radius:10px;object-fit:cover;">
                  </td>
                  <td class="notranslate" translate="no" style="vertical-align:middle;color:#0b0e11;font-size:22px;line-height:1.05;font-weight:800;letter-spacing:-0.4px;">
                    SmartLedger<br><span style="color:${BRAND_GOLD};font-size:11px;letter-spacing:3.4px;">PREMIUM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="sl-card-pad" style="padding:0 28px;">
              <h1 class="sl-title" style="margin:0 0 4px 0;color:#0b0e11;font-size:28px;line-height:1.2;font-weight:750;letter-spacing:-0.5px;">${esc(title)}</h1>
              ${recipientName ? `<p style="margin:0 0 20px 0;color:#202020;font-size:15px;line-height:1.5;">Hi <strong>${esc(recipientName)}</strong>,</p>` : ""}
              ${intro ? `<p style="margin:0 0 20px 0;color:#202020;font-size:15px;line-height:1.55;">${intro}</p>` : ""}
              ${rowsHtml}
              ${outro ? `<div style="margin:24px 0 0 0;color:#202020;font-size:14px;line-height:1.55;">${outro}</div>` : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td class="sl-card-pad" style="padding:42px 28px 18px 28px;">
              <div style="height:1px;background:#e8e8e8;font-size:0;line-height:0;margin-bottom:24px;">&nbsp;</div>
              <p style="margin:0 0 8px 0;color:#333333;font-size:13px;line-height:1.55;">
                Any question or need help?<br>
                Contact the <a href="mailto:${escAttr(FROM_ADDRESS)}" style="color:${BRAND_TEAL};text-decoration:none;">SmartLedger Premium support team</a>.
              </p>
              <p style="margin:0;color:#777777;font-size:12px;line-height:1.5;">
                This email was sent automatically. Please do not reply.<br>
                &copy; ${new Date().getFullYear()} <span class="notranslate" translate="no">SmartLedger Premium</span> &middot; London, United Kingdom
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
const EMAIL_RETRY_DELAY_MS = 1_000;

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
    throw new Error("Invalid recipient address");
  }
  const t = getTransporter();
  if (!t) {
    throw new Error("SMTP is not configured");
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= EMAIL_MAX_ATTEMPTS; attempt++) {
    try {
      await t.sendMail({
        from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
        to: recipient,
        subject,
        html,
        attachments: [
          {
            filename: "smartledger-premium-logo.png",
            content: BRAND_LOGO_CONTENT,
            cid: BRAND_LOGO_CID,
            contentType: "image/png",
          },
        ],
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

function fmtDate(d: Date = new Date(), timezone?: string | null): string {
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone || "UTC",
    timeZoneName: "short",
  });
}

// ---------- specific notifications ----------

export function sendWelcomeEmail(to: string, name: string, timezone?: string | null): void {
  const html = renderEmail({
    title: "Welcome to SmartLedger Premium",
    recipientName: name,
    intro: "Your account has been created successfully. You can now deposit funds, trade crypto and forex assets, and track your portfolio in real time.",
    rows: [
      { label: "Status", value: "Active" },
      { label: "Registered At", value: fmtDate(new Date(), timezone) },
    ],
    outro: "If you did not create this account, please contact our support team immediately.",
  });
  const emailSubject = subject("Welcome to SmartLedger Premium");
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
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
  data: { amount: number; method: string; address?: string | null; timezone?: string | null }
): void {
  const rows: EmailRow[] = [
    { label: "User", value: name },
    { label: "Amount", value: fmtUsd(data.amount) },
  ];
  if (data.address) rows.push({ label: "Wallet / Account", value: maskAddress(data.address) });
  rows.push(
    { label: "Method", value: data.method },
    { label: "Status", value: "Pending Review" },
    { label: "Submitted At", value: fmtDate(new Date(), data.timezone) }
  );
  const html = renderEmail({
    title: "Withdrawal Requested",
    recipientName: name,
    rows,
    outro: "Your withdrawal is being reviewed by our team. You will receive another email once it has been processed.",
  });
  const emailSubject = subject(`Withdrawal requested — ${fmtUsd(data.amount)}`);
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
}

export function sendWithdrawalCompletedEmail(
  to: string,
  name: string,
  data: { amount: number; method: string; address?: string | null; timezone?: string | null }
): void {
  const rows: EmailRow[] = [
    { label: "User", value: name },
    { label: "Amount", value: fmtUsd(data.amount) },
  ];
  if (data.address) rows.push({ label: "Wallet / Account", value: maskAddress(data.address) });
  rows.push(
    { label: "Method", value: data.method },
    { label: "Status", value: "Completed" },
    { label: "Processed At", value: fmtDate(new Date(), data.timezone) }
  );
  const html = renderEmail({
    title: "Withdrawal Successful",
    recipientName: name,
    rows,
    outro: "Your funds have been sent. Depending on the network or bank, it may take some time to arrive.",
  });
  const emailSubject = subject(`Withdrawal successful — ${fmtUsd(data.amount)}`);
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
}

export function sendWithdrawalRejectedEmail(to: string, name: string, data: { amount: number; method: string; timezone?: string | null }): void {
  const html = renderEmail({
    title: "Withdrawal Rejected",
    recipientName: name,
    rows: [
      { label: "User", value: name },
      { label: "Amount", value: fmtUsd(data.amount) },
      { label: "Method", value: data.method },
      { label: "Status", value: "Rejected" },
      { label: "Reviewed At", value: fmtDate(new Date(), data.timezone) },
    ],
    outro: "The withdrawn amount has been returned to your account balance. Please contact support if you believe this was a mistake.",
  });
  const emailSubject = subject("Withdrawal rejected");
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
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
    recipientName: name,
    rows,
    outro: "Your deposit is awaiting confirmation by our team. Your balance will be credited once it has been approved.",
  });
  const emailSubject = subject(`Deposit received — ${fmtUsd(data.usdAmount)}`);
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
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
    title: "Deposit Successful",
    recipientName: name,
    rows,
    outro: "Your deposit has been confirmed and your balance has been credited. Happy trading!",
  });
  const emailSubject = subject(`Deposit successful — ${fmtUsd(data.usdAmount)}`);
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
}

export function sendDepositRejectedEmail(to: string, name: string, data: { usdAmount: number }): void {
  const html = renderEmail({
    title: "Deposit Rejected",
    recipientName: name,
    rows: [
      { label: "User", value: name },
      { label: "USD Value", value: fmtUsd(data.usdAmount) },
      { label: "Status", value: "Rejected" },
      { label: "Reviewed At", value: fmtDate() },
    ],
    outro: "Your deposit could not be confirmed. Please contact support for more information.",
  });
  const emailSubject = subject("Deposit rejected");
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
}

export function sendPasswordResetEmail(to: string, name: string, resetUrl: string): void {
  const html = renderEmail({
    title: "Reset Your Password",
    recipientName: name,
    intro: `We received a request to reset the password for your SmartLedger Premium account.<br><br>Click the button below to choose a new password. This link is valid for <strong>1 hour</strong> and can only be used once.`,
    rows: [
      { label: "Requested At", value: fmtDate() },
      { label: "Link Expires", value: "1 hour from now" },
    ],
    outro: `<a href="${escAttr(resetUrl)}" style="display:inline-block;margin-top:8px;padding:13px 24px;background-color:#0b0e11;color:#ffffff;font-weight:700;font-size:14px;border-radius:4px;text-decoration:none;">Reset Password</a><br><br>If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.`,
  });
  const emailSubject = subject("Reset your password");
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
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
  const emailSubject = `[${BRAND_NAME} Admin] New deposit — ${fmtUsd(data.usdAmount)} from ${userName}`;
  dispatch(sendEmail(ADMIN_EMAIL, emailSubject, html), emailSubject, ADMIN_EMAIL);
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
  const emailSubject = `[${BRAND_NAME} Admin] New withdrawal — ${fmtUsd(data.amount)} from ${userName}`;
  dispatch(sendEmail(ADMIN_EMAIL, emailSubject, html), emailSubject, ADMIN_EMAIL);
}

export function notifyAdminNewUser(name: string): void {
  const html = renderEmail({
    title: "New User Registered",
    rows: [
      { label: "Name", value: name },
      { label: "Registered At", value: fmtDate() },
    ],
    outro: "A new user has created an account on SmartLedger Premium.",
  });
  const emailSubject = `[${BRAND_NAME} Admin] New user — ${name}`;
  dispatch(sendEmail(ADMIN_EMAIL, emailSubject, html), emailSubject, ADMIN_EMAIL);
}

export function notifyAdminKycSubmitted(name: string): void {
  const html = renderEmail({
    title: "New KYC Submission",
    rows: [
      { label: "Name", value: name },
      { label: "Status", value: "Pending Review" },
      { label: "Submitted At", value: fmtDate() },
    ],
    outro: "A user has submitted KYC verification. Please log in to the admin panel to review and approve or reject it.",
  });
  const emailSubject = `[${BRAND_NAME} Admin] KYC submission — ${name}`;
  dispatch(sendEmail(ADMIN_EMAIL, emailSubject, html), emailSubject, ADMIN_EMAIL);
}

export function sendKycStatusEmail(to: string, name: string, approved: boolean): void {
  const html = renderEmail({
    title: approved ? "Identity Verified" : "Verification Rejected",
    recipientName: name,
    rows: [
      { label: "User", value: name },
      { label: "KYC Status", value: approved ? "Verified" : "Rejected" },
      { label: "Reviewed At", value: fmtDate() },
    ],
    outro: approved
      ? "Your identity has been verified. You now have full access to all SmartLedger Premium features."
      : "Your identity verification was not successful. Please re-submit your documents or contact support.",
  });
  const emailSubject = subject(approved ? "Identity verified" : "Verification rejected");
  dispatch(sendEmail(to, emailSubject, html), emailSubject, to);
}

export async function sendCustomAdminEmail(
  to: string,
  name: string,
  customSubject: string,
  message: string
): Promise<void> {
  const cleanSubject = customSubject.trim();
  const html = renderEmail({
    title: cleanSubject,
    recipientName: name,
    intro: plainTextToHtml(message.trim()),
  });
  await sendEmail(to, subject(cleanSubject), html);
}
