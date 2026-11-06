# Hechas a su Imagen 2026 · Landing de registradas

Página estática que muestra en tiempo real las mujeres registradas al congreso
(*Restaurando el Diseño*). Lee el Google Sheet de respuestas del formulario cada 15 s.

- **El número de celular nunca se publica**: el Apps Script solo envía nombre, estado civil, si se congrega, iglesia y canal.
- Sin `DATA_URL` configurada, la página corre en **modo demo** con datos de ejemplo.

## Conectar con el Google Sheet

1. Abre el Google Sheet de respuestas → **Extensiones → Apps Script**.
2. Borra el contenido y pega `apps-script/Code.gs`. Guarda.
3. **Implementar → Nueva implementación → Tipo: Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
4. Autoriza y copia la URL que termina en `/exec`.
5. Pégala en `config.js` → `DATA_URL`.

Si cambias el script, crea una **nueva versión** de la implementación (Administrar implementaciones → Editar → Nueva versión) para que se aplique.

## Publicar

Es HTML estático: GitHub Pages (Settings → Pages → rama → `/root`), Netlify o Vercel.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Colores y tipografías del flyer (Playfair Display + Outfit) |
| `app.js` | Consulta, estadísticas, buscador, animaciones de nuevos registros |
| `config.js` | URL de datos, intervalo de refresco, formato del nombre |
| `apps-script/Code.gs` | API JSON desde el Sheet (sin celulares) |
