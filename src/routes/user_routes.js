const { Router } = require("express");
const router = Router();

const {
  listar_usuarios,
  modificar_usuario,
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
} = require("../controllers/Usuarios/usuarios_controller");

const { solicitar_ser_nutricionista } = require("../controllers/email/email_controller");

//Obtener recursos
router.get("/listar/", listar_usuarios);
//Editar recursos
router.put("/modificar", modificar_usuario);
router.put("/cambiar-contrasena", cambiar_contrasena);

// EndPoints para los usuarios
router.get("/listar/nutricionistas/:usuario_id", listar_nutricionistas);
router.post("/validar/nutricionista", validar_nutricionista);
router.post("/guardar/nutricionista", guardar_nutricionista);
router.post("/solicitar/nutricionista", solicitar_ser_nutricionista);
router.post("/asignarme/nutricionista", asignarme_nutricionista);
router.get("/nutricionista/:nutricionista_id/usuarios", listarUsuariosAsignados);

router.post("/notificacion", insertarNotificacionRecomendacion);
router.get("/notificaciones/:usuario_id", obtenerNotificacionesPorUsuario);
router.delete("/notificacion/eliminar", eliminarNotificacionRecomendacion);
router.get("/notificacion/detalle/:id_notificacion", obtenerRecomendacion);
router.post("/notificacion/imagen", obtenerImagenCombinacion);

// EndPoints para los nutricionistas
router.put("/nutricionista/aprobar/recomendacion", cambiarEstadoNotificacion);
router.get("/nutricionista/recomendaciones/:usuario_id", obtenerRecomendacionesPendientes);
router.delete("/nutricionista/desenlazar/usuario", desenlazarUsuario);
router.post("/nutricionista/asignaciones/mes", obtenerAsignacionesPorMes);
router.post("/nutricionista/contador-recomendaciones", obtenerContadorEstadosRecomendacion);

module.exports = router;
