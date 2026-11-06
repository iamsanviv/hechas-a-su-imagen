(function () {
  "use strict";

  var CFG = window.HASI_CONFIG || {};
  var DEMO = !CFG.DATA_URL;

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    total: $("total"), today: $("todayText"), live: $("live"), liveText: $("liveText"),
    statToday: $("statToday"), statCongrega: $("statCongrega"), statIglesias: $("statIglesias"),
    barsCanal: $("barsCanal"), barsCivil: $("barsCivil"),
    grid: $("grid"), empty: $("empty"), search: $("search"), toast: $("toast")
  };

  var registros = [];          // más reciente primero
  var known = null;            // Set de claves ya vistas (null = primera carga)
  var version = "";            // última versión recibida del Apps Script
  var inFlight = false, fails = 0;
  var shownTotal = 0;

  /* ---------- utilidades ---------- */
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function titleCase(s) {
    return clean(s).toLowerCase().replace(/(^|\s)(\S)/g, function (m, sp, c) { return sp + c.toUpperCase(); });
  }
  function norm(s) { return clean(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function key(r) { return r.t + "|" + norm(r.nombre); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function displayName(n) {
    var full = titleCase(n);
    if (CFG.NAME_FORMAT !== "corto") return full;
    var p = full.split(" ");
    if (p.length < 2) return full;
    // "Nombre1 Nombre2 Apellido1 Apellido2" → "Nombre1 A."
    var apellido = p.length >= 4 ? p[2] : p[p.length - 1];
    return p[0] + " " + apellido.charAt(0) + ".";
  }
  function initials(n) {
    var p = titleCase(n).split(" ").filter(Boolean);
    return ((p[0] || "")[0] || "") + ((p.length > 1 ? p[p.length > 3 ? 2 : p.length - 1] : "")[0] || "");
  }
  // Acepta ISO (Apps Script) o "dd/mm/aaaa hh:mm:ss" (formato del Sheet).
  function parseDate(t) {
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(clean(t));
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    var d = new Date(t);
    return isNaN(d) ? null : d;
  }
  function sameDay(a, b) { return a && b && a.toDateString() === b.toDateString(); }
  function timeAgo(d) {
    if (!d) return "";
    var s = Math.round((Date.now() - d) / 1000);
    if (s < 60) return "hace un momento";
    var m = Math.round(s / 60); if (m < 60) return "hace " + m + " min";
    var h = Math.round(m / 60); if (h < 24) return "hace " + h + " h";
    var dd = Math.round(h / 24); if (dd < 7) return "hace " + dd + (dd === 1 ? " día" : " días");
    return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  }
  function congrega(r) { return /^s[ií]/i.test(clean(r.congrega)); }
  function iglesia(r) {
    var i = clean(r.iglesia);
    return congrega(r) && i && !/^(ninguna|ninguno|no|n\/a|-)$/i.test(i) ? i : "";
  }

  /* ---------- render ---------- */
  function animateNumber(el, from, to) {
    var start = performance.now(), dur = 900;
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))).toLocaleString("es-CO");
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function bars(container, counts, max) {
    var total = counts.reduce(function (a, c) { return a + c[1]; }, 0) || 1;
    container.innerHTML = counts.slice(0, max || 5).map(function (c) {
      var pct = Math.round((c[1] / total) * 100);
      return '<div><div class="bar__row"><span>' + esc(c[0]) + '</span><strong>' + c[1] +
        ' · ' + pct + '%</strong></div><div class="bar__track"><div class="bar__fill" style="width:' + pct + '%"></div></div></div>';
    }).join("");
  }

  function countBy(fn) {
    var map = {};
    registros.forEach(function (r) {
      var v = fn(r); if (!v) return;
      var k = norm(v);
      if (!map[k]) map[k] = [v, 0];
      map[k][1]++;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b[1] - a[1]; });
  }

  function renderStats() {
    var now = new Date();
    var hoy = registros.filter(function (r) { return sameDay(r._d, now); }).length;
    var cong = registros.filter(congrega).length;
    var iglesias = countBy(iglesia).length;

    if (registros.length !== shownTotal) {
      animateNumber(els.total, shownTotal, registros.length);
      if (known && registros.length > shownTotal) {
        els.total.classList.remove("bump"); void els.total.offsetWidth; els.total.classList.add("bump");
      }
      shownTotal = registros.length;
    }
    els.statToday.textContent = hoy;
    els.today.textContent = hoy ? "· " + hoy + (hoy === 1 ? " se registró hoy" : " se registraron hoy") : "";
    els.statCongrega.textContent = registros.length ? Math.round((cong / registros.length) * 100) + "%" : "0%";
    els.statIglesias.textContent = iglesias;

    bars(els.barsCanal, countBy(function (r) { return titleCase(r.canal).replace(/^Por /, ""); }), 5);
    bars(els.barsCivil, countBy(function (r) { return titleCase(r.estadoCivil); }), 5);
  }

  function renderList(newKeys) {
    var q = norm(els.search.value);
    var list = q ? registros.filter(function (r) { return norm(r.nombre).indexOf(q) !== -1; }) : registros;
    var n = registros.length;
    els.grid.innerHTML = list.map(function (r) {
      var meta = iglesia(r) || "Bienvenida al congreso";
      var num = n - registros.indexOf(r);
      return '<li class="card' + (newKeys && newKeys[key(r)] ? " is-new" : "") + '">' +
        '<span class="avatar">' + esc(initials(r.nombre)) + '</span>' +
        '<div class="card__body"><p class="card__name">' + esc(displayName(r.nombre)) + '</p>' +
        '<p class="card__meta">' + esc(meta) + ' · ' + esc(timeAgo(r._d)) + '</p></div>' +
        '<span class="card__num">#' + num + '</span></li>';
    }).join("");
    els.empty.hidden = list.length > 0 || !q;
  }

  var toastTimer;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove("show"); }, 4500);
  }

  function setLive(ok, text) {
    els.live.classList.toggle("is-error", !ok);
    els.liveText.textContent = text;
  }

  /* ---------- datos ---------- */
  function apply(raw) {
    var next = raw.map(function (r) {
      return { t: clean(r.t), nombre: clean(r.nombre), estadoCivil: r.estadoCivil, congrega: r.congrega,
        iglesia: r.iglesia, canal: r.canal, _d: parseDate(r.t) };
    }).filter(function (r) { return r.nombre; });
    next.sort(function (a, b) { return (b._d || 0) - (a._d || 0); });

    var newKeys = {}, nuevos = [];
    if (known) next.forEach(function (r) { if (!known.has(key(r))) { newKeys[key(r)] = 1; nuevos.push(r); } });
    known = new Set(next.map(key));
    registros = next;

    renderStats();
    renderList(newKeys);
    if (nuevos.length === 1) toast("💗 ¡" + displayName(nuevos[0].nombre).split(" ")[0] + " acaba de registrarse!");
    else if (nuevos.length > 1) toast("💗 ¡" + nuevos.length + " nuevas registradas!");
  }

  // Consulta en espera: el Apps Script no responde hasta que hay un registro
  // nuevo (o pasan ~25 s). Apenas responde, se vuelve a preguntar.
  function request() {
    if (DEMO) return Demo.wait(version);
    var url = CFG.DATA_URL + (CFG.DATA_URL.indexOf("?") === -1 ? "?" : "&") +
      "since=" + encodeURIComponent(version) + "&_=" + Date.now();
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 60000);
    return fetch(url, { cache: "no-store", signal: ctrl.signal })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .finally(function () { clearTimeout(timer); });
  }

  function poll() {
    // Pestaña oculta → no ocupar una de las ejecuciones simultáneas de Google.
    if (inFlight || document.hidden) return;
    inFlight = true;
    request().then(function (j) {
      inFlight = false;
      fails = 0;
      setLive(true, DEMO ? "Modo demo · en vivo" : "En vivo");
      if (j.cambio) apply(j.registros || []);
      if (j.version) version = String(j.version);
      setTimeout(poll, 200);
    }).catch(function () {
      inFlight = false;
      fails++;
      setLive(false, "Reconectando…");
      setTimeout(poll, Math.min(30000, 2000 * Math.pow(2, fails - 1)));
    });
  }

  /* ---------- modo demo ---------- */
  var Demo = (function () {
    var nombres = ["Maryuri Lizeth", "Ana María", "Luisa Fernanda", "Daniela", "Paola Andrea", "Yeimy", "Carolina", "Diana Marcela",
      "Laura Sofía", "Natalia", "Angie Tatiana", "Valentina", "Sandra Milena", "Gloria Inés", "Martha Lucía", "Juliana",
      "Leidy Johana", "Camila", "María José", "Karen Dayana", "Yuliana", "Claudia Patricia", "Erika", "Sara Isabel"];
    var apellidos = ["Cardoso", "Perdomo", "Trujillo", "Rojas", "Polanía", "Vargas", "Cuéllar", "Quintero", "Medina", "Ramírez",
      "Charry", "Losada", "Salazar", "Ortiz", "Gutiérrez", "Bahamón", "Silva", "Calderón", "Murcia", "Andrade"];
    var iglesias = ["Vive Ministerio Internacional", "Iglesia Cristiana Filadelfia", "Centro Cristiano Neiva", "Misión Carismática",
      "Iglesia Pentecostal Unida", "Comunidad Cristiana Renacer"];
    var civil = ["Soltera", "Soltera", "Casada", "Casada", "Unión libre", "Viuda", "Separada"];
    var canal = ["Por redes sociales", "Por redes sociales", "Por redes sociales", "Por una amiga o familiar", "Por mi iglesia", "Por un flyer"];
    var seed = 7;
    function rnd(a) { seed = (seed * 9301 + 49297) % 233280; return a[Math.floor((seed / 233280) * a.length)]; }
    function one(date) {
      var cong = rnd([1, 1, 1, 0]);
      return { t: date.toISOString(), nombre: rnd(nombres) + " " + rnd(apellidos) + " " + rnd(apellidos),
        estadoCivil: rnd(civil), congrega: cong ? "Sí" : "No", iglesia: cong ? rnd(iglesias) : "Ninguna", canal: rnd(canal) };
    }
    var rows = [];
    var now = Date.now();
    for (var i = 103; i > 0; i--) rows.push(one(new Date(now - i * i * 2.7e5)));
    rows[rows.length - 1] = { t: new Date(now - 4e5).toISOString(), nombre: "Maryuri Lizeth Cardoso", estadoCivil: "Soltera",
      congrega: "No", iglesia: "Ninguna", canal: "Por redes sociales" };
    var v = 1;
    // Simula al Apps Script: la primera vez responde enseguida; después
    // "espera" hasta que llega una nueva registrada (cada 6–12 s).
    return { wait: function (since) {
      if (String(since) !== String(v)) return Promise.resolve({ cambio: true, version: String(v), registros: rows.slice() });
      return new Promise(function (ok) {
        setTimeout(function () {
          rows.push(one(new Date())); v++;
          ok({ cambio: true, version: String(v), registros: rows.slice() });
        }, 6000 + Math.random() * 6000);
      });
    } };
  })();

  els.search.addEventListener("input", function () { renderList(null); });
  setInterval(function () { renderList(null); }, 60000); // refresca los "hace X min"
  document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
  poll();
})();
