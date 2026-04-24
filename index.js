const express = require("express");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());

// Cargar credenciales
const serviceAccountAuth = new JWT({
  // Jalamos los datos directamente de las variables de Render
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  // Este replace es clave para que Render lea bien los saltos de línea de la llave
  key: process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(
  process.env.SPREADSHEET_ID,
  serviceAccountAuth,
);
const serviceAccountAuth = new JWT({
  email: creds.client_email,
  key: creds.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(
  process.env.SPREADSHEET_ID,
  serviceAccountAuth,
);

app.get("/ranking", async (req, res) => {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const ranking = {};

    rows.forEach((row) => {
      const agente = row
        .get("Ingresa tu número de agente")
        ?.toUpperCase()
        .trim();
      const regreso = row.get("¿Regreso el cliente?")?.trim();

      if (agente) {
        if (!ranking[agente]) {
          ranking[agente] = { retornos: 0, boletos: 0 };
        }

        // CADA FILA ES UN BOLETO ENTREGADO
        ranking[agente].boletos += 1;

        // SI REGRESÓ, SUMAMOS RETORNO
        if (regreso === "Si") {
          ranking[agente].retornos += 1;
        }
      }
    });

    // Convertir objeto a Array y ordenar por retornos
    const finalData = Object.entries(ranking)
      .map(([nombre, data]) => ({
        nombre,
        retornos: data.retornos,
        boletos: data.boletos,
      }))
      .sort((a, b) => b.retornos - a.retornos);

    console.log("Backend enviando:", finalData); // Ver en terminal de node
    res.json(finalData);
  } catch (error) {
    console.error("ERROR EN BACKEND:", error);
    res.status(500).json({ error: "Error al leer datos" });
  }
});

app.listen(5000, () =>
  console.log("🚀 Backend activo en http://localhost:5000"),
);
