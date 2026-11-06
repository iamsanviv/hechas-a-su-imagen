/**
 * Hechas a su Imagen 2026 — Registradas y asistencia en tiempo real.
 *
 * - Lee las respuestas del formulario y las entrega a la landing con
 *   "consulta en espera" (responde apenas hay un cambio).
 * - Guarda la asistencia en la pestaña "Asistencia" (la crea sola):
 *   una fila por marca → ID registro | Nombre | Celular | Día | Fecha y hora.
 *
 * Instalación: pegar, guardar, ejecutar `instalar` una vez y publicar
 * como Aplicación web (Ejecutar como: Yo · Acceso: Cualquier persona).
 *
 * Columnas del formulario:
 *   A Marca temporal | B Nombres y apellidos | C Número de celular |
 *   D Estado civil   | E ¿Te congregas?      | F ¿En dónde?         | G ¿Cómo te enteraste?
 */

// Pestaña de respuestas. Vacío = la pestaña vinculada al formulario (o la primera).
const SHEET_NAME = '';
const HOJA_ASISTENCIA = 'Asistencia';
const DIAS = ['Viernes', 'Sábado', 'Domingo'];
const ZONA = 'America/Bogota';

const ESPERA_MAX_MS = 25000;
const REVISION_MS = 1000;

/* ---------------- API ---------------- */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.accion === 'marcar' || p.accion === 'desmarcar') return json(cambiarAsistencia(p));

  const since = p.since || '';
  let version = leerVersion();
  if (since && since === version) {
    const fin = Date.now() + ESPERA_MAX_MS;
    while (Date.now() < fin) {
      Utilities.sleep(REVISION_MS);
      version = leerVersion();
      if (version !== since) break;
    }
    if (version === since) return json({ cambio: false, version: version });
  }

  // La versión se lee ANTES que los datos: si entra un cambio justo ahora,
  // la próxima consulta lo detecta y no se pierde.
  const registros = leerRegistros();
  return json({
    cambio: true,
    version: version,
    actualizado: new Date().toISOString(),
    total: registros.length,
    registros: registros,
    asistencia: leerAsistencia()
  });
}

/* ---------------- Asistencia ---------------- */

function cambiarAsistencia(p) {
  const id = String(p.id || '');
  const dia = String(p.dia || '');
  if (!id || DIAS.indexOf(dia) === -1) return { ok: false, error: 'datos inválidos' };

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const hoja = hojaAsistencia();
    const datos = hoja.getDataRange().getValues();
    let fila = -1;
    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][0]) === id && String(datos[i][3]) === dia) { fila = i + 1; break; }
    }

    if (p.accion === 'marcar' && fila === -1) {
      const reg = leerRegistros().filter(function (r) { return r.id === id; })[0];
      if (!reg) return { ok: false, error: 'registro no encontrado' };
      hoja.appendRow([id, reg.nombre, reg.celular, dia, new Date()]);
    } else if (p.accion === 'desmarcar' && fila !== -1) {
      hoja.deleteRow(fila);
    }
    SpreadsheetApp.flush();
    marcarCambio();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function hojaAsistencia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_ASISTENCIA);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_ASISTENCIA, ss.getSheets().length);
    hoja.appendRow(['ID registro', 'Nombre', 'Celular', 'Día', 'Fecha y hora']);
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('@');
    hoja.getRange('C:C').setNumberFormat('@');
  }
  return hoja;
}

function leerAsistencia() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_ASISTENCIA);
  if (!hoja) return [];
  return hoja.getDataRange().getValues().slice(1)
    .filter(function (r) { return String(r[0]) !== '' && DIAS.indexOf(String(r[3])) !== -1; })
    .map(function (r) {
      return {
        id: String(r[0]),
        dia: String(r[3]),
        hora: r[4] instanceof Date ? Utilities.formatDate(r[4], ZONA, 'h:mm a') : String(r[4])
      };
    });
}

/* ---------------- Registros ---------------- */

function hojaRespuestas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (SHEET_NAME) return ss.getSheetByName(SHEET_NAME);
  const hojas = ss.getSheets();
  for (let i = 0; i < hojas.length; i++) if (hojas[i].getFormUrl()) return hojas[i];
  return hojas[0];
}

function leerRegistros() {
  return hojaRespuestas().getDataRange().getValues().slice(1)
    .filter(function (r) { return String(r[1]).trim() !== ''; })
    .map(function (r) {
      const nombre = String(r[1]).trim();
      const marca = r[0] instanceof Date ? r[0] : null;
      return {
        // ID estable de la registrada: marca temporal + nombre.
        id: (marca ? String(marca.getTime()) : String(r[0])) + '|' + nombre,
        t: marca ? marca.toISOString() : String(r[0]),
        nombre: nombre,
        celular: String(r[2]).trim(),
        estadoCivil: String(r[3]).trim(),
        congrega: String(r[4]).trim(),
        iglesia: String(r[5]).trim(),
        canal: String(r[6]).trim()
      };
    });
}

/* ---------------- Disparadores y versión ---------------- */

// Se ejecuta con cada respuesta del formulario, con ediciones a mano en el
// Sheet y después de cada marca de asistencia.
function marcarCambio() {
  const v = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('version', v);
  CacheService.getScriptCache().put('version', v, 21600);
}

// Ejecutar UNA vez a mano para crear los disparadores y la pestaña Asistencia.
function instalar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'marcarCambio') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('marcarCambio').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('marcarCambio').forSpreadsheet(ss).onChange().create();
  ScriptApp.newTrigger('marcarCambio').forSpreadsheet(ss).onEdit().create();
  hojaAsistencia();
  marcarCambio();
}

function leerVersion() {
  const cache = CacheService.getScriptCache();
  let v = cache.get('version');
  if (v) return v;
  v = PropertiesService.getScriptProperties().getProperty('version') || '0';
  cache.put('version', v, 21600);
  return v;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
