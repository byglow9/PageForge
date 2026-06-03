/**
 * Transactional email abstraction.
 *
 * Transport selection via EMAIL_TRANSPORT env var:
 *   - "console" (default, local dev): logs to stdout
 *   - "smtp": sends via SMTP using nodemailer
 *
 * Test capture: import `sentEmails` array to assert on emails in tests.
 */

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * In-memory store for emails captured during tests.
 * Populated when NODE_ENV === "test" or EMAIL_TRANSPORT === "test".
 */
export const sentEmails: EmailPayload[] = [];

/**
 * Clear captured test emails. Call in beforeEach/afterEach in tests.
 */
export function clearSentEmails(): void {
  sentEmails.splice(0, sentEmails.length);
}

async function sendViaSmtp(payload: EmailPayload): Promise<void> {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? "noreply@pageforge.app",
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

function sendViaConsole(payload: EmailPayload): void {
  console.log("[email]", {
    to: payload.to,
    subject: payload.subject,
    body: payload.text,
  });
  // Extract verification or action URLs for convenience in dev
  const urlMatch = payload.text.match(/https?:\/\/\S+/);
  if (urlMatch) {
    console.log("[email] URL:", urlMatch[0]);
  }
}

/**
 * Send a transactional email.
 *
 * Selects the transport from EMAIL_TRANSPORT env:
 *   - "smtp"    → real SMTP delivery
 *   - "test"    → captured in sentEmails[] (no output)
 *   - anything else → console log (default for local dev)
 */
export async function sendEmail(payload: EmailPayload): Promise<void> {
  const transport = process.env.EMAIL_TRANSPORT ?? "console";

  // Always capture in test environment regardless of transport
  if (process.env.NODE_ENV === "test" || transport === "test") {
    sentEmails.push(payload);
    return;
  }

  if (transport === "smtp") {
    await sendViaSmtp(payload);
    return;
  }

  // Default: console
  sendViaConsole(payload);
}
