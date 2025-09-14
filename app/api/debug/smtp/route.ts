// app/api/debug/smtp/route.ts
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

type SmtpError = Error & {
  code?: string;
  response?: string;
  command?: string;
};

function parseSmtpError(err: unknown) {
  if (typeof err === "object" && err !== null) {
    const e = err as Partial<SmtpError>;
    return {
      message: typeof e.message === "string" ? e.message : "Unknown error",
      code: typeof e.code === "string" ? e.code : undefined,
      response: typeof e.response === "string" ? e.response : undefined,
      command: typeof e.command === "string" ? e.command : undefined,
    };
  }
  return { message: "Unknown error" };
}

export async function GET() {
  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: String(process.env.SMTP_SECURE ?? "false").toLowerCase() === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      requireTLS: String(process.env.SMTP_SECURE ?? "false").toLowerCase() !== "true",
      connectionTimeout: 15000,
    });

    const ok = await transport.verify();
    return NextResponse.json({ ok });
  } catch (err: unknown) {
    const { message, code, response, command } = parseSmtpError(err);
    return NextResponse.json(
      { ok: false, message, code, response, command },
      { status: 500 }
    );
  }
}
