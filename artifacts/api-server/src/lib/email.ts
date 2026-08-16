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
            <td style="padding:16px 20px;color:${MUTED};font-size:14px;width:38%;vertical-align:top;${i > 0 ? `border-top:1px solid ${ROW_BORDER};` : ""}">${esc(r.label)}</td>
            <td style="padding:16px 20px;color:#ffffff;font-size:14px;font-weight:700;word-break:break-all;${i > 0 ? `border-top:1px solid ${ROW_BORDER};` : ""}">${esc(r.value)}</td>
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
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG};padding:24px 0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${CARD};border-radius:20px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px 36px;border-bottom:1px solid ${ROW_BORDER};">
              <span class="notranslate" translate="no" style="display:block;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">SmartLedger</span>
              <span class="notranslate" translate="no" style="display:block;color:${GOLD};font-size:12px;font-weight:700;letter-spacing:5px;margin-top:2px;">PREMIUM</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 36px 8px 36px;">
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;">${esc(title)}</h1>
              <div style="width:64px;height:4px;background-color:${GOLD};border-radius:2px;margin:14px 0 24px 0;"></div>
              ${intro ? `<p style="margin:0 0 24px 0;color:#c9ccd4;font-size:15px;line-height:1.6;">${intro}</p>` : ""}
              ${rowsHtml}
              ${outro ? `<p style="margin:24px 0 0 0;color:#c9ccd4;font-size:15px;line-height:1.6;">${outro}</p>` : ""}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:28px 36px 32px 36px;">
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
  try {
    await t.sendMail({
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      to: recipient,
      subject,
      html,
    });
  } catch (err) {
    console.error("[email] failed to send:", subject, err);
  }
}

// On Vercel, the serverless invocation may be frozen as soon as the HTTP
// response is sent, killing in-flight SMTP sockets. waitUntil() keeps the
// invocation alive until the send promise settles. Outside Vercel it's a no-op.
function dispatch(p: Promise<void>): void {
  void (async () => {
    try {
      const { waitUntil } = await import("@vercel/functions");
      waitUntil(p);
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
  dispatch(sendEmail(to, "Welcome to SmartLedger Premium", html));
}

export function sendWithdrawalRequestedEmail(
  to: string,
  data: { amount: number; method: string; address?: string | null }
): void {
  const rows: EmailRow[] = [
    { label: "User", value: to },
    { label: "Amount", value: fmtUsd(data.amount) },
  ];
  if (data.address) rows.push({ label: "Wallet / Account", value: data.address });
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
  dispatch(sendEmail(to, `Withdrawal Requested — ${fmtUsd(data.amount)}`, html));
}

export function sendWithdrawalCompletedEmail(
  to: string,
  data: { amount: number; method: string; address?: string | null }
): void {
  const rows: EmailRow[] = [
    { label: "User", value: to },
    { label: "Amount", value: fmtUsd(data.amount) },
  ];
  if (data.address) rows.push({ label: "Wallet / Account", value: data.address });
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
  dispatch(sendEmail(to, `Withdrawal Completed — ${fmtUsd(data.amount)}`, html));
}

export function sendWithdrawalRejectedEmail(to: string, data: { amount: number; method: string }): void {
  const html = renderEmail({
    title: "Withdrawal Rejected",
    rows: [
      { label: "User", value: to },
      { label: "Amount", value: fmtUsd(data.amount) },
      { label: "Method", value: data.method },
      { label: "Status", value: "Rejected" },
      { label: "Reviewed At", value: fmtDate() },
    ],
    outro: "The withdrawn amount has been returned to your account balance. Please contact support if you believe this was a mistake.",
  });
  dispatch(sendEmail(to, "Withdrawal Rejected", html));
}

export function sendDepositReceivedEmail(
  to: string,
  data: { usdAmount: number; coin?: string | null; amount?: number | null; symbol?: string | null }
): void {
  const rows: EmailRow[] = [{ label: "User", value: to }];
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
  dispatch(sendEmail(to, `Deposit Received — ${fmtUsd(data.usdAmount)}`, html));
}

export function sendDepositApprovedEmail(
  to: string,
  data: { usdAmount: number; coin?: string | null; amount?: number | null; symbol?: string | null }
): void {
  const rows: EmailRow[] = [{ label: "User", value: to }];
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
  dispatch(sendEmail(to, `Deposit Approved — ${fmtUsd(data.usdAmount)}`, html));
}

export function sendDepositRejectedEmail(to: string, data: { usdAmount: number }): void {
  const html = renderEmail({
    title: "Deposit Rejected",
    rows: [
      { label: "User", value: to },
      { label: "USD Value", value: fmtUsd(data.usdAmount) },
      { label: "Status", value: "Rejected" },
      { label: "Reviewed At", value: fmtDate() },
    ],
    outro: "Your deposit could not be confirmed. Please contact support for more information.",
  });
  dispatch(sendEmail(to, "Deposit Rejected", html));
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
  dispatch(sendEmail(to, "Reset Your Password — SmartLedger Premium", html));
}
// ---------- admin notifications ----------

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "officialsmartledgerpremium@gmail.com";

export function notifyAdminDepositReceived(
  userEmail: string,
  data: { usdAmount: number; coin?: string | null; amount?: number | null; symbol?: string | null }
): void {
  const rows: EmailRow[] = [{ label: "User", value: userEmail }];
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
  dispatch(sendEmail(ADMIN_EMAIL, `[Admin] New Deposit — ${fmtUsd(data.usdAmount)} from ${userEmail}`, html));
}

export function notifyAdminWithdrawalRequested(
  userEmail: string,
  data: { amount: number; method: string; address?: string | null }
): void {
  const rows: EmailRow[] = [{ label: "User", value: userEmail }];
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
  dispatch(sendEmail(ADMIN_EMAIL, `[Admin] New Withdrawal — ${fmtUsd(data.amount)} from ${userEmail}`, html));
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
  dispatch(sendEmail(ADMIN_EMAIL, `[Admin] New User — ${userEmail}`, html));
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
  dispatch(sendEmail(ADMIN_EMAIL, `[Admin] KYC Submission — ${userEmail}`, html));
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
  dispatch(sendEmail(to, approved ? "Identity Verified — SmartLedger Premium" : "Verification Rejected", html));
}
