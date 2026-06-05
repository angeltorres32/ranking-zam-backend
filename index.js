const express = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
// Permitimos CORS para que el frontend local y de producción puedan consultar la API
app.use(cors());

// 1. Catálogo Maestro de Colaboradores (Los 17 del CEDIS)
const colaboradoresMaster = [
  { id: "104CGP", nombre: "Cristina Garcia Pineda" },
  { id: "113MCM", nombre: "Marisa Cortes Merino" },
  { id: "103MCV", nombre: "Michell Contreras Vazquez" },
  { id: "102RGJ", nombre: "Madian Rubi Gonzalez Juarez" },
  { id: "130LCM", nombre: "Lorena Cortez Merino" },
  { id: "207ASS", nombre: "Adriana Sarmiento" },
  { id: "202LMP", nombre: "Leticia Moreno Pacheco" },
  { id: "887MJCC", nombre: "Maria Jose Coello Coello" },
  { id: "101MHA", nombre: "Maria Fernanda Hernandez Aguilar" },
  { id: "110KDH", nombre: "Karen Denise Hernandez Coello" },
  { id: "126MGMM", nombre: "Monica Guadalupe Moraleno Medrano" },
  { id: "764SST", nombre: "Sandra Sanchez Torres" },
  { id: "899JDNA", nombre: "Juan Diego Napoles Ancelmo" },
  { id: "201EOP", nombre: "Emmanuel Orduña Pacheco" },
  { id: "105MCM", nombre: "Mariana Contreras Merino" },
  { id: "203DMA", nombre: "Diana Mendoza Antonio" },
  { id: "116MAJZ", nombre: "Maria de los Angeles Jimenez Zaragoza" },
];

// 2. CONFIGURACIÓN DE AUTENTICACIÓN GOOGLE
let serviceAccountAuth;

try {
  // Intentamos usar el archivo key.json si existe en el entorno local
  const keyJsonPath = path.join(__dirname, "key.json");
  const creds = require(keyJsonPath);

  serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  console.log("🔒 Autenticación configurada usando key.json local");
} catch (e) {
  // Respaldo para cuando esté en producción (Render) usando las variables de entorno
  serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  console.log(
    "☁️ Autenticación configurada usando variables de entorno (.env)",
  );
}

// 3. CONEXIÓN AL DOCUMENTO GOOGLE SHEET
const doc = new GoogleSpreadsheet(
  process.env.SPREADSHEET_ID,
  serviceAccountAuth,
);

// 4. RUTA PARA OBTENER EL RANKING PROCESADO (CON FILTRO MENSUAL SEGURO)
app.get("/ranking", async (req, res) => {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const ventasPorAgente = {};

    // Obtener mes y año actual del servidor
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    // Ajustamos el mes de JavaScript (0-11) al mes natural del Excel (1-12)
    // Ejemplo: Junio en JS es 5, así que sumamos 1 para compararlo con el '6' del Excel
    const mesActualHumano = mesActual + 1;

    rows.forEach((row) => {
      const fechaString = row.get("Marca temporal");
      if (!fechaString) return;

      // --- ESTRATEGIA DE EXTRACCIÓN DETALLADA POR DIAGONALES ---
      const partesFecha = fechaString.split("/");
      if (!partesFecha || partesFecha.length < 3) return;

      // partesFecha[1] contiene siempre el mes (ej: "06" o "6")
      const mesRegistro = parseInt(partesFecha[1], 10);

      // partesFecha[2] contiene el año seguido de la hora (ej: "2026 13:53:03")
      // Cortamos los primeros 4 caracteres para extraer limpiamente el año numérico
      const anioRegistro = parseInt(partesFecha[2].trim().substring(0, 4), 10);

      // --- FILTRO ROBUSTO ---
      // Comparamos el mes y año extraídos directamente contra el mes actual en curso
      if (mesRegistro !== mesActualHumano || anioRegistro !== anioActual) {
        return; // Ignora por completo las filas que no correspondan a este mes
      }

      // Si pasa el filtro mensual, procesamos los datos del agente
      const rawId = row.get("Ingresa tu número de agente");
      if (!rawId) return;

      const agenteId = rawId.toUpperCase().trim();
      const retornoStatus = (row.get("¿Regreso el cliente?") || "").trim();

      if (!ventasPorAgente[agenteId]) {
        ventasPorAgente[agenteId] = { boletos: 0, retornos: 0 };
      }

      // Sumamos 1 boleto por cada registro/fila encontrada
      ventasPorAgente[agenteId].boletos += 1;

      // Sumamos 1 retorno si la columna marca explícitamente que "Si" regresó
      if (retornoStatus.toLowerCase() === "si") {
        ventasPorAgente[agenteId].retornos += 1;
      }
    });

    // --- CRUCE CON EL CATÁLOGO MAESTRO (MERGE) ---
    // Mapeamos sobre los 17 colaboradores para asegurar que todos figuren con datos o en 0
    const rankingFinal = colaboradoresMaster.map((colab) => {
      const statsEnExcel = ventasPorAgente[colab.id.toUpperCase()];

      return {
        id: colab.id,
        nombreReal: colab.nombre,
        boletos: statsEnExcel ? statsEnExcel.boletos : 0,
        retornos: statsEnExcel ? statsEnExcel.retornos : 0,
      };
    });

    // --- ORDENAMIENTO DE LAS TARJETAS ---
    rankingFinal.sort((a, b) => b.retornos - a.retornos);

    // Mandamos el array estructurado al Frontend
    res.json(rankingFinal);
  } catch (error) {
    console.error("Error al procesar el ranking de Ana María:", error);
    res.status(500).json({ error: "Error interno al obtener datos del CEDIS" });
  }
});

// 5. INICIO DEL SERVIDOR
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor de Zapaterías Ana María corriendo en puerto ${PORT}`);
});
