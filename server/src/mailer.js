import nodemailer from 'nodemailer';

let transport;

/** Sends one email via Resend (if RESEND_API_KEY is set) or Gmail/SMTP. Throws on failure. */
export async function sendMail({ to, subject, text, html, attachments = [] }) {
  const { RESEND_API_KEY, RESEND_FROM, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM || 'Kokobi+ Orders <onboarding@resend.dev>', to: [to], subject, text, html,
        attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString('base64') })),
      }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    return;
  }

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error('Email is not configured. Set SMTP_USER and SMTP_PASS (or RESEND_API_KEY) in .env');
  }
  transport ||= nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: Number(SMTP_PORT) || 465,
    secure: (Number(SMTP_PORT) || 465) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    socketTimeout: 15000,
  });
  await transport.sendMail({ from: `"Kokobi+ Orders" <${SMTP_USER}>`, to, subject, text, html, attachments });
}
