import nodemailer from "nodemailer";

type TransportConfig = {
  host: string;
  port: number;
  secure: boolean; // true => 465 (implicit TLS), false => 587 (STARTTLS)
  user: string;
  pass: string;
  from: string;
  authMethod: "LOGIN" | "PLAIN" | "CRAM-MD5" | "XOAUTH2" | "OAUTHBEARER";
};

const cfg: TransportConfig = {
  host: process.env.SMTP_HOST ?? "smtp.strato.com",
  port: Number(process.env.SMTP_PORT ?? "465"),
  secure: (process.env.SMTP_SECURE ?? "true").toLowerCase() === "true",
  user: process.env.SMTP_USER ?? "",
  pass: process.env.SMTP_PASS ?? "",
  from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
  // Viktigt: tvinga LOGIN (Strato gillar inte alltid PLAIN)
  authMethod: ((process.env.SMTP_AUTH_METHOD ?? "LOGIN").toUpperCase() as TransportConfig["authMethod"]),
};

export const mailer = nodemailer.createTransport({
  host: cfg.host,
  port: cfg.port,
  secure: cfg.secure,
  auth: { user: cfg.user, pass: cfg.pass },
  authMethod: cfg.authMethod,
  requireTLS: !cfg.secure,         // STARTTLS när secure=false (port 587)
  tls: { ciphers: "TLSv1.2" },     // säkra chiffer
  connectionTimeout: 15000,
});

export async function sendVerificationMail(to: string, link: string) {
  // Verifiera kopplingen och creds innan vi skickar
  await mailer.verify();

  return mailer.sendMail({
    from: cfg.from,
    to,
    subject: "Aktivera ditt NextWatch-konto",
    text: `Hej!\n\nKlicka för att aktivera ditt konto:\n${link}\n\nLänken gäller i 30 minuter.`,
    html: `
      <p>Hej!</p>
      <p>Klicka för att aktivera ditt konto:</p>
      <p><a href="${link}">${link}</a></p>
      <p>Länken gäller i 30 minuter.</p>
    `,
  });
}


export { sendVerificationMail as sendVerificationEmail };
