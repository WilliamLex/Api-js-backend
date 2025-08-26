const pool = require("../../database/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

// Verificar Usuario con el correo y otorgar token
const iniciar_sesion = async (req, res, next) => {
  try {
    const { p_correo, p_contra } = req.body;

    // Primero obtener el usuario y su contraseña encriptada de la base de datos
    const userQuery = await pool.query("SELECT * from fu_info_usuario($1)", [p_correo]);

    // Verificar si el usuario existe
    if (userQuery.rows.length === 0) {
      return res.status(401).json({
        error: "Credenciales incorrectas",
      });
    }

    const user = userQuery.rows[0];

    // Comparar la contraseña ingresada con la contraseña encriptada
    const isPasswordValid = await bcrypt.compare(p_contra, user.contrasena);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "Credenciales incorrectas",
      });
    }

    // Generar el token JWT
    const token = jwt.sign(
      {
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
        p_correo: p_correo,
        id_usuario: user.id_usuario,
        rol: user.rol,
      },
      process.env.SECRET_KEY || process.env.JWT_SECRET
    );

    // Enviar respuesta al frontend
    return res.json({
      verification: true,
      mensaje: "Login correcto",
      token: token,
      id: user.id_usuario,
      rol: user.rol,
      nombre_completo: user.nombre_completo,
      correo: user.correo,
      genero: user.genero,
    });
  } catch (error) {
    console.error("Error en iniciar_sesion:", error);
    next(error);
  }
};

const registrar_login = async (req, res, next) => {
  try {
    const { p_correo, p_contrasena, p_nombre_completo, p_genero } = req.body;

    // === Validación de campos obligatorios ===
    if (!p_correo || !p_contrasena || !p_nombre_completo || !p_genero) {
      return res.status(400).json({
        error: "Faltan campos requeridos: correo, contraseña, nombre completo o género",
      });
    }

    // === Validación básica de correo ===
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(p_correo)) {
      return res.status(400).json({
        error: "Correo electrónico no válido",
      });
    }

    // === Validación de seguridad de contraseña ===
    if (p_contrasena.length < 8) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 8 caracteres",
      });
    }

    // === Verificar si el usuario ya existe ===
    const existingUser = await pool.query("SELECT correo FROM usuarios WHERE correo = $1", [p_correo]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: "El correo electrónico ya está registrado",
      });
    }

    // === Generar identificador alfanumérico de 12 caracteres (en mayúsculas) ===
    const p_identificador = crypto.randomBytes(6).toString("hex").toUpperCase();

    // === ENCRIPTAR LA CONTRASEÑA ===
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(p_contrasena, saltRounds);

    // === Llamar a la función de PostgreSQL con la contraseña encriptada ===
    const result = await pool.query("SELECT fu_registrar_usuario($1, $2, $3, $4, $5, $6) AS resultado", [
      p_identificador,
      p_correo,
      hashedPassword, // Enviar la contraseña encriptada
      p_nombre_completo,
      "USUARIO",
      p_genero,
    ]);

    // === Verificar el resultado de la función ===
    const exito = result.rows[0].resultado;

    if (exito === 1) {
      // Generar token para el nuevo usuario
      const token = jwt.sign(
        {
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
          p_correo: p_correo,
          identificador: p_identificador,
        },
        process.env.SECRET_KEY || process.env.JWT_SECRET
      );

      return res.status(201).json({
        message: "Usuario registrado correctamente",
        identificador: p_identificador,
        token: token, // Opcional: enviar token para auto-login después del registro
      });
    } else {
      return res.status(400).json({
        error: "No se pudo registrar el usuario. El correo ya existe o hubo un error en el servidor.",
      });
    }
  } catch (error) {
    console.error("Error en registrar_login:", error.message);
    return res.status(500).json({
      error: "Ocurrió un error interno al procesar el registro.",
    });
  }
};

module.exports = {
  iniciar_sesion,
  registrar_login,
};
