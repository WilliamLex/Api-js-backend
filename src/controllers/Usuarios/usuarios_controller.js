const pool = require("../../database/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

//funcion para listar los datos del usuario

const listar_usuarios = async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM fu_listar_usuarios()");
    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

//funcion para modificar los datos del usuario

const modificar_usuario = async (req, res, next) => {
  const { usuario_id, p_nombre_apellidos, p_genero } = req.body;

  // 1. Validación de entrada
  if (!usuario_id || !p_nombre_apellidos || !p_genero) {
    return res.status(400).json({
      error: "Faltan campos requeridos: usuario_id, p_nombre_apellidos, p_genero",
    });
  }

  // Validar género permitido (opcional, pero recomendado)
  const generosPermitidos = ["Masculino", "Femenino", "Otro"];
  if (!generosPermitidos.includes(p_genero)) {
    return res.status(400).json({
      error: `Género inválido. Permitidos: ${generosPermitidos.join(", ")}`,
    });
  }

  try {
    // 2. Actualizar usuario (orden correcto de parámetros)
    const result = await pool.query(
      "UPDATE usuarios SET nombre_completo = $1, genero = $2 WHERE id_usuario = $3 RETURNING id_usuario, nombre_completo, genero",
      [p_nombre_apellidos, p_genero, usuario_id] // ¡orden correcto!
    );

    // 3. Verificar si se encontró y actualizó el usuario
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    // 4. Respuesta exitosa
    return res.status(200).json({
      message: "Usuario actualizado correctamente",
      usuario: result.rows[0], // Devuelve los datos actualizados
    });
  } catch (error) {
    // 5. Manejo de errores específicos
    console.error("Error al modificar usuario:", error);

    // Si es un error de base de datos (ej. violación de constraint)
    if (error.code) {
      return res.status(500).json({
        error: "Error en la base de datos",
        detalle: error.message,
      });
    }

    // Para otros errores
    return res.status(500).json({
      error: "Error interno del servidor",
    });
  }
};

// === Función adicional para cambiar contraseña ===
const cambiar_contrasena = async (req, res, next) => {
  try {
    const { p_usuario_id, p_contra_actual, p_contra_nueva } = req.body;

    // Validar que la nueva contraseña sea segura
    if (p_contra_nueva.length < 8) {
      return res.status(400).json({
        error: "La nueva contraseña debe tener al menos 8 caracteres",
      });
    }

    // Obtener el usuario actual
    const userQuery = await pool.query("SELECT id_usuario, contrasena FROM usuarios WHERE id_usuario = $1", [
      p_usuario_id,
    ]);

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        error: "Usuario no encontrado",
      });
    }

    const user = userQuery.rows[0];

    // Verificar la contraseña actual
    const isPasswordValid = await bcrypt.compare(p_contra_actual, user.contrasena);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: "La contraseña actual es incorrecta",
      });
    }

    // Encriptar la nueva contraseña
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(p_contra_nueva, saltRounds);

    // Actualizar la contraseña en la base de datos
    await pool.query("UPDATE usuarios SET contrasena = $1 WHERE id_usuario = $2", [hashedNewPassword, user.id_usuario]);

    return res.json({
      message: "Contraseña actualizada correctamente",
    });
  } catch (error) {
    console.error("Error en cambiar_contrasena:", error);
    next(error);
  }
};

const listar_nutricionistas = async (req, res, next) => {
  const { usuario_id } = req.params;

  try {
    const result = await pool.query("SELECT * FROM fu_obtener_nutricionistas($1)", [usuario_id]);

    const nutricionistas = result.rows;

    // Verificar si en el listado hay al menos un nutricionista con estado 'Asignado'
    const tiene_asignado = nutricionistas.some((n) => n.estado === "Asignado");

    // Enviar respuesta con el listado y el nuevo campo booleano
    return res.status(200).json({
      nutricionistas,
      tiene_asignado,
    });
  } catch (error) {
    return res.status(404).json({ message: error.message });
  }
};

const validar_nutricionista = async (req, res, next) => {
  try {
    const { usuario_id } = req.body;
    const result = await pool.query("SELECT fu_validar_nutricionista($1)", [usuario_id]);
    var resultado = "";

    if (result.rows.length > 0 && result.rows[0].fu_validar_nutricionista) {
      resultado = result.rows[0].fu_validar_nutricionista;
      console.log(resultado);
      if (resultado === "Asignado") {
        return res.status(200).json({ message: "El usuario es nutricionista", code: 200 });
      } else {
        return res.status(200).json({ message: "El usuario no es nutricionista", code: 201 });
      }
    } else {
      return res.status(200).json({ message: "No se encontró el usuario", code: 404 });
    }
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
};

const guardar_nutricionista = async (req, res, next) => {
  try {
    const { usuario_id } = req.body;
    const result = await pool.query("SELECT insertar_asignacion_nutricionista($1)", [usuario_id]);
    return res.status(200).json({
      message: "Nutricionista guardado correctamente",
      registrado: result.rows[0].insertar_asignacion_nutricionista,
    });
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
};

const asignarme_nutricionista = async (req, res, next) => {
  try {
    const { nutricionista_id, usuario_id } = req.body;

    // Validar que los campos necesarios existan
    if (!nutricionista_id || !usuario_id) {
      return res.status(400).json({
        message: "Los campos 'nutricionista_id' y 'usuario_id' son obligatorios",
      });
    }

    // Llamar a la función en la base de datos
    const result = await pool.query("SELECT fu_enlazar_nutricionista_usuario($1, $2) AS resultado", [
      nutricionista_id,
      usuario_id,
    ]);

    // Obtener el resultado de la función
    const exito = result.rows[0].resultado;

    // Validar el resultado devuelto por la función
    if (exito === 1) {
      await pool.query("INSERT INTO historial_asignacion_usuario (nutricionista_id) VALUES ($1)", [nutricionista_id]);
      return res.status(200).json({
        message: "Nutricionista asignado correctamente",
        registrado: true,
      });
    } else {
      return res.status(400).json({
        message: "No puedes asignarte un nutricionista porque ya tienes uno asignado",
        registrado: false,
      });
    }
  } catch (error) {
    // Captura errores de base de datos u otros
    return res.status(500).json({
      message: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const listarUsuariosAsignados = async (req, res) => {
  try {
    // Obtener el nutricionista_id de los query params
    const { nutricionista_id } = req.params;

    // Validar que se proporcionó el ID
    if (!nutricionista_id || isNaN(nutricionista_id)) {
      return res.status(400).json({
        error: "El parámetro 'nutricionista_id' es obligatorio y debe ser un número",
      });
    }

    // Llamar a la función de PostgreSQL
    const result = await pool.query("SELECT * FROM fu_listar_usuario_asignados($1)", [parseInt(nutricionista_id)]);

    // Verificar si se obtuvieron resultados
    if (result.rows.length === 0) {
      return res.status(200).json({
        message: "No se encontraron usuarios asignados",
        usuarios: [],
      });
    }

    // Retornar los usuarios encontrados
    return res.status(200).json({
      message: "Usuarios asignados obtenidos correctamente",
      usuarios: result.rows,
    });
  } catch (error) {
    console.error("Error al listar usuarios asignados:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const insertarNotificacionRecomendacion = async (req, res) => {
  try {
    const {
      id_notificacion,
      usuario_id,
      nombre_notificacion,
      recomendacion,
      hora_ejecucion,
      minuto_ejecucion,
      dias_ejecucion,
    } = req.body;

    // Validaciones básicas
    if (
      !id_notificacion ||
      !usuario_id ||
      !nombre_notificacion ||
      !recomendacion ||
      hora_ejecucion === undefined ||
      minuto_ejecucion === undefined
    ) {
      return res.status(400).json({
        message: "Todos los campos obligatorios deben ser proporcionados",
        campos_requeridos: [
          "id_notificacion",
          "usuario_id",
          "nombre_notificacion",
          "recomendacion",
          "hora_ejecucion",
          "minuto_ejecucion",
        ],
      });
    }

    if (isNaN(usuario_id) || isNaN(hora_ejecucion) || isNaN(minuto_ejecucion)) {
      return res.status(400).json({
        error: "usuario_id, hora_ejecucion y minuto_ejecucion deben ser números",
      });
    }

    // Asegurarse de que dias_ejecucion sea un array (puede ser vacío)
    const dias = Array.isArray(dias_ejecucion) ? dias_ejecucion : [];

    // Llamar a la función de PostgreSQL
    const result = await pool.query(
      "SELECT fu_insertar_notificacion_recomendacion($1, $2, $3, $4, $5, $6, $7::INTEGER[])",
      [
        id_notificacion,
        parseInt(usuario_id),
        nombre_notificacion,
        recomendacion,
        parseInt(hora_ejecucion),
        parseInt(minuto_ejecucion),
        dias,
      ]
    );

    const exito = result.rows[0].fu_insertar_notificacion_recomendacion;

    if (exito === 1) {
      return res.status(201).json({
        message: "Notificación de recomendación creada exitosamente",
      });
    } else {
      return res.status(500).json({
        message: "No se pudo crear la notificación de recomendación",
      });
    }
  } catch (error) {
    console.error("Error al insertar notificación de recomendación:", error);
    return res.status(500).json({
      message: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const eliminarNotificacionRecomendacion = async (req, res) => {
  try {
    const { usuario_id, id_notificacion } = req.body;

    // Validaciones básicas
    if (!usuario_id || !id_notificacion) {
      return res.status(400).json({
        message: "Los campos 'usuario_id' e 'id_notificacion' son obligatorios en el cuerpo de la solicitud",
      });
    }

    // Validar que usuario_id sea un número
    const usuarioIdNum = parseInt(usuario_id, 10);
    if (isNaN(usuarioIdNum)) {
      return res.status(400).json({
        error: "El campo 'usuario_id' debe ser un número entero válido",
      });
    }

    // Llamar a la función de PostgreSQL
    const result = await pool.query("SELECT fu_eliminar_notificacion_recomendacion($1, $2) AS exito", [
      usuarioIdNum,
      id_notificacion,
    ]);

    const exito = result.rows[0].exito;

    if (exito === 1) {
      return res.status(200).json({
        message: "Notificación eliminada exitosamente",
      });
    } else {
      return res.status(404).json({
        message: "No se encontró la notificación o no se pudo eliminar",
      });
    }
  } catch (error) {
    console.error("Error al eliminar notificación de recomendación:", error);
    return res.status(500).json({
      message: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const obtenerNotificacionesPorUsuario = async (req, res) => {
  try {
    const { usuario_id } = req.params;

    // Validar que se proporcionó el usuario_id
    if (!usuario_id || isNaN(usuario_id)) {
      return res.status(400).json({
        error: "El parámetro 'usuario_id' es obligatorio y debe ser un número",
      });
    }

    // Llamar a la función de PostgreSQL
    const result = await pool.query("SELECT * FROM fu_obtener_notificaciones_por_usuario($1)", [parseInt(usuario_id)]);

    // Verificar si se encontraron notificaciones
    if (result.rows.length === 0) {
      return res.status(200).json({
        message: "No se encontraron notificaciones para este usuario",
        notificaciones: [],
      });
    }

    // Retornar las notificaciones encontradas
    return res.status(200).json({
      message: "Notificaciones obtenidas correctamente",
      notificaciones: result.rows,
    });
  } catch (error) {
    console.error("Error al obtener notificaciones por usuario:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const obtenerRecomendacion = async (req, res) => {
  try {
    const { id_notificacion } = req.params;

    // Validación del ID de notificación
    if (!id_notificacion) {
      return res.status(400).json({
        error: "El parámetro 'id_notificacion' es obligatorio.",
      });
    }

    // Llamada a la función PostgreSQL
    const result = await pool.query("SELECT * FROM fu_obtener_recomendacion($1)", [id_notificacion]);

    // Verificar si se encontró la recomendación
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No se encontró ninguna recomendación con ese ID.",
      });
    }

    // Como es una sola fila, retornamos el objeto directamente
    const recomendacion = result.rows[0];

    return res.status(200).json({
      message: "Recomendación obtenida exitosamente",
      recomendacion: recomendacion,
    });
  } catch (error) {
    console.error("Error al obtener la recomendación:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const cambiarEstadoNotificacion = async (req, res) => {
  try {
    const { id_notificacion, nuevo_estado, nutricionista_id } = req.body;

    // Validaciones
    if (!id_notificacion) {
      return res.status(400).json({
        error: "El parámetro 'id_notificacion' es obligatorio en los parámetros de URL.",
      });
    }

    if (!nuevo_estado) {
      return res.status(400).json({
        error: "El campo 'nuevo_estado' es obligatorio en el cuerpo de la solicitud.",
      });
    }

    // Llamada a la función PostgreSQL
    const result = await pool.query("SELECT fu_cambiar_estado_notificacion($1, $2) AS resultado", [
      id_notificacion,
      nuevo_estado,
    ]);

    const exito = result.rows[0].resultado;

    if (exito === 1) {
      await pool.query(
        "INSERT INTO historial_recomendacion_usuario (nutricionista_id, estado_recomendacion, fecha) VALUES ($1, $2, CURRENT_DATE)",
        [nutricionista_id, nuevo_estado]
      );
      return res.status(200).json({
        message: "Estado de la notificación actualizado exitosamente.",
      });
    } else {
      return res.status(404).json({
        message: "No se encontró la notificación o no se pudo actualizar.",
      });
    }
  } catch (error) {
    console.error("Error al cambiar el estado de la notificación:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const obtenerRecomendacionesPendientes = async (req, res) => {
  try {
    const { usuario_id } = req.params;

    // Validación
    if (!usuario_id || isNaN(parseInt(usuario_id))) {
      return res.status(400).json({
        error: "El parámetro 'usuario_id' debe ser un número entero válido.",
      });
    }

    const userId = parseInt(usuario_id);

    // Llamada a la función PostgreSQL
    const result = await pool.query("SELECT * FROM fu_obtener_recomendacion_pendientes_por_usuario($1)", [userId]);

    // Verificar si hay recomendaciones
    if (result.rows.length === 0) {
      return res.status(200).json({
        message: "No hay recomendaciones pendientes para este usuario.",
        recomendaciones: [],
      });
    }

    return res.status(200).json({
      message: "Recomendaciones pendientes obtenidas exitosamente.",
      recomendaciones: result.rows,
    });
  } catch (error) {
    console.error("Error al obtener recomendaciones pendientes:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const desenlazarUsuario = async (req, res) => {
  try {
    const { nutricionista_id, usuario_id } = req.body;

    // Validaciones
    if (!nutricionista_id || isNaN(parseInt(nutricionista_id))) {
      return res.status(400).json({
        error: "El parámetro 'nutricionista_id' debe ser un número entero válido.",
      });
    }

    if (!usuario_id || isNaN(parseInt(usuario_id))) {
      return res.status(400).json({
        error: "El parámetro 'usuario_id' debe ser un número entero válido.",
      });
    }

    const nutricionistaId = parseInt(nutricionista_id);
    const usuarioId = parseInt(usuario_id);

    // Llamada a la función PostgreSQL
    const result = await pool.query("SELECT fu_desenlazar_usuario($1, $2) AS resultado", [nutricionistaId, usuarioId]);

    const exito = result.rows[0].resultado;

    if (exito === 1) {
      return res.status(200).json({
        message: "Usuario desenlazado del nutricionista exitosamente.",
      });
    } else {
      return res.status(404).json({
        message: "No se encontró la relación entre el nutricionista y el usuario.",
      });
    }
  } catch (error) {
    console.error("Error al desenlazar usuario:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const obtenerImagenCombinacion = async (req, res) => {
  try {
    const { respuestas } = req.body;

    // Validación del cuerpo de la petición
    if (!respuestas) {
      return res.status(400).json({
        error: "El campo 'respuestas' es requerido en el cuerpo de la petición.",
      });
    }

    // Validar que respuestas sea un array
    if (!Array.isArray(respuestas)) {
      return res.status(400).json({
        error: "El campo 'respuestas' debe ser un array.",
      });
    }

    // Validar que el array no esté vacío
    if (respuestas.length === 0) {
      return res.status(400).json({
        error: "El array de respuestas no puede estar vacío.",
      });
    }

    // Validar estructura de cada respuesta
    for (let i = 0; i < respuestas.length; i++) {
      const respuesta = respuestas[i];

      if (!respuesta.pregunta_id || !respuesta.opcion_id) {
        return res.status(400).json({
          error: `La respuesta en la posición ${i} debe contener 'pregunta_id' y 'opcion_id'.`,
        });
      }

      if (isNaN(parseInt(respuesta.pregunta_id)) || isNaN(parseInt(respuesta.opcion_id))) {
        return res.status(400).json({
          error: `Los valores de 'pregunta_id' y 'opcion_id' en la posición ${i} deben ser números enteros.`,
        });
      }
    }

    // Convertir el array a JSON string para pasarlo a la función
    const respuestasJson = JSON.stringify(respuestas);

    // Llamada a la función PostgreSQL
    const result = await pool.query("SELECT * FROM fu_obtener_imagen_combinacion($1::JSON)", [respuestasJson]);

    // Verificar si se encontró una combinación
    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "No se encontró ninguna combinación que coincida con las respuestas proporcionadas.",
        combinacion: null,
      });
    }

    // Retornar la combinación encontrada
    const combinacion = result.rows[0];

    return res.status(200).json({
      message: "Combinación encontrada exitosamente.",
      combinacion: {
        combinacion_id: combinacion.combinacion_id,
        imagen_url: combinacion.imagen_url,
        coincidencias: combinacion.coincidencias,
      },
    });
  } catch (error) {
    console.error("Error al obtener imagen de combinación:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      detalle: error.message,
    });
  }
};

const obtenerAsignacionesPorMes = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, nutricionista_id } = req.body;

    // Validación de campos requeridos
    if (!fecha_inicio || !fecha_fin || !nutricionista_id) {
      return res.status(400).json({
        message:
          "Los campos 'fecha_inicio', 'fecha_fin' y 'nutricionista_id' son obligatorios en el cuerpo de la solicitud.",
      });
    }

    // Validar formato de fechas
    const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexFecha.test(fecha_inicio)) {
      return res.status(400).json({
        message: "El campo 'fecha_inicio' debe tener el formato YYYY-MM-DD.",
      });
    }
    if (!regexFecha.test(fecha_fin)) {
      return res.status(400).json({
        message: "El campo 'fecha_fin' debe tener el formato YYYY-MM-DD.",
      });
    }

    // Validar nutricionista_id
    const nutricionistaIdNum = parseInt(nutricionista_id, 10);
    if (isNaN(nutricionistaIdNum) || nutricionistaIdNum <= 0) {
      return res.status(400).json({
        message: "El campo 'nutricionista_id' debe ser un número entero válido mayor a 0.",
      });
    }

    // Llamar a la función de PostgreSQL
    const result = await pool.query(
      `SELECT mes, anio, cantidad_asignaciones 
       FROM obtener_asignaciones_por_mes($1, $2, $3)`,
      [fecha_inicio, fecha_fin, nutricionistaIdNum]
    );

    // Devolver respuesta
    return res.status(200).json({
      message: "Asignaciones por mes obtenidas exitosamente.",
      data: result.rows,
    });
  } catch (error) {
    console.error("Error en obtenerAsignacionesPorMes:", error.message);
    return res.status(500).json({
      message: "Error interno del servidor al obtener asignaciones por mes.",
      detalle: error.message,
    });
  }
};

const obtenerContadorEstadosRecomendacion = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, nutricionista_id } = req.body;

    // Validación
    if (!fecha_inicio || !fecha_fin || !nutricionista_id) {
      return res.status(400).json({
        message: "Los campos 'fecha_inicio', 'fecha_fin' y 'nutricionista_id' son obligatorios.",
      });
    }

    const regexFecha = /^\d{4}-\d{2}-\d{2}$/;
    if (!regexFecha.test(fecha_inicio) || !regexFecha.test(fecha_fin)) {
      return res.status(400).json({
        message: "Las fechas deben tener el formato YYYY-MM-DD.",
      });
    }

    const nutricionistaIdNum = parseInt(nutricionista_id, 10);
    if (isNaN(nutricionistaIdNum) || nutricionistaIdNum <= 0) {
      return res.status(400).json({
        message: "El 'nutricionista_id' debe ser un número entero válido.",
      });
    }

    // Consulta a la base de datos
    const result = await pool.query(
      `SELECT aprobados, rechazados 
       FROM obtener_contador_estados_recomendacion($1, $2, $3)`,
      [fecha_inicio, fecha_fin, nutricionistaIdNum]
    );

    const { aprobados, rechazados } = result.rows[0];

    return res.status(200).json({
      message: "Contador de estados de recomendaciones obtenido exitosamente.",
      data: {
        aprobados: parseInt(aprobados),
        rechazados: parseInt(rechazados),
      },
    });
  } catch (error) {
    console.error("Error en obtenerContadorEstadosRecomendacion:", error.message);
    return res.status(500).json({
      message: "Error interno del servidor al obtener el contador de estados.",
      detalle: error.message,
    });
  }
};

module.exports = {
  modificar_usuario,
  listar_usuarios,
  listar_nutricionistas,
  validar_nutricionista,
  guardar_nutricionista,
  asignarme_nutricionista,
  listarUsuariosAsignados,
  insertarNotificacionRecomendacion,
  obtenerNotificacionesPorUsuario,
  eliminarNotificacionRecomendacion,
  obtenerRecomendacion,
  cambiarEstadoNotificacion,
  obtenerRecomendacionesPendientes,
  desenlazarUsuario,
  obtenerImagenCombinacion,
  cambiar_contrasena,
  obtenerAsignacionesPorMes,
  obtenerContadorEstadosRecomendacion,
};
