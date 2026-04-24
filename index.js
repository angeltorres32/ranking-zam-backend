const express = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

// 1. CONFIGURACIÓN DE AUTENTICACIÓN
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// 2. CONEXIÓN AL DOCUMENTO (SOLO UNA VEZ)
const doc = new GoogleSpreadsheet(
  process.env.SPREADSHEET_ID,
  serviceAccountAuth,
);

// 3. RUTA PARA EL RANKING
app.get("/ranking", async (req, res) => {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const data = rows.map((row) => ({
      // Usamos row.get() para mayor compatibilidad con la librería
      nombre: row.get("Nombre") || row.get("ID") || "Sin Nombre",
      retornos: parseInt(row.get("Retornos") || 0),
      boletos: parseInt(row.get("Boletos") || 0),
    }));

    res.json(data);
  } catch (error) {
    console.error("Error en el ranking:", error);
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

// 4. INICIO DEL SERVIDOR
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor de Zapaterías Ana María listo en puerto ${PORT}`);
});
