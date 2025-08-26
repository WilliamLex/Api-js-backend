const { Router } = require("express");
const router = Router();
const { iniciar_sesion, registrar_login } = require("../controllers/Auth/auth_controller");
const jwt = require("jsonwebtoken");

router.post("/login", iniciar_sesion);
router.post("/registrar-usuario", registrar_login);

module.exports = router;
