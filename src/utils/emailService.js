/**
 * Email Service — Intranet CEC
 *
 * Para activar el envío real de correos, añade estas variables en tu .env:
 *
 *   # Opción A — Gmail (necesitas "Contraseña de aplicación" en myaccount.google.com/security)
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=tucorreo@gmail.com
 *   SMTP_PASS=xxxx xxxx xxxx xxxx
 *   SMTP_FROM="Intranet CEC <tucorreo@gmail.com>"
 *
 *   # Opción B — Mailtrap (pruebas, cuenta gratuita en mailtrap.io)
 *   SMTP_HOST=sandbox.smtp.mailtrap.io
 *   SMTP_PORT=2525
 *   SMTP_USER=<user de mailtrap>
 *   SMTP_PASS=<password de mailtrap>
 *   SMTP_FROM="Intranet CEC <no-reply@cec.edu.pe>"
 *
 *   # Opción C — SendGrid
 *   SMTP_HOST=smtp.sendgrid.net
 *   SMTP_PORT=587
 *   SMTP_USER=apikey
 *   SMTP_PASS=SG.xxxxxxxxxxxxxxxx
 *   SMTP_FROM="Intranet CEC <no-reply@cec.edu.pe>"
 *
 * Sin estas variables el servicio solo imprime en consola (stub mode).
 */
const nodemailer = require('nodemailer');

const smtpConfigured =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

let transporter = null;
if (smtpConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Envía las credenciales de acceso a un alumno recién creado.
 * @param {string} email - Correo del apoderado o del alumno
 * @param {string} nombres - Nombre del alumno
 * @param {string} codigo - Código de acceso generado
 * @param {string} passwordRaw - Contraseña en texto plano (antes del hash)
 */
async function sendCredentials(email, nombres, codigo, passwordRaw) {
  const subject = '🎓 Tus credenciales de acceso — Intranet CEC';
  const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: auto; border: 1px solid #dee2e6; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #0a9396, #0d4f5c); padding: 24px 28px; color: white;">
        <h2 style="margin: 0; font-size: 20px;">Intranet CEC Camargo</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.8;">Academia de Preparación Universitaria</p>
      </div>
      <div style="padding: 28px;">
        <p style="color: #374151; font-size: 15px;">Hola <strong>${nombres}</strong>,</p>
        <p style="color: #6c757d; font-size: 14px;">Tu matrícula ha sido registrada exitosamente. Aquí están tus datos de acceso:</p>
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-size: 13px; color: #374151;">
            <strong>🎫 Código de alumno:</strong>
            <span style="font-family: monospace; font-size: 15px; color: #0d4f5c; margin-left: 8px;">${codigo}</span>
          </p>
          <p style="margin: 0; font-size: 13px; color: #374151;">
            <strong>🔑 Contraseña temporal:</strong>
            <span style="font-family: monospace; font-size: 15px; color: #0d4f5c; margin-left: 8px;">${passwordRaw}</span>
          </p>
        </div>
        <p style="color: #dc2626; font-size: 12px;">⚠️ Cambia tu contraseña al ingresar por primera vez usando la opción "Recuperar contraseña".</p>
        <p style="color: #6c757d; font-size: 12px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
          Este mensaje fue enviado automáticamente. Por favor no respondas a este correo.
        </p>
      </div>
    </div>
  `;

  if (!transporter) {
    // STUB MODE — imprime en consola
    console.log('\n📧 [EMAIL STUB] Credenciales para:', email);
    console.log('   Alumno:', nombres);
    console.log('   Código:', codigo);
    console.log('   Password:', passwordRaw);
    console.log('   (Para enviar emails reales, configura SMTP_HOST, SMTP_USER, SMTP_PASS en .env)\n');
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Intranet CEC" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    html,
  });
  console.log(`📧 Credenciales enviadas a ${email}`);
}

module.exports = { sendCredentials };
