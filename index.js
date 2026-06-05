const express = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(cors());

// 1. Catálogo Maestro de Colaboradores
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
// Modificado para que en local use directamente tu archivo key.json
let serviceAccountAuth;

try {
  // Intentamos cargar el archivo key.json que se ve en tu carpeta backend
  const keyJsonPath = path.join(__dirname, "key.json");
  const creds = require(keyJsonPath);

  serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  console.log("🔒 Autenticación configurada usando key.json local");
} catch (e) {
  // Si no existe key.json (como en producción en Render), usa el .env
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

// 3. CONEXIÓN AL DOCUMENTO
const doc = new GoogleSpreadsheet(
  process.env.SPREADSHEET_ID,
  serviceAccountAuth,
);

// 4. RUTA PARA OBTENER EL RANKING PROCESADO (CON FILTRO MENSUAL)
app.get("/ranking", async (req, res) => {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const ventasPorAgente = {};

    // Obtener mes y año actual
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    rows.forEach((row) => {
      const fechaString = row.get("Marca temporal");
      if (!fechaString) return;

      const fechaRegistro = new Date(fechaString);

      // --- FILTRO MENSUAL ---
      if (
        fechaRegistro.getMonth() !== mesActual ||
        fechaRegistro.getFullYear() !== anioActual
      ) {
        return;
      }

      const rawId = row.get("Ingresa tu número de agente");
      if (!rawId) return;

      const agenteId = rawId.toUpperCase().trim();
      const retornoStatus = (row.get("¿Regreso el cliente?") || "").trim();

      if (!ventasPorAgente[agenteId]) {
        ventasPorAgente[agenteId] = { boletos: 0, retornos: 0 };
      }

      ventasPorAgente[agenteId].boletos += 1;

      if (retornoStatus.toLowerCase() === "si") {
        ventasPorAgente[agenteId].retornos += 1;
      }
    });

    // --- CRUCE CON LA LISTA MAESTRA ---
    const rankingFinal = colaboradoresMaster.map((colab) => {
      const statsEnExcel = ventasPorAgente[colab.id.toUpperCase()];

      return {
        id: colab.id,
        nombreReal: colab.nombre,
        boletos: statsEnExcel ? statsEnExcel.boletos : 0,
        retornos: statsEnExcel ? statsEnExcel.retornos : 0,
      };
    });

    rankingFinal.sort((a, b) => b.retornos - a.retornos);

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
