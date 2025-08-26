const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookie_parser = require("cookie-parser"); //Para poder usar cookies
const path = require("path");
const http = require("http");

//Este middleware se ejecuta antes de entrar a una ruta protegida, es decir, se necesita un token valido para acceder
const { authenticateToken } = require("./middleware/authorization.js");

//Importacion de las rutas principales en variables
const authRoutes = require("./routes/auth_routes.js");
const userRoutes = require("./routes/user_routes.js");
const preguntasRoutes = require("./routes/preguntas_routes.js");

//config entorno
dotenv.config();

//Configurar el puerto donde se abre la API
const app = express();
const PORT = 4099;

//direccion donde se abre
const corsOptions = { origin: true, credentials: true };

//configuracion del server
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookie_parser());

//Rutas publicas
app.use("/auth", authRoutes);

//Rutas protegidas por el token
app.use("/usuario", userRoutes);

// Rutas de preguntas
app.use("/preguntas", preguntasRoutes);

// Ruta publica para imagenes
app.use("/img", express.static(path.join(__dirname, "assets/img")));

//Iniciar la API
app.listen(PORT, () => console.log("Server listener: http://localhost:" + PORT));
