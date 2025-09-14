// lib/email.ts
import nodemailer from "nodemailer";

const secure = (process.env.SMTP_SECURE ?? "true").toLowerCase() === "true";
const port = Number(process.env.SMTP_PORT ?? (secure ? 465 : 587));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,                  // true => 465 (implicit TLS), false => 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  requireTLS: !secure,     // tvinga STARTTLS när secure=false
  connectionTimeout: 15000,
});

export async function sendVerificationMail(to: string, link: string) {
  await transporter.verify();
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
    to,
    subject: "Aktivera ditt NextWatch-konto",
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
        <h2>Aktivera ditt konto</h2>
        <p>Klicka på länken för att bekräfta din e-post:</p>
        <p>
          <!-- OBS: inget target="_blank" längre -->
          <a href="${link}" style="background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">
            Bekräfta e-post
          </a>
        </p>
        <p>Länken gäller i 30 minuter.</p>
      </div>
    `,
  });
}

// alias så din nuvarande import fortsätter funka
export { sendVerificationMail as sendVerificationEmail };
