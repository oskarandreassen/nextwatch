// lib/email.ts
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST || "";
const port = Number(process.env.SMTP_PORT || "465");
const user = process.env.SMTP_USER || "";
const pass = process.env.SMTP_PASS || "";
const from = process.env.SMTP_FROM || `NextWatch <no-reply@localhost>`;

export function getTransport() {
  const secure = port === 465; // 465 = SSL, 587 = STARTTLS
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export async function sendVerificationEmail(to: string, link: string) {
  const transporter = getTransport();
  await transporter.sendMail({
    from,
    to,
    subject: "Aktivera ditt NextWatch-konto",
    html: `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif">
        <h2>Välkommen till NextWatch</h2>
        <p>Klicka för att bekräfta din e-post och aktivera kontot:</p>
        <p><a href="${link}" style="display:inline-block;padding:10px 14px;background:#111;color:#fff;border-radius:8px;text-decoration:none">Aktivera konto</a></p>
        <p>Om länken inte fungerar, kopiera: <br/><code>${link}</code></p>
      </div>
    `,
  });
}
