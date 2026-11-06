# Hechas a su Imagen 2026 · Landing de registradas

Página estática que muestra en tiempo real las mujeres registradas al congreso
(*Restaurando el Diseño*). Usa **consulta en espera** contra un Apps Script del Google Sheet:
la página pregunta, el script espera hasta que llega un registro del formulario y responde
al instante (1–2 s). Sin bases de datos ni servicios externos.

- **El número de celular nunca se publica**: el Apps Script solo envía nombre, estado civil, si se congrega, iglesia y canal.
- Sin `DATA_URL` configurada, la página corre en **modo demo** con datos de ejemplo.

## Conectar con el Google Sheet

1. Abre el Google Sheet de respuestas → **Extensiones → Apps Script**.
2. Borra el contenido y pega `apps-script/Code.gs`. Guarda.
3. En la barra superior elige la función **`instalar`** y pulsa **▶ Ejecutar**. Acepta los permisos.
   Esto crea el disparador que avisa cada vez que llega una respuesta (o editas el Sheet).
4. **Implementar → Nueva implementación → Tipo: Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
5. Autoriza y copia la URL que termina en `/exec`.
6. Pégala en `config.js` → `DATA_URL`.

Si cambias el script, crea una **nueva versión** de la implementación (Administrar implementaciones → Editar → Nueva versión) para que se aplique.

## Límite a tener en cuenta

Cada persona con la página abierta ocupa una ejecución del script mientras espera.
Google permite alrededor de **30 ejecuciones simultáneas por cuenta** (confírmalo en
las cuotas oficiales de Apps Script). Ideal para una pantalla en el congreso y el equipo;
no para compartir el enlace masivamente. Si se supera, la página muestra
"Reconectando…" y reintenta sola. Las pestañas en segundo plano no ocupan ejecución.

## Publicar

Es HTML estático: GitHub Pages (Settings → Pages → rama → `/root`), Netlify o Vercel.

## Archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Estructura de la página |
| `styles.css` | Colores y tipografías del flyer (Playfair Display + Outfit) |
| `app.js` | Consulta en espera, estadísticas, buscador, animaciones de nuevos registros |
| `config.js` | URL del Apps Script y formato del nombre |
| `apps-script/Code.gs` | API con consulta en espera + disparador del formulario (sin celulares) |
