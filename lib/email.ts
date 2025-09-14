// lib/email.ts
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM = "NextWatch <noreply@nextwatch.se>",
} = process.env;

function parseBool(v?: string) {
  return String(v ?? "").trim().toLowerCase() === "true";
}

function makeTransport(opts?: Partial<SMTPTransport.Options>) {
  const port = Number(opts?.port ?? SMTP_PORT ?? 587);
  const secure = opts?.secure ?? parseBool(SMTP_SECURE ?? "false"); // false => STARTTLS

  const options: SMTPTransport.Options = {
    host: SMTP_HOST,
    port,
    secure,                 // false => STARTTLS, true => implicit TLS
    auth: { user: SMTP_USER!, pass: SMTP_PASS! },
    requireTLS: !secure,    // tvinga STARTTLS när secure=false
    connectionTimeout: 15000,
    logger: true,
    debug: true,
  };

  return nodemailer.createTransport(options);
}

export async function sendVerificationEmail(to: string, url: string) {
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
      <h2>Aktivera ditt NextWatch-konto</h2>
      <p>Klicka på länken för att bekräfta din e-post:</p>
      <p>
        <a href="${url}" target="_blank"
           style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
           Bekräfta e-post
        </a>
      </p>
      <p>Gäller i 30 minuter.</p>
    </div>
  `;

  // 1) Försök med (det vi nu satt i env): 587 + STARTTLS
  try {
    const t = makeTransport({ secure: false, port: 587 });
    await t.verify();
    await t.sendMail({ from: SMTP_FROM, to, subject: "Bekräfta din e-post till NextWatch", html });
    return;
  } catch (err) {
    // 2) Fallback: 465 implicit TLS (för konton som kräver det)
    const t2 = makeTransport({ secure: true, port: 465 });
    await t2.verify();
    await t2.sendMail({ from: SMTP_FROM, to, subject: "Bekräfta din e-post till NextWatch", html });
  }
}
