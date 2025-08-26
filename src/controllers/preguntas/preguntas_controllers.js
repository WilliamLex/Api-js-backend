const pool = require("../../database/db");

const getListPreguntas = async (req, res, next) => {
  try {
    const preguntas = await pool.query("SELECT * FROM fu_listar_preguntas()");
    return res.json(preguntas.rows);
  } catch (error) {
    next(error);
  }
};

const getListOpciones = async (req, res, next) => {
  try {
    const { id_pregunta } = req.params;
    const opciones = await pool.query("SELECT * FROM fu_listar_opciones($1)", [id_pregunta]);
    return res.json(opciones.rows);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getListPreguntas,
  getListOpciones,
};
