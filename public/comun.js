'use strict';
// ================= pantallas compartidas entre entrenador y alumno =================
async function cargarDatos(alumnoId) {
  const q = alumnoId ? `?alumno=${alumnoId}` : '';
  const [rutinas, mediciones, fotos, pagos] = await Promise.all([
    api('GET', '/api/rutinas' + q), api('GET', '/api/mediciones' + q), api('GET', '/api/fotos' + q), api('GET', '/api/pagos' + q)]);
  return { rutinas, mediciones, fotos, pagos };
}

const stat = (titulo, valor, sub, extra) => h('div', { class: 'card stat' }, h('div', { class: 'stat-tit' }, titulo), h('div', { class: 'stat-val' }, valor), sub ? h('div', { class: 'sub' }, sub) : null, extra || null);
const barra = (pct) => h('div', { class: 'progreso', style: 'margin-top:8px' }, h('div', { style: `width:${Math.round(Math.max(0, Math.min(1, pct || 0)) * 100)}%` }));
const signo = (v, d = 1) => (v == null ? '—' : (v > 0 ? '▲ ' : v < 0 ? '▼ ' : '') + fmt(Math.abs(v), d));

// ---------- Resumen / dashboard ----------
function bloqueResumen(a, d, { entrenador } = {}) {
  const hoy = hoyISO(), f = fichaDe(a);
  const prog = programa(a, hoy), adh = adherencia(d.rutinas, hoy), peso = avancePeso(a, d.mediciones, hoy), bono = bonoSesiones(a, d.rutinas);
  const obj = OBJETIVOS[a.objetivo];
  const estrella = obj && obj.estrella;
  const estIni = estrella && (f.medidas_inicio || {})[estrella], estAct = estrella && valorActual(a, d.mediciones, estrella);
  const ultPago = d.pagos[0];
  const cont = h('div');
  const tarjetas = [
    prog ? stat('Programa', `Semana ${prog.semana} de ${prog.total}`, prog.empezo ? (prog.restantes ? `Quedan ${prog.restantes} semanas · termina el ${fechaNum(prog.fin)}` : `Termina el ${fechaNum(prog.fin)}`) : `Empieza el ${fechaNum(f.fecha_inicio)}`, barra(prog.semana / prog.total))
      : stat('Programa', 'Sin fechas', entrenador ? 'Cargá fecha de inicio y duración en la Ficha' : 'Tu entrenador todavía no definió el programa'),
    stat('Adherencia', adh.pct == null ? '—' : Math.round(adh.pct * 100) + '%', `${adh.hechas} de ${adh.planificadas} sesiones cumplidas`, adh.pct != null ? barra(adh.pct) : null),
    peso ? stat('Peso', `${fmt(peso.actual, 1)} kg`, `Inicio ${fmt(peso.inicial, 1)} kg · ${signo(peso.variacion)} kg${peso.meta ? ` · meta ${fmt(peso.meta, 1)} kg` : ''}`, peso.pct != null ? barra(peso.pct) : null)
      : stat('Peso', '—', 'Sin peso inicial cargado'),
    estrella && estIni ? stat(`Medida clave · ${NOMBRE_MEDIDA[estrella]}`, `${fmt(estAct, 1)} cm`, `Inicio ${fmt(estIni, 1)} cm · ${signo(redondear(estAct - estIni, 1))} cm`) : null,
    bono ? stat('Sesiones del bono', `${bono.restantes} restantes`, `${bono.usadas} usadas de ${bono.incluidas}`, barra(bono.usadas / bono.incluidas)) : null,
    entrenador && (f.comercial || {}).modalidad ? stat('Próximo pago', fechaNum((f.comercial || {}).proximo_pago),
      ultPago ? `Último: ${fechaNum(ultPago.fecha)} · ${ultPago.estado}` : 'Sin pagos registrados',
      ultPago ? chip(ultPago.estado, ultPago.estado === 'Pagado' ? 'ok' : 'warn') : null) : null,
  ].filter(Boolean);
  cont.append(h('div', { class: 'stats' }, tarjetas));

  if (peso && (peso.ritmo != null)) {
    cont.append(h('div', { class: 'card', style: 'margin-top:12px' }, h('h2', {}, 'Seguimiento de la meta de peso'),
      h('div', { class: 'grid3' },
        h('div', {}, h('div', { class: 'stat-tit' }, 'Ritmo actual'), h('b', {}, `${signo(peso.ritmo, 2)} kg/sem`), h('div', { class: 'sub' }, 'desde que empezó')),
        h('div', {}, h('div', { class: 'stat-tit' }, 'Ritmo necesario'), h('b', {}, peso.necesario != null ? `${signo(peso.necesario, 2)} kg/sem` : '—'), h('div', { class: 'sub' }, 'para llegar a tiempo')),
        h('div', {}, h('div', { class: 'stat-tit' }, 'Llegada estimada'), h('b', {}, peso.llegada ? fechaNum(peso.llegada) : '—'), h('div', { class: 'sub' }, peso.llegada ? 'al ritmo actual' : 'el ritmo actual no acerca a la meta')))));
  }

  if (entrenador) {
    const banderas = ANAMNESIS.filter(([k]) => ((f.anamnesis || {})[k] || {}).si);
    cont.append(h('div', { class: 'card', style: 'margin-top:12px' }, h('h2', {}, 'Antes de entrenar · banderas de salud'),
      banderas.length ? h('div', { class: 'lista-banderas' }, banderas.map(([k, , corto]) => h('div', {}, chip('⚠ ' + corto, 'warn'), ' ', f.anamnesis[k].cual || 'sin detalle')))
        : h('div', { class: 'sub' }, (f.anamnesis && Object.values(f.anamnesis).some((x) => x && x.si === false)) ? 'Sin banderas de salud declaradas.' : 'Anamnesis sin completar (pestaña Ficha).'),
      a.observaciones ? h('div', { class: 'sub', style: 'margin-top:6px' }, 'Observaciones: ' + a.observaciones) : null));
  }

  const graf = h('div', { class: 'grid-graf' },
    h('div', { class: 'card' }, h('h2', {}, 'Peso'), graficoLinea(serieMedida(a, d.mediciones, 'peso'), { unidad: 'kg', meta: (f.medidas_meta || {}).peso ?? null, vacio: 'Registrá mediciones en Progreso para ver la evolución' })),
    h('div', { class: 'card' }, h('h2', {}, 'Cumplimiento semana a semana'), graficoBarras(cumplimientoSemanal(a, d.rutinas))),
    h('div', { class: 'card' }, h('h2', {}, 'Fuerza por ejercicio'), bloqueFuerza(d.rutinas)));
  cont.append(graf);
  return cont;
}

function serieMedida(a, mediciones, k) {
  const f = fichaDe(a), pts = [];
  const ini = (f.medidas_inicio || {})[k];
  if (ini != null && f.fecha_inicio) pts.push({ x: f.fecha_inicio, y: ini, etiqueta: 'Inicio · ' + fechaNum(f.fecha_inicio) });
  for (const m of mediciones) if (m.datos[k] != null) pts.push({ x: m.fecha, y: m.datos[k] });
  return pts.sort((p, q) => (p.x < q.x ? -1 : 1));
}
function cumplimientoSemanal(a, rutinas) {
  const hoy = hoyISO(), sem = {};
  for (const r of rutinas) { if (r.fecha > hoy && !r.hecha) continue; const l = lunesDe(r.fecha); (sem[l] ||= { p: 0, h: 0 }); sem[l].p++; if (r.hecha) sem[l].h++; }
  const ini = fichaDe(a).fecha_inicio ? lunesDe(fichaDe(a).fecha_inicio) : null;
  return Object.keys(sem).sort().slice(-12).map((l) => ({
    etiqueta: ini && l >= ini ? 'S' + (Math.round((desdeISO(l) - desdeISO(ini)) / 6048e5) + 1) : fechaCorta(l),
    valor: sem[l].h / sem[l].p, detalle: `Semana del ${fechaCorta(l)}: ${sem[l].h} de ${sem[l].p} sesiones`,
  }));
}
function bloqueFuerza(rutinas) {
  const series = {};
  for (const r of rutinas) for (const it of r.items) {
    const c = parseFloat(String(it.carga_real).replace(',', '.'));
    if (!isNaN(c) && c > 0) { const s0 = (series[it.nombre] ||= {}); s0[r.fecha] = Math.max(s0[r.fecha] || 0, c); }
  }
  const nombres = Object.keys(series).sort((x, y) => Object.keys(series[y]).length - Object.keys(series[x]).length);
  if (!nombres.length) return h('div', { class: 'vacio' }, 'Aparece cuando se registren cargas en las sesiones.');
  const cont = h('div');
  const pintar = (n) => cont.replaceChildren(graficoLinea(Object.entries(series[n]).sort().map(([x, y]) => ({ x, y })), { unidad: 'kg' }));
  const sel = selector(nombres, nombres[0], { vacio: null, onchange: (e) => pintar(e.target.value), attrs: { 'aria-label': 'Ejercicio', style: 'max-width:340px;margin-bottom:8px' } });
  pintar(nombres[0]);
  return h('div', {}, sel, cont);
}

// ---------- Progreso: medidas y fotos ----------
function tablaMedidas(a, mediciones) {
  const f = fichaDe(a), ini = f.medidas_inicio || {}, meta = f.medidas_meta || {};
  const filas = MEDIDAS.filter(([k]) => ini[k] != null || meta[k] != null || ultimoValor(mediciones, k) != null);
  if (!filas.length) return h('div', { class: 'vacio' }, 'Sin medidas cargadas.');
  return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Medida'), h('th', {}, 'Inicio'), h('th', {}, 'Hoy'), h('th', {}, 'Variación'), h('th', {}, 'Meta'))),
    h('tbody', {}, filas.map(([k, n, u]) => {
      const act = valorActual(a, mediciones, k), v = ini[k] != null && act != null ? redondear(act - ini[k], 1) : null;
      return h('tr', {}, h('td', {}, n), h('td', {}, ini[k] != null ? `${fmt(ini[k], 1)} ${u}` : '—'), h('td', {}, act != null ? `${fmt(act, 1)} ${u}` : '—'),
        h('td', {}, v != null ? signo(v) : '—'), h('td', {}, meta[k] != null ? `${fmt(meta[k], 1)} ${u}` : '—'));
    }))));
}
const TIPOS_FOTO = [['frente', 'Frente'], ['espalda', 'Espalda'], ['perfil_der', 'Perfil derecho'], ['perfil_izq', 'Perfil izquierdo']];
function seccionFotos(a, fotos, { editable, recargar } = {}) {
  const fechas = [...new Set(fotos.map((f) => f.fecha))].sort();
  const cont = h('div');
  const fila = (fecha, titulo) => h('div', { style: 'margin-bottom:14px' },
    h('div', { class: 'fila entre', style: 'margin-bottom:6px' }, h('b', {}, titulo), editable ? h('button', { class: 'btn chico', onclick: () => subirFotos(a, fecha, recargar) }, '+ Fotos') : null),
    h('div', { class: 'fotos' }, TIPOS_FOTO.map(([t, n]) => {
      const f = fotos.filter((x) => x.fecha === fecha && x.tipo === t).pop();
      return h('figure', {}, f ? h('a', { href: urlFoto(f.id), target: '_blank', rel: 'noopener' }, h('img', { src: urlFoto(f.id), alt: n, loading: 'lazy' })) : h('div', { class: 'foto-vacia' }, 'Sin foto'),
        h('figcaption', {}, n, editable && f ? h('button', {
          class: 'btn-x', title: 'Borrar foto', onclick: intentar(async () => { if (!confirm('¿Borrar esta foto?')) return; await api('DELETE', '/api/fotos/' + f.id); recargar(); }),
        }, '✕') : null));
    })));
  if (!fechas.length) cont.append(h('div', { class: 'vacio' }, editable ? 'Todavía no hay fotos. Subí las fotos iniciales (frente, espalda y perfiles).' : 'Tu entrenador todavía no cargó fotos.'));
  else {
    cont.append(fila(fechas[0], `Al inicio · ${fechaNum(fechas[0])}`));
    if (fechas.length > 1) cont.append(fila(fechas[fechas.length - 1], `Más reciente · ${fechaNum(fechas[fechas.length - 1])}`));
    if (fechas.length > 2) cont.append(h('details', {}, h('summary', { class: 'sub' }, `Ver las ${fechas.length - 2} tomas intermedias`), fechas.slice(1, -1).map((fe) => fila(fe, fechaNum(fe)))));
  }
  if (editable) cont.append(h('button', { class: 'btn', onclick: () => subirFotos(a, null, recargar) }, '+ Nueva toma de fotos'));
  return cont;
}
function subirFotos(a, fecha, recargar) {
  const fe = h('input', { type: 'date', value: fecha || hoyISO() });
  const inputs = TIPOS_FOTO.map(([t, n]) => [t, h('input', { type: 'file', accept: 'image/*', capture: 'environment' }), n]);
  modal('Subir fotos de progreso', (cerrar) => [
    campo('Fecha de la toma', fe),
    h('div', { class: 'grid2' }, inputs.map(([, inp, n]) => campo(n, inp))),
    h('div', { class: 'modal-pie' }, h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', {
        class: 'btn prim', onclick: intentar(async (ev) => {
          const sel = inputs.filter(([, inp]) => inp.files[0]);
          if (!sel.length) throw new Error('Elegí al menos una foto');
          ev.target.disabled = true; ev.target.textContent = 'Subiendo…';
          try { for (const [t, inp] of sel) await api('POST', '/api/fotos', { alumno_id: a.id, fecha: fe.value, tipo: t, data: await imagenADataURL(inp.files[0]) }); }
          finally { ev.target.disabled = false; ev.target.textContent = 'Subir'; }
          cerrar(); toast('Fotos guardadas'); recargar();
        }),
      }, 'Subir')),
  ]);
}
function seccionControl(a, mediciones, { editable, recargar } = {}) {
  const usadas = MEDIDAS.filter(([k]) => k !== 'altura' && mediciones.some((m) => m.datos[k] != null));
  const tabla = mediciones.length ? h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), usadas.map(([, n]) => h('th', {}, n)), editable ? h('th', {}) : null)),
    h('tbody', {}, [...mediciones].reverse().map((m) => h('tr', {}, h('td', {}, fechaNum(m.fecha)), usadas.map(([k]) => h('td', {}, m.datos[k] != null ? fmt(m.datos[k], 1) : '—')),
      editable ? h('td', {}, h('button', { class: 'btn chico', onclick: () => formMedicion(a, m, recargar) }, 'Editar')) : null))))) : h('div', { class: 'vacio' }, 'Sin controles registrados todavía.');
  return h('div', {}, tabla, editable ? h('button', { class: 'btn prim', style: 'margin-top:10px', onclick: () => formMedicion(a, null, recargar) }, '+ Registrar control') : null);
}
function formMedicion(a, m, recargar) {
  const nuevo = !m; m ||= { fecha: hoyISO(), datos: {} };
  const fe = h('input', { type: 'date', value: m.fecha });
  const ins = {};
  modal(nuevo ? 'Registrar control corporal' : 'Editar control', (cerrar) => [
    campo('Fecha', fe), h('p', { class: 'sub' }, 'Completá solo las medidas que tomaste. Para el progreso se usa siempre el último dato de cada medida.'),
    h('div', { class: 'grid3' }, MEDIDAS.filter(([k]) => k !== 'altura').map(([k, n, u]) => campo(`${n} (${u})`, (ins[k] = h('input', { type: 'number', step: '0.1', inputmode: 'decimal', value: m.datos[k] ?? '' }))))),
    h('div', { class: 'modal-pie' },
      !nuevo ? h('button', { class: 'btn peligro', style: 'margin-right:auto', onclick: intentar(async () => { if (!confirm('¿Borrar este control?')) return; await api('DELETE', '/api/mediciones/' + m.id); cerrar(); recargar(); }) }, 'Eliminar') : null,
      h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', {
        class: 'btn prim', onclick: intentar(async () => {
          const datos = Object.fromEntries(Object.entries(ins).map(([k, i]) => [k, i.value === '' ? null : Number(i.value)]));
          if (nuevo) await api('POST', '/api/mediciones', { alumno_id: a.id, fecha: fe.value, datos }); else await api('PUT', '/api/mediciones/' + m.id, { fecha: fe.value, datos });
          cerrar(); toast('Control guardado'); recargar();
        }),
      }, 'Guardar')),
  ], { ancho: true });
}

// ---------- Alimentación ----------
function normalizarDieta(d) {
  const menu = (m) => Array.from({ length: 6 }, (_, i) => ({ nombre: (m && m[i] && m[i].nombre) || NOMBRES_COMIDA[i], items: (m && m[i] && m[i].items) || [] }));
  return { comidas: d.comidas || 4, entreno: menu(d.entreno), descanso: menu(d.descanso), suplementos: d.suplementos || [], notas: d.notas || '' };
}
function metasDelDia(a, mediciones) {
  const peso = valorActual(a, mediciones, 'peso'), cal = calorias(a, peso), mac = macros(a);
  return { peso, cal, mac, pesoIni: (fichaDe(a).medidas_inicio || {}).peso };
}
function bloqueMetas(a, mediciones, dieta, onComidas) {
  const { peso, cal, mac, pesoIni } = metasDelDia(a, mediciones), n = dieta.comidas;
  const porComida = (v) => (v == null ? '—' : fmt(v / n));
  return h('div', { class: 'card' }, h('h2', {}, 'Metas del día'),
    h('div', { class: 'stats chicas' },
      h('div', {}, h('div', { class: 'stat-tit' }, 'Peso más reciente'), h('b', {}, peso ? `${fmt(peso, 1)} kg` : '—'), pesoIni && peso ? h('div', { class: 'sub' }, `${signo(redondear(peso - pesoIni, 1))} kg desde el inicio`) : null),
      h('div', {}, h('div', { class: 'stat-tit' }, 'Meta calórica'), h('b', {}, cal && cal.meta ? `${fmt(cal.meta)} kcal` : '—'), h('div', { class: 'sub' }, cal && cal.meta ? 'recalculada con el último peso' : 'completá la ficha (género, edad, altura, actividad)')),
      h('div', {}, h('div', { class: 'stat-tit' }, 'Rango de meta'), h('b', {}, cal && cal.min ? `${fmt(cal.min)} a ${fmt(cal.max)}` : '—')),
      h('div', {}, h('div', { class: 'stat-tit' }, 'Comidas por día'), onComidas ? selector([3, 4, 5, 6], n, { vacio: null, onchange: (e) => onComidas(Number(e.target.value)), attrs: { style: 'max-width:90px' } }) : h('b', {}, n))),
    h('table', { class: 'tabla', style: 'margin-top:12px' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Macro'), h('th', {}, 'Total del día'), h('th', {}, 'Por comida'))),
      h('tbody', {}, [['Proteína (g)', mac.final.prot], ['Carbohidratos (g)', mac.final.carb], ['Grasas (g)', mac.final.grasa]].map(([t, v]) => h('tr', {}, h('td', {}, t), h('td', {}, fmt(v)), h('td', {}, porComida(v)))))));
}
function tablaComida(comida, alimentosLista, { editable, alCambiar }) {
  const filas = comida.items.map((it, i) => {
    const m = macrosItem(it, alimentosLista), al = m.al;
    if (!editable) return h('tr', {}, h('td', {}, al ? al.grupo : ''), h('td', {}, al ? al.nombre : '(alimento eliminado)', al && al.nota ? h('div', { class: 'sub' }, al.nota) : null),
      h('td', {}, fmt(it.cantidad, it.cantidad % 1 ? 1 : 0)), h('td', {}, al ? al.unidad : ''), h('td', {}, fmt(m.kcal)), h('td', {}, fmt(m.prot, 1)), h('td', {}, fmt(m.carb, 1)), h('td', {}, fmt(m.grasa, 1)));
    let grupo = al ? al.grupo : (it._grupo || GRUPOS_ALIMENTO[0]);
    const selAl = selector(alimentosLista.filter((x) => x.grupo === grupo).map((x) => [x.id, x.nombre]), it.alimento_id, {
      vacio: 'Elegí…', onchange: (e) => { it.alimento_id = Number(e.target.value) || null; const nuevo = alimentosLista.find((x) => x.id === it.alimento_id); if (nuevo && it.cantidad == null) it.cantidad = nuevo.porcion; alCambiar(); }, attrs: { 'aria-label': 'Alimento' },
    });
    return h('tr', {},
      h('td', {}, selector(GRUPOS_ALIMENTO, grupo, { vacio: null, attrs: { 'aria-label': 'Grupo' }, onchange: (e) => { grupo = e.target.value; it.alimento_id = null; it.cantidad = null; it._grupo = grupo; alCambiar(); } })),
      h('td', {}, selAl),
      h('td', {}, h('input', { type: 'number', step: 'any', inputmode: 'decimal', value: it.cantidad ?? '', style: 'width:80px', 'aria-label': 'Cantidad', onchange: (e) => { it.cantidad = e.target.value === '' ? null : Number(e.target.value); alCambiar(); } })),
      h('td', {}, al ? al.unidad : ''), h('td', {}, fmt(m.kcal)), h('td', {}, fmt(m.prot, 1)), h('td', {}, fmt(m.carb, 1)), h('td', {}, fmt(m.grasa, 1)),
      h('td', {}, h('button', { class: 'btn icono chico peligro', title: 'Quitar', onclick: () => { comida.items.splice(i, 1); alCambiar(); } }, '✕')));
  });
  const sub = sumaMacros(comida.items.map((it) => macrosItem(it, alimentosLista)));
  return h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla comida' },
    h('thead', {}, h('tr', {}, ['Grupo', 'Alimento', 'Cantidad', 'Unidad', 'kcal', 'Prot (g)', 'Carb (g)', 'Grasa (g)'].map((t) => h('th', {}, t)), editable ? h('th', {}) : null)),
    h('tbody', {}, filas.length ? filas : h('tr', {}, h('td', { colspan: editable ? 9 : 8, class: 'sub' }, 'Sin alimentos'))),
    h('tfoot', {}, h('tr', {}, h('td', { colspan: 4 }, 'Subtotal de la comida'), h('td', {}, fmt(sub.kcal)), h('td', {}, fmt(sub.prot, 1)), h('td', {}, fmt(sub.carb, 1)), h('td', {}, fmt(sub.grasa, 1)), editable ? h('td', {}) : null))));
}
function bloqueMenu(titulo, ayuda, menu, dieta, alimentosLista, metas, { editable, alCambiar }) {
  const comidas = menu.slice(0, dieta.comidas);
  const total = sumaMacros(comidas.flatMap((c) => c.items.map((it) => macrosItem(it, alimentosLista))));
  const meta = { kcal: metas.cal && metas.cal.meta, prot: metas.mac.final.prot, carb: metas.mac.final.carb, grasa: metas.mac.final.grasa };
  const comp = (k) => { const e = estadoVsMeta(total[k], meta[k]); return e ? chip(e.txt, e.cls) : chip('—'); };
  return h('div', { class: 'card', style: 'margin-top:14px' },
    h('h2', {}, titulo), h('div', { class: 'sub', style: 'margin:-6px 0 10px' }, ayuda),
    comidas.map((c, i) => h('div', { class: 'comida-bloque' },
      editable ? h('input', { class: 'titulo-comida', value: c.nombre, 'aria-label': 'Nombre de la comida', onchange: (e) => (c.nombre = e.target.value) }) : h('h3', { style: 'margin-bottom:6px' }, c.nombre || `Comida ${i + 1}`),
      tablaComida(c, alimentosLista, { editable, alCambiar }),
      editable ? h('button', { class: 'btn chico', style: 'margin-top:6px', onclick: () => { c.items.push({ alimento_id: null, cantidad: null }); alCambiar(); } }, '+ Alimento') : null)),
    h('div', { class: 'tabla-scroll' }, h('table', { class: 'tabla total-dia' },
      h('thead', {}, h('tr', {}, h('th', {}), h('th', {}, 'kcal'), h('th', {}, 'Proteína'), h('th', {}, 'Carbohidratos'), h('th', {}, 'Grasa'))),
      h('tbody', {},
        h('tr', {}, h('td', {}, h('b', {}, 'Total del día')), h('td', {}, fmt(total.kcal)), h('td', {}, fmt(total.prot, 1)), h('td', {}, fmt(total.carb, 1)), h('td', {}, fmt(total.grasa, 1))),
        h('tr', {}, h('td', {}, 'Meta'), h('td', {}, fmt(meta.kcal)), h('td', {}, fmt(meta.prot)), h('td', {}, fmt(meta.carb)), h('td', {}, fmt(meta.grasa))),
        h('tr', {}, h('td', {}, 'Comparado con la meta'), ['kcal', 'prot', 'carb', 'grasa'].map((k) => h('td', {}, comp(k))))))));
}
function vistaDieta(cont, a, dietaOrig, alimentosLista, mediciones, { editable, guardar } = {}) {
  const dieta = normalizarDieta(JSON.parse(JSON.stringify(dietaOrig)));
  const metas = metasDelDia(a, mediciones);
  const pintar = () => {
    const sup = editable ? h('div', {},
      dieta.suplementos.map((s0, i) => h('div', { class: 'grid-sup' },
        h('input', { value: s0.nombre, placeholder: 'Suplemento', onchange: (e) => (s0.nombre = e.target.value) }),
        h('input', { value: s0.marca, placeholder: 'Marca', onchange: (e) => (s0.marca = e.target.value) }),
        h('input', { value: s0.dosis, placeholder: 'Dosificación', onchange: (e) => (s0.dosis = e.target.value) }),
        h('button', { class: 'btn icono chico peligro', onclick: () => { dieta.suplementos.splice(i, 1); pintar(); } }, '✕'))),
      h('button', { class: 'btn chico', onclick: () => { dieta.suplementos.push({ nombre: '', marca: '', dosis: '' }); pintar(); } }, '+ Suplemento'))
      : dieta.suplementos.length ? h('table', { class: 'tabla' }, h('thead', {}, h('tr', {}, h('th', {}, 'Suplemento'), h('th', {}, 'Marca'), h('th', {}, 'Dosificación'))),
        h('tbody', {}, dieta.suplementos.map((s0) => h('tr', {}, h('td', {}, s0.nombre), h('td', {}, s0.marca), h('td', {}, s0.dosis))))) : h('div', { class: 'sub' }, 'Sin suplementación indicada.');
    cont.replaceChildren(
      bloqueMetas(a, mediciones, dieta, editable ? (n) => { dieta.comidas = n; pintar(); } : null),
      bloqueMenu('Menú · días de entrenamiento', 'Para los días que entrena: más carbohidrato alrededor del entrenamiento.', dieta.entreno, dieta, alimentosLista, metas, { editable, alCambiar: pintar }),
      bloqueMenu('Menú · días de descanso', 'Para los días sin entrenamiento: menos carbohidrato y la misma proteína.', dieta.descanso, dieta, alimentosLista, metas, { editable, alCambiar: pintar }),
      h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', {}, 'Suplementación'), sup),
      h('div', { class: 'card', style: 'margin-top:14px' }, h('h2', {}, 'Indicaciones'),
        editable ? h('textarea', { rows: 4, placeholder: 'Reemplazos, horarios, hidratación…', onchange: (e) => (dieta.notas = e.target.value) }, dieta.notas)
          : h('div', { class: 'pre' }, dieta.notas || 'Sin indicaciones adicionales.')),
      editable ? h('div', { class: 'barra-guardar' }, h('button', { class: 'btn prim', onclick: intentar(() => guardar(dieta)) }, 'Guardar plan de alimentación')) : null);
  };
  pintar();
}

// ---------- Vistas imprimibles (PDF) ----------
function cabeceraImpresion(titulo, a) {
  const c = S.config;
  return h('div', { class: 'imp-cab' },
    c.logo ? h('img', { src: c.logo, alt: '' }) : null,
    h('div', { class: 'esp' }, h('div', { class: 'imp-empresa' }, c.empresa || ''), h('h1', {}, titulo),
      h('div', {}, h('b', {}, a.nombre), a.objetivo ? ' · ' + a.objetivo : '')),
    h('div', { class: 'imp-datos' }, c.entrenador ? h('div', {}, 'Entrenador: ' + c.entrenador) : null, c.contacto ? h('div', {}, 'Contacto: ' + c.contacto) : null, c.instagram ? h('div', {}, 'Instagram: ' + c.instagram) : null));
}
function imprimir(nodo) {
  let z = document.getElementById('imprimir');
  if (!z) { z = h('div', { id: 'imprimir' }); document.body.append(z); }
  z.replaceChildren(nodo);
  const imgs = [...z.querySelectorAll('img')].filter((i) => !i.complete);
  Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 50));
}
function imprimirEntrenamiento(a, rutinas, desde, semanas, d) {
  const hasta = sumar(desde, semanas * 7 - 1);
  const rs = rutinas.filter((r) => r.fecha >= desde && r.fecha <= hasta);
  const prog = programa(a, hoyISO()), adh = adherencia(d.rutinas, hoyISO());
  const doc = h('div', {}, cabeceraImpresion('Tu plan de entrenamiento', a),
    h('div', { class: 'imp-resumen' },
      prog ? h('div', {}, h('b', {}, `Semana ${prog.semana} de ${prog.total}`), ` · termina el ${fechaNum(prog.fin)}`) : null,
      adh.pct != null ? h('div', {}, 'Adherencia: ', h('b', {}, Math.round(adh.pct * 100) + '%')) : null,
      h('div', {}, `Del ${fechaNum(desde)} al ${fechaNum(hasta)}`)),
    Array.from({ length: semanas }, (_, w) => {
      const l = sumar(desde, w * 7), delaSem = rs.filter((r) => lunesDe(r.fecha) === lunesDe(l));
      if (!delaSem.length) return null;
      return h('section', { class: 'imp-semana' }, h('h2', {}, `Semana del ${fechaCorta(l)} al ${fechaCorta(sumar(l, 6))}`),
        delaSem.map((r) => h('div', { class: 'imp-dia' }, h('h3', {}, `${fechaLarga(r.fecha)} · ${r.titulo || 'Entrenamiento'}${r.enfoque ? ' · ' + r.enfoque : ''}`),
          r.notas ? h('div', { class: 'imp-nota' }, r.notas) : null,
          h('table', {}, h('thead', {}, h('tr', {}, ['Ejercicio', 'Series', 'Reps', 'Descanso', 'Carga', 'Observaciones', 'Video'].map((t) => h('th', {}, t)))),
            h('tbody', {}, r.items.map((it) => h('tr', {}, h('td', {}, it.nombre), h('td', {}, it.series), h('td', {}, it.reps), h('td', {}, it.descanso ? it.descanso + (/^\d+$/.test(it.descanso) ? ' s' : '') : ''),
              h('td', {}, it.carga), h('td', {}, it.obs), h('td', {}, it.video ? h('a', { href: it.video }, 'Ver') : ''))))))));
    }),
    rs.length ? null : h('p', {}, 'No hay sesiones en este período.'));
  imprimir(doc);
}
function imprimirDieta(a, dieta0, alimentosLista, mediciones) {
  const dieta = normalizarDieta(dieta0), metas = metasDelDia(a, mediciones);
  const menu = (titulo, m) => h('section', { class: 'imp-semana' }, h('h2', {}, titulo), m.slice(0, dieta.comidas).map((c) => h('div', { class: 'imp-dia' }, h('h3', {}, c.nombre),
    tablaComida(c, alimentosLista, { editable: false }))));
  imprimir(h('div', {}, cabeceraImpresion('Tu plan de alimentación', a),
    h('div', { class: 'imp-resumen' },
      metas.cal && metas.cal.meta ? h('div', {}, 'Meta calórica: ', h('b', {}, `${fmt(metas.cal.meta)} kcal`), ` (${fmt(metas.cal.min)} a ${fmt(metas.cal.max)})`) : null,
      h('div', {}, `Proteína ${fmt(metas.mac.final.prot)} g · Carbohidratos ${fmt(metas.mac.final.carb)} g · Grasas ${fmt(metas.mac.final.grasa)} g`),
      h('div', {}, `${dieta.comidas} comidas por día`)),
    menu('Días de entrenamiento', dieta.entreno), menu('Días de descanso', dieta.descanso),
    dieta.suplementos.length ? h('section', { class: 'imp-semana' }, h('h2', {}, 'Suplementación'), h('table', {}, h('tbody', {}, dieta.suplementos.map((s0) => h('tr', {}, h('td', {}, s0.nombre), h('td', {}, s0.marca), h('td', {}, s0.dosis)))))) : null,
    dieta.notas ? h('section', { class: 'imp-semana' }, h('h2', {}, 'Indicaciones'), h('div', { class: 'pre' }, dieta.notas)) : null,
    h('section', { class: 'imp-semana' }, h('h2', {}, 'Consejos'), h('ul', {},
      h('li', {}, 'Pesá los alimentos en el estado que indica la tabla (crudo o cocido).'),
      h('li', {}, 'Podés reemplazar un alimento por otro del mismo grupo en cantidad equivalente.'),
      h('li', {}, 'Mantené la proteína en cada comida, también los días de descanso.')))));
}
