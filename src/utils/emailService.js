/**
 * Email Service — Intranet CEC
 *
 * Prioridad de transporte:
 *   1. SMTP propio / Gmail  → SMTP_USER + SMTP_PASS en .env
 *   2. Mailtrap SDK         → MAILTRAP_TOKEN en .env
 *   3. Stub mode            → solo console.log (sin credenciales)
 *
 * Variables de entorno (.env):
 *
 *   # Opción A — Gmail o cualquier SMTP
 *   SMTP_HOST=smtp.gmail.com          # o smtp.office365.com, etc.
 *   SMTP_PORT=587                     # 587 (STARTTLS) o 465 (SSL)
 *   SMTP_SECURE=false                 # true solo si PORT=465
 *   SMTP_USER=tucorreo@gmail.com
 *   SMTP_PASS=xxxx xxxx xxxx xxxx    # contraseña de aplicación de Google
 *   FROM_EMAIL=tucorreo@gmail.com
 *   FROM_NAME=Intranet CEC Camargo
 *
 *   # Opción B — Mailtrap (testing / sandbox)
 *   MAILTRAP_TOKEN=tu_token
 *   MAILTRAP_FROM_EMAIL=hello@demomailtrap.co
 *   MAILTRAP_FROM_NAME=Intranet CEC Camargo
 *
 *   INTRANET_URL=https://intranet-cec.onrender.com
 */

const nodemailer     = require('nodemailer');
const { MailtrapClient } = require('mailtrap');

/* ── Configuración ────────────────────────────────────────── */
const FROM_NAME  = process.env.FROM_NAME  || process.env.MAILTRAP_FROM_NAME  || 'Intranet CEC Camargo';
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.MAILTRAP_FROM_EMAIL || 'noreply@cec.edu.pe';

/* ── Selección de transporte ──────────────────────────────── */

// 1. SMTP (Gmail, Office365, etc.)
let smtpTransport = null;
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  smtpTransport = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  console.log(`📧 Email: modo SMTP (${process.env.SMTP_HOST || 'smtp.gmail.com'})`);
}

// 2. Mailtrap SDK
let mailtrapClient = null;
if (!smtpTransport && process.env.MAILTRAP_TOKEN) {
  mailtrapClient = new MailtrapClient({ token: process.env.MAILTRAP_TOKEN });
  console.log('📧 Email: modo Mailtrap');
}

if (!smtpTransport && !mailtrapClient) {
  console.log('📧 Email: modo STUB (configura SMTP_USER+SMTP_PASS o MAILTRAP_TOKEN para envío real)');
}

/* ─────────────────────────────────────────────────────────
   Helper interno para enviar
───────────────────────────────────────────────────────── */
async function sendMail({ to, subject, html }) {
  // 1. SMTP
  if (smtpTransport) {
    await smtpTransport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email SMTP enviado a ${to} — "${subject}"`);
    return;
  }

  // 2. Mailtrap
  if (mailtrapClient) {
    await mailtrapClient.send({
      from:     { email: FROM_EMAIL, name: FROM_NAME },
      to:       [{ email: to }],
      subject,
      html,
      category: 'Intranet CEC',
    });
    console.log(`📧 Email Mailtrap enviado a ${to} — "${subject}"`);
    return;
  }

  // 3. Stub
  console.log(`\n📧 [EMAIL STUB] Para: ${to} | Asunto: ${subject}`);
  console.log('   (Configura SMTP_USER+SMTP_PASS o MAILTRAP_TOKEN para envío real)\n');
}

/* ─────────────────────────────────────────────────────────
   Plantilla HTML compartida
───────────────────────────────────────────────────────── */
function wrapEmail(body) {
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:540px;margin:auto;border:1px solid #dee2e6;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#0a9396,#0d4f5c);padding:24px 28px;color:white;">
        <h2 style="margin:0;font-size:20px;font-weight:700;">Intranet CEC Camargo</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.82;">Academia de Preparación Universitaria</p>
      </div>
      <div style="padding:28px 32px;">
        ${body}
        <p style="color:#9ca3af;font-size:11px;margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;">
          Este mensaje fue generado automáticamente — por favor no respondas a este correo.
        </p>
      </div>
    </div>
  `;
}

/* ─────────────────────────────────────────────────────────
   1. Credenciales de acceso (alumno nuevo)
───────────────────────────────────────────────────────── */
async function sendCredentials(email, nombres, codigo, passwordRaw) {
  const subject = '🎓 Tus credenciales de acceso — Intranet CEC';
  const html = wrapEmail(`
    <p style="color:#374151;font-size:15px;margin-top:0;">Hola, <strong>${nombres}</strong></p>
    <p style="color:#6c757d;font-size:14px;line-height:1.6;">
      Tu registro en <strong>Intranet CEC Camargo</strong> ha sido completado.
      A continuación encontrarás tus datos de acceso:
    </p>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:18px 22px;margin:20px 0;">
      <table style="border-collapse:collapse;width:100%;font-size:13px;color:#374151;">
        <tr>
          <td style="padding:5px 0;font-weight:700;width:160px;">🎫 Código de alumno</td>
          <td style="font-family:monospace;font-size:16px;color:#0d4f5c;font-weight:700;">${codigo}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-weight:700;">🔑 Contraseña temporal</td>
          <td style="font-family:monospace;font-size:16px;color:#0d4f5c;font-weight:700;">${passwordRaw}</td>
        </tr>
      </table>
    </div>

    <p style="color:#dc2626;font-size:12px;margin:0;">
      ⚠️ Por seguridad, cambia tu contraseña al ingresar por primera vez.
    </p>
  `);

  await sendMail({ to: email, subject, html });
}

/* ─────────────────────────────────────────────────────────
   2. Bienvenida a nuevo ciclo (alumno ya existente)
───────────────────────────────────────────────────────── */
async function sendWelcomeCiclo(email, nombres, codigo, cicloNombre) {
  const intranetUrl = process.env.INTRANET_URL || 'https://intranet-cec.onrender.com';
  const subject = `📚 Matrícula confirmada — ${cicloNombre} | Intranet CEC`;
  const html = wrapEmail(`
    <p style="color:#374151;font-size:15px;margin-top:0;">Hola, <strong>${nombres}</strong></p>
    <p style="color:#6c757d;font-size:14px;line-height:1.6;">
      Tu matrícula en el ciclo <strong style="color:#0d4f5c;">${cicloNombre}</strong>
      ha sido registrada exitosamente. Ya puedes ingresar a la plataforma con tu código habitual.
    </p>

    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:18px 22px;margin:20px 0;">
      <table style="border-collapse:collapse;width:100%;font-size:13px;color:#374151;">
        <tr>
          <td style="padding:5px 0;font-weight:700;width:160px;">🎫 Código de alumno</td>
          <td style="font-family:monospace;font-size:16px;color:#0d4f5c;font-weight:700;">${codigo}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-weight:700;">📅 Ciclo matriculado</td>
          <td style="font-size:14px;color:#0d4f5c;font-weight:600;">${cicloNombre}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;font-weight:700;">🌐 Acceso</td>
          <td>
            <a href="${intranetUrl}" style="color:#0a9396;font-size:13px;text-decoration:none;font-weight:600;">
              ${intranetUrl}
            </a>
          </td>
        </tr>
      </table>
    </div>

    <a href="${intranetUrl}"
       style="display:inline-block;margin-top:4px;padding:11px 26px;background:linear-gradient(135deg,#0a9396,#0d4f5c);color:white;border-radius:8px;font-size:13px;font-weight:700;text-decoration:none;">
      Ingresar a la Intranet →
    </a>
  `);

  await sendMail({ to: email, subject, html });
}

module.exports = { sendCredentials, sendWelcomeCiclo };
