const express = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const cors = require("cors");
require("dotenv").config();

const app = express();
// IMPORTANTE: Permitimos CORS para que Vercel pueda leer los datos
app.use(cors());

// 1. Catálogo Maestro de Colaboradores (Para asegurar que aparezcan los 17 con 0 si no han vendido)
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

// 2. CONFIGURACIÓN DE AUTENTICACIÓN GOOGLE (Vía Variables de Render)
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// 3. CONEXIÓN AL DOCUMENTO
const doc = new GoogleSpreadsheet(
  process.env.SPREADSHEET_ID,
  serviceAccountAuth,
);

// 4. RUTA PARA OBTENER EL RANKING PROCESADO
app.get("/ranking", async (req, res) => {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // Asegúrate de que sea la pestaña correcta (la 0)
    const rows = await sheet.getRows();

    // --- AQUÍ ESTÁ LA MAGIA DE LA PROGRAMACIÓN (EL PROCESAMIENTO) ---
    // Usaremos un objeto para ir acumulando las ventas
    const ventasPorAgente = {};

    rows.forEach((row) => {
      // Obtenemos el ID de la columna larga y lo normalizamos a mayúsculas
      const rawId = row.get("Ingresa tu número de agente");
      if (!rawId) return; // Saltamos filas vacías

      const agenteId = rawId.toUpperCase().trim();

      // Obtenemos el valor de la columna de retorno ("Si" o "No")
      const retornoStatus = (row.get("¿Regreso el cliente?") || "").trim();

      // Si es la primera vez que vemos a este agente, lo inicializamos en 0
      if (!ventasPorAgente[agenteId]) {
        ventasPorAgente[agenteId] = { boletos: 0, retornos: 0 };
      }

      // Conteo de Boletos (Cada fila es una venta, o sea, un boleto)
      ventasPorAgente[agenteId].boletos += 1;

      // Conteo de Retornos (Solo sumamos 1 si la columna dice "Si")
      if (retornoStatus.toLowerCase() === "si") {
        ventasPorAgente[agenteId].retornos += 1;
      }
    });

    // --- CRUCE CON LA LISTA MAESTRA (MERGE) ---
    // Esto asegura que salgan los 17 colaboradores, tengan ventas o no
    const rankingFinal = colaboradoresMaster.map((colab) => {
      // Buscamos si el colaborador máster tiene ventas registradas en el Excel
      const statsEnExcel = ventasPorAgente[colab.id.toUpperCase()];

      return {
        id: colab.id,
        nombreReal: colab.nombre,
        // Si no tiene ventas, le ponemos 0
        boletos: statsEnExcel ? statsEnExcel.boletos : 0,
        retornos: statsEnExcel ? statsEnExcel.retornos : 0,
      };
    });

    // --- ORDENAMIENTO (De mayor a menor retornos) ---
    rankingFinal.sort((a, b) => b.retornos - a.retornos);

    // Enviamos el resultado procesado al Frontend
    res.json(rankingFinal);
  } catch (error) {
    console.error("Error al procesar el ranking de Ana María:", error);
    res.status(500).json({ error: "Error interno al obtener datos del CEDIS" });
  }
});

// 5. INICIO DEL SERVIDOR
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(
    `Servidor de Zapaterías Ana María procesando datos en puerto ${PORT}`,
  );
});
