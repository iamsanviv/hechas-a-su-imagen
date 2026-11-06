/**
 * Hechas a su Imagen 2026 — API de registradas con "consulta en espera".
 *
 * Cómo funciona:
 *  - La página pregunta: "¿hay algo nuevo desde la versión X?".
 *  - Si no hay nada nuevo, el script ESPERA (hasta ~25 s) sin responder.
 *  - Cuando llega un registro del formulario, el disparador `marcarCambio`
 *    cambia la versión, el script responde de inmediato con la lista y la
 *    página la muestra en 1–2 segundos.
 *
 * Instalación (una sola vez):
 *  1. Pega este código en Extensiones → Apps Script del Google Sheet de respuestas.
 *  2. Elige la función `instalar` en la barra superior y pulsa ▶ Ejecutar. Acepta los permisos.
 *  3. Implementar → Nueva implementación → Aplicación web
 *     (Ejecutar como: Yo · Quién tiene acceso: Cualquier persona).
 *
 * Incluye el número de celular: cualquiera con el enlace de la página lo ve.
 * Columnas esperadas (orden del formulario):
 *   A Marca temporal | B Nombres y apellidos | C Número de celular |
 *   D Estado civil   | E ¿Te congregas?      | F ¿En dónde?         | G ¿Cómo te enteraste?
 */

// Nombre de la pestaña de respuestas. Vacío = primera pestaña.
const SHEET_NAME = '';

// Tiempo máximo que el script espera un registro nuevo antes de responder "sin cambios".
const ESPERA_MAX_MS = 25000;
// Cada cuánto revisa (internamente, sin tocar el Sheet) si llegó algo.
const REVISION_MS = 1000;

/* ---------------- API pública ---------------- */

function doGet(e) {
  const since = (e && e.parameter && e.parameter.since) || '';
  let version = leerVersion();

  // La página ya tiene la última versión → esperar a que llegue algo nuevo.
  if (since && since === version) {
    const fin = Date.now() + ESPERA_MAX_MS;
    while (Date.now() < fin) {
      Utilities.sleep(REVISION_MS);
      version = leerVersion();
      if (version !== since) break;
    }
    if (version === since) return json({ cambio: false, version: version });
  }

  // La versión se lee ANTES que los datos: si entra un registro justo ahora,
  // la próxima consulta lo detecta y no se pierde.
  const registros = leerRegistros();
  return json({
    cambio: true,
    version: version,
    actualizado: new Date().toISOString(),
    total: registros.length,
    registros: registros
  });
}

/* ---------------- Disparadores ---------------- */

// Se ejecuta solo cada vez que llega una respuesta del formulario
// o cuando se edita/borra una fila a mano en el Sheet.
function marcarCambio() {
  const v = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('version', v);
  CacheService.getScriptCache().put('version', v, 21600);
}

// Ejecutar UNA vez a mano para crear los disparadores.
function instalar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'marcarCambio') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('marcarCambio').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('marcarCambio').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('marcarCambio').forSpreadsheet(ss).onEdit().create();
  marcarCambio();
}

/* ---------------- Auxiliares ---------------- */

function leerVersion() {
  const cache = CacheService.getScriptCache();
  let v = cache.get('version');
  if (v) return v;
  v = PropertiesService.getScriptProperties().getProperty('version') || '0';
  cache.put('version', v, 21600);
  return v;
}

function leerRegistros() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  return sheet.getDataRange().getValues().slice(1)
    .filter(function (r) { return String(r[1]).trim() !== ''; })
    .map(function (r) {
      return {
        t: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
        nombre: String(r[1]).trim(),
        celular: String(r[2]).trim(),
        estadoCivil: String(r[3]).trim(),
        congrega: String(r[4]).trim(),
        iglesia: String(r[5]).trim(),
        canal: String(r[6]).trim()
      };
    });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
