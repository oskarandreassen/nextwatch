import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type SmtpError = Error & {
  code?: string;
  response?: string;
  command?: string;
};

function readEnvBool(v: string | undefined, fallback: boolean) {
  if (v == null) return fallback;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

function toErr(e: unknown) {
  if (typeof e === "object" && e !== null) {
    const x = e as Partial<SmtpError>;
    return {
      message: typeof x.message === "string" ? x.message : "Unknown error",
      code: typeof x.code === "string" ? x.code : undefined,
      response: typeof x.response === "string" ? x.response : undefined,
      command: typeof x.command === "string" ? x.command : undefined,
    };
  }
  return { message: "Unknown error" };
}

async function tryVerify(
  secure: boolean,
  port: number,
  authMethod: "LOGIN" | "PLAIN"
) {
  const host = process.env.SMTP_HOST ?? "smtp.strato.com";
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    authMethod,
    requireTLS: !secure,
    tls: { ciphers: "TLSv1.2" },
    connectionTimeout: 12000,
  });

  const start = Date.now();
  try {
    const ok = await transport.verify();
    return {
      secure,
      port,
      authMethod,
      ok,
      ms: Date.now() - start,
    };
  } catch (e: unknown) {
    const err = toErr(e);
    return {
      secure,
      port,
      authMethod,
      ok: false as const,
      ms: Date.now() - start,
      error: err,
    };
  }
}

export async function GET() {
  // Kör en liten matris: 465/TLS + 587/STARTTLS × (LOGIN, PLAIN)
  const tests = await Promise.all([
    tryVerify(true, 465, "LOGIN"),
    tryVerify(true, 465, "PLAIN"),
    tryVerify(false, 587, "LOGIN"),
    tryVerify(false, 587, "PLAIN"),
  ]);

  // Rekommendera bästa config
  const success = tests.find(t => t.ok);
  const recommendation = success
    ? {
        secure: success.secure,
        port: success.port,
        authMethod: success.authMethod,
      }
    : null;

  return NextResponse.json({
    tests,
    recommendation,
    env: {
      host: process.env.SMTP_HOST,
      user: process.env.SMTP_USER,
      from: process.env.SMTP_FROM,
      secureEnv: readEnvBool(process.env.SMTP_SECURE, true),
      portEnv: Number(process.env.SMTP_PORT ?? "465"),
      authMethodEnv: (process.env.SMTP_AUTH_METHOD ?? "LOGIN").toUpperCase(),
    },
  });
}
