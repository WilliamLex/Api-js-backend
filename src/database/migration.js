const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Configuración de la base de datos
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Colores para la consola
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Función principal de migración
async function migratePasswords() {
  let client;

  try {
    console.log(colors.cyan + "========================================" + colors.reset);
    console.log(colors.bright + "MIGRACIÓN DE CONTRASEÑAS A BCRYPT" + colors.reset);
    console.log(colors.cyan + "========================================\n" + colors.reset);

    // Conectar a la base de datos
    client = await pool.connect();

    // PASO 1: Verificar el estado actual
    console.log(colors.yellow + "📊 Verificando estado actual de la base de datos..." + colors.reset);

    const checkQuery = `
      SELECT 
        COUNT(*) as total_usuarios,
        COUNT(CASE WHEN LENGTH(contrasena) < 60 THEN 1 END) as sin_encriptar,
        COUNT(CASE WHEN LENGTH(contrasena) >= 60 THEN 1 END) as ya_encriptadas
      FROM usuarios
      WHERE activo = true
    `;

    const statusResult = await client.query(checkQuery);
    const status = statusResult.rows[0];

    console.log(`   Total de usuarios activos: ${colors.bright}${status.total_usuarios}${colors.reset}`);
    console.log(`   Contraseñas sin encriptar: ${colors.red}${status.sin_encriptar}${colors.reset}`);
    console.log(`   Contraseñas ya encriptadas: ${colors.green}${status.ya_encriptadas}${colors.reset}\n`);

    if (status.sin_encriptar === "0") {
      console.log(
        colors.green + "✅ Todas las contraseñas ya están encriptadas. No hay nada que migrar.\n" + colors.reset
      );
      return;
    }

    // PASO 2: Crear tabla de respaldo
    console.log(colors.yellow + "🔒 Creando tabla de respaldo..." + colors.reset);

    const backupTableName = `usuarios_backup_${new Date().toISOString().slice(0, 10).replace(/-/g, "_")}`;

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${backupTableName} AS 
      SELECT * FROM usuarios
    `);

    console.log(`   Tabla de respaldo creada: ${colors.green}${backupTableName}${colors.reset}\n`);

    // PASO 3: Actualizar el tamaño de la columna si es necesario
    console.log(colors.yellow + "📏 Verificando tamaño de columna contrasena..." + colors.reset);

    const columnCheck = await client.query(`
      SELECT character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'usuarios' 
      AND column_name = 'contrasena'
    `);

    const currentLength = columnCheck.rows[0].character_maximum_length;

    if (currentLength < 100) {
      console.log(`   Ampliando columna de ${currentLength} a 100 caracteres...`);
      await client.query(`
        ALTER TABLE usuarios 
        ALTER COLUMN contrasena TYPE VARCHAR(100)
      `);
      console.log(`   ${colors.green}✓ Columna actualizada${colors.reset}\n`);
    } else {
      console.log(`   ${colors.green}✓ Tamaño de columna adecuado (${currentLength} caracteres)${colors.reset}\n`);
    }

    // PASO 4: Obtener usuarios con contraseñas sin encriptar
    console.log(colors.yellow + "🔐 Iniciando encriptación de contraseñas..." + colors.reset);

    const usersQuery = `
      SELECT id_usuario, identificador, correo, contrasena 
      FROM usuarios 
      WHERE LENGTH(contrasena) < 60 
      AND activo = true
      ORDER BY id_usuario
    `;

    const users = await client.query(usersQuery);

    // PASO 5: Encriptar contraseñas
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const saltRounds = 10;

    // Barra de progreso
    const totalUsers = users.rows.length;

    for (let i = 0; i < totalUsers; i++) {
      const user = users.rows[i];

      try {
        // Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(user.contrasena, saltRounds);

        // Actualizar en la base de datos
        await client.query("UPDATE usuarios SET contrasena = $1 WHERE id_usuario = $2", [
          hashedPassword,
          user.id_usuario,
        ]);

        successCount++;

        // Mostrar progreso
        const progress = Math.round(((i + 1) / totalUsers) * 100);
        process.stdout.write(
          `\r   Progreso: [${colors.green}${"█".repeat(Math.floor(progress / 2))}${colors.reset}${" ".repeat(
            50 - Math.floor(progress / 2)
          )}] ${progress}% (${i + 1}/${totalUsers})`
        );
      } catch (error) {
        errorCount++;
        errors.push({
          id: user.id_usuario,
          correo: user.correo,
          error: error.message,
        });
      }
    }

    console.log("\n");

    // PASO 6: Mostrar resultados
    console.log(colors.cyan + "========================================" + colors.reset);
    console.log(colors.bright + "RESULTADOS DE LA MIGRACIÓN" + colors.reset);
    console.log(colors.cyan + "========================================" + colors.reset);

    console.log(`${colors.green}✅ Contraseñas encriptadas exitosamente: ${successCount}${colors.reset}`);

    if (errorCount > 0) {
      console.log(`${colors.red}❌ Errores durante la migración: ${errorCount}${colors.reset}`);
      console.log("\nDetalles de errores:");
      errors.forEach((err) => {
        console.log(`   - Usuario ID ${err.id} (${err.correo}): ${err.error}`);
      });
    }

    // PASO 7: Verificación final
    console.log(colors.yellow + "\n🔍 Verificación final..." + colors.reset);

    const finalCheck = await client.query(`
      SELECT 
        COUNT(CASE WHEN LENGTH(contrasena) < 60 THEN 1 END) as sin_encriptar,
        COUNT(CASE WHEN LENGTH(contrasena) >= 60 THEN 1 END) as encriptadas
      FROM usuarios
      WHERE activo = true
    `);

    const finalStatus = finalCheck.rows[0];
    console.log(`   Contraseñas sin encriptar: ${finalStatus.sin_encriptar}`);
    console.log(`   Contraseñas encriptadas: ${finalStatus.encriptadas}`);

    if (finalStatus.sin_encriptar === "0") {
      console.log(colors.green + "\n✅ ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!" + colors.reset);
      console.log(`\n📌 Tabla de respaldo disponible: ${colors.cyan}${backupTableName}${colors.reset}`);
      console.log(`   Para restaurar en caso de problemas:`);
      console.log(
        `   ${colors.yellow}DROP TABLE usuarios; ALTER TABLE ${backupTableName} RENAME TO usuarios;${colors.reset}\n`
      );
    } else {
      console.log(colors.red + "\n⚠️ La migración se completó pero aún hay contraseñas sin encriptar." + colors.reset);
      console.log("   Revisa los errores anteriores y ejecuta el script nuevamente si es necesario.\n");
    }
  } catch (error) {
    console.error(colors.red + "\n❌ ERROR CRÍTICO durante la migración:" + colors.reset);
    console.error(error);
    console.log(
      colors.yellow +
        "\n⚠️ La migración fue interrumpida. Los datos originales están en la tabla de respaldo." +
        colors.reset
    );
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Script de verificación (opcional)
async function verifyPasswords() {
  let client;

  try {
    console.log(colors.cyan + "\n🔍 VERIFICACIÓN DE CONTRASEÑAS ENCRIPTADAS\n" + colors.reset);

    client = await pool.connect();

    // Obtener una muestra de usuarios
    const sampleUsers = await client.query(`
      SELECT id_usuario, correo, contrasena 
      FROM usuarios 
      WHERE LENGTH(contrasena) >= 60 
      AND activo = true
      LIMIT 5
    `);

    console.log("Verificando muestra de usuarios encriptados:");

    for (const user of sampleUsers.rows) {
      // Aquí podrías verificar con una contraseña de prueba conocida
      console.log(`   ✓ Usuario ${user.correo}: Hash ${user.contrasena.substring(0, 20)}...`);
    }
  } catch (error) {
    console.error(colors.red + "Error en verificación:" + colors.reset, error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Función para restaurar desde backup
async function restoreFromBackup(backupTableName) {
  let client;

  try {
    console.log(colors.yellow + `\n⚠️ RESTAURANDO DESDE ${backupTableName}...\n` + colors.reset);

    client = await pool.connect();

    // Iniciar transacción
    await client.query("BEGIN");

    // Eliminar tabla actual
    await client.query("DROP TABLE IF EXISTS usuarios CASCADE");

    // Renombrar tabla de backup
    await client.query(`ALTER TABLE ${backupTableName} RENAME TO usuarios`);

    // Confirmar transacción
    await client.query("COMMIT");

    console.log(colors.green + "✅ Restauración completada exitosamente\n" + colors.reset);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(colors.red + "Error en restauración:" + colors.reset, error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Menú principal
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.clear();

  switch (command) {
    case "migrate":
      await migratePasswords();
      break;

    case "verify":
      await verifyPasswords();
      break;

    case "restore":
      const backupTable = args[1];
      if (!backupTable) {
        console.log(colors.red + "Error: Debes especificar el nombre de la tabla de backup" + colors.reset);
        console.log("Uso: node migrate-passwords.js restore [nombre_tabla_backup]");
      } else {
        await restoreFromBackup(backupTable);
      }
      break;

    default:
      console.log(colors.bright + "SCRIPT DE MIGRACIÓN DE CONTRASEÑAS\n" + colors.reset);
      console.log("Uso:");
      console.log("  node migrate-passwords.js migrate   - Encripta todas las contraseñas");
      console.log("  node migrate-passwords.js verify    - Verifica contraseñas encriptadas");
      console.log("  node migrate-passwords.js restore [tabla] - Restaura desde backup\n");
      console.log(
        colors.yellow + "⚠️ IMPORTANTE: Haz un backup de tu base de datos antes de ejecutar la migración" + colors.reset
      );
  }
}

// Ejecutar script
main().catch(console.error);
