const { sendEmail } = require("../../services/email_service.js");
require("dotenv").config();

const solicitar_ser_nutricionista = async (req, res, next) => {
  try {
    const { usuario_id, nombre_completo, correo } = req.body;

    await sendEmail({
      to: process.env.EMAIL_ADMINISTRADOR,
      subject: `Solicitud de Nutricionista - ${nombre_completo}`,
      text: `Estimado administrador, me dirijo a usted para solicitar el acceso como Nutricionista en su aplicación. Mi nombre es ${nombre_completo}, mi ID de usuario es ${usuario_id} y correo electrónico es ${correo}. 
      
      Agradezco su atención y quedo a la espera de su respuesta.`,
    });

    return res.status(200).json({
      message: "Nutricionista guardado correctamente",
    });
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
};

module.exports = { solicitar_ser_nutricionista };
