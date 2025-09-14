// lib/email.ts
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const {
  SMTP_HOST,
  SMTP_PORT = "465",
  SMTP_SECURE = "true",
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = "NextWatch <noreply@nextwatch.se>",
  SMTP_AUTH_METHOD, // t.ex. LOGIN
} = process.env;

function makeTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP config saknas (HOST/USER/PASS).");
  }

  const port = Number(SMTP_PORT);
  const secure = String(SMTP_SECURE).toLowerCase() === "true";

  const options: SMTPTransport.Options = {
    host: SMTP_HOST,
    port,
    secure,                    // true = TLS från start (465)
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    authMethod: SMTP_AUTH_METHOD, // t.ex. "LOGIN"
    requireTLS: !secure,       // för 587/STARTTLS
    connectionTimeout: 15_000,
    logger: true,
    debug: true,
  };

  return nodemailer.createTransport(options);
}

export async function sendVerificationEmail(to: string, url: string) {
  const transporter = makeTransport();
  await transporter.verify();

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
      <h2>Aktivera ditt NextWatch-konto</h2>
      <p>Klicka på länken för att bekräfta din e-post:</p>
      <p><a href="${url}" target="_blank" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Bekräfta e-post</a></p>
      <p>Gäller i 30 minuter.</p>
    </div>
  `;

  await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject: "Bekräfta din e-post till NextWatch",
    html,
  });
}
