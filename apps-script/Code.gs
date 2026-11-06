/**
 * Hechas a su Imagen 2026 — API de registradas.
 *
 * Pega este código en el Apps Script vinculado al Google Sheet de respuestas
 * (Hoja de cálculo → Extensiones → Apps Script) y publícalo como Aplicación web.
 *
 * IMPORTANTE: el número de celular NUNCA se envía a la página pública.
 * Columnas esperadas (orden del formulario):
 *   A Marca temporal | B Nombres y apellidos | C Número de celular |
 *   D Estado civil   | E ¿Te congregas?      | F ¿En dónde?         | G ¿Cómo te enteraste?
 */

// Nombre de la pestaña de respuestas. Vacío = primera pestaña.
const SHEET_NAME = '';

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  const values = sheet.getDataRange().getValues();

  const registros = values.slice(1)
    .filter(function (r) { return String(r[1]).trim() !== ''; })
    .map(function (r) {
      return {
        t: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
        nombre: String(r[1]).trim(),
        // r[2] = celular → se omite a propósito
        estadoCivil: String(r[3]).trim(),
        congrega: String(r[4]).trim(),
        iglesia: String(r[5]).trim(),
        canal: String(r[6]).trim()
      };
    });

  const body = {
    actualizado: new Date().toISOString(),
    total: registros.length,
    registros: registros
  };

  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
