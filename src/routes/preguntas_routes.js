const { Router } = require("express");
const router = Router();

const { getListPreguntas, getListOpciones } = require("../controllers/preguntas/preguntas_controllers");

// Obtener lista de preguntas
router.get("/listar", getListPreguntas);
// Obtener opciones de una pregunta específica
router.get("/listar/opciones/:id_pregunta", getListOpciones);

module.exports = router;
