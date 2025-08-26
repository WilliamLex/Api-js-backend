const nodemailer = require("nodemailer");
require("dotenv").config(); // Para leer variables desde .env

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE, // true para 465, false para otros puertos
  requireTLS: process.env.EMAIL_REQUIRE_TLS, // Requiere TLS
  tls: {
    rejectUnauthorized: false, // Permite certificados no verificados
    servername: process.env.EMAIL_HOST, // Nombre del servidor para TLS
  },
  auth: {
    user: process.env.EMAIL_USER, // Reemplaza con tu correo de Gmail
    pass: process.env.EMAIL_PASS, // Reemplaza con la contraseña de la aplicación
  },
});

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"NutriApp" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log("Correo enviado: %s", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error al enviar correo:", error);
    return { success: false, error };
  }
};

module.exports = {
  sendEmail,
};
