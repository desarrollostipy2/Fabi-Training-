'use strict';
// ================= ENTRENADOR =================

// ---------- lista de alumnos ----------
async function vistaAlumnos(main) {
  const lista = await api('GET', '/api/alumnos');
  const buscar = h('input', { type: 'search', class: 'buscador', placeholder: 'Buscar por nombre o CI…' });
  const cont = h('div', { class: 'lista' });
  const pintar = () => {
    const q = sinTildes(buscar.value);
    const f = lista.filter((a) => sinTildes(a.nombre).includes(q) || a.ci.includes(q));
    cont.replaceChildren(...(f.length ? f.map((a) => {
      const prox = (a.ficha.comercial || {}).proximo_pago, vencido = prox && prox < hoyISO();
      return h('div', { class: 'card item-click tarjeta-alumno', onclick: () => { S.sub = a.id; S.subtab = 'resumen'; render(); } },
        h('div', { class: 'avatar' + (a.activo ? '' : ' apagado') }, iniciales(a.nombre)),
        h('div', { class: 'tarjeta-txt' }, h('h3', {}, a.nombre), h('div', { class: 'sub' }, [`CI ${a.ci}`, a.objetivo].filter(Boolean).join(' · ')),
          h('div', { class: 'chips-fila' },
            !a.activo ? chip('Inactivo', 'off') : null,
            vencido ? chip('Pago vencido', 'warn') : a.ultimo_pago === 'Pendiente' ? chip('Pago pendiente', 'warn') : null,
            a.pendientes ? chip(`${a.pendientes} próximas`, 'acc') : chip('Sin rutina'),
            chip(`${a.hechas} hechas`, 'ok'))),
        h('span', { class: 'flecha', 'aria-hidden': 'true' }, '›'));
    }) : [h('div', { class: 'vacio' }, lista.length ? 'Sin resultados' : 'Todavía no cargaste alumnos. Tocá "Nuevo alumno".')]));
  };
  buscar.oninput = pintar;
  main.append(h('div', { class: 'cab' }, h('div', {}, h('h1', {}, 'Alumnos'), h('div', { class: 'sub' }, `${lista.filter((a) => a.activo).length} activos de ${lista.length}`)),
    h('button', { class: 'btn prim', onclick: nuevoAlumno }, '+ Nuevo alumno')), buscar, cont);
  pintar();
}
function nuevoAlumno() {
  const nombre = h('input', { required: true }), ci = h('input', { inputmode: 'numeric', required: true }), pass = h('input', { autocomplete: 'off' });
  modal('Nuevo alumno', (cerrar) => [
    campo('Nombre y apellido', nombre), campo('CI', ci), campo('Contraseña inicial', pass, 'Si lo dejás vacío, la contraseña es su número de CI.'),
    h('p', { class: 'sub' }, 'Después vas a completar la ficha: datos del programa, medidas, anamnesis y acuerdo comercial.'),
    h('div', { class: 'modal-pie' }, h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', {
        class: 'btn prim', onclick: intentar(async () => {
          const r = await api('POST', '/api/alumnos', { nombre: nombre.value.trim(), ci: ci.value, password: pass.value || null, ficha: { fecha_inicio: hoyISO() } });
          cerrar(); toast('Alumno creado'); S.sub = r.id; S.subtab = 'ficha'; render();
        }),
      }, 'Crear y completar ficha')),
  ]);
  nombre.focus();
}

// ---------- detalle del alumno ----------
const SUBTABS = [['resumen', 'Resumen'], ['entreno', 'Entrenamiento'], ['alimentacion', 'Alimentación'], ['progreso', 'Progreso'], ['ficha', 'Ficha'], ['pagos', 'Pagos']];
async function vistaAlumno(main) {
  const a = await api('GET', '/api/alumnos/' + S.sub);
  const cuerpo = contenedor();
  main.append(
    h('button', { class: 'btn chico btn-atras', onclick: () => { S.sub = null; render(); } }, icono('atras', 18), 'Alumnos'),
    h('div', { class: 'perfil-cab' },
      h('div', { class: 'avatar' }, iniciales(a.nombre)),
      h('div', {}, h('h1', {}, a.nombre, !a.activo ? ' ' : null, !a.activo ? chip('Inactivo', 'off') : null),
        h('div', { class: 'sub' }, [`CI ${a.ci}`, a.objetivo, a.nivel, a.edad && a.edad + ' años', a.telefono].filter(Boolean).join(' · ')))),
    h('nav', { class: 'subtabs' }, SUBTABS.map(([id, t]) => h('button', { class: 'subtab' + (S.subtab === id ? ' on' : ''), onclick: () => { S.subtab = id; render(); } }, t))),
    cuerpo);
  const recargar = () => render();
  await ({ resumen: tabResumen, entreno: tabEntreno, alimentacion: tabAlimentacion, progreso: tabProgreso, ficha: tabFicha, pagos: tabPagos })[S.subtab](cuerpo, a, recargar);
}

async function tabResumen(c, a) {
  const d = await cargarDatos(a.id);
  c.append(bloqueResumen(a, d, { entrenador: true }));
}

// ---------- entrenamiento (calendario) ----------
async function tabEntreno(c, a) {
  S.semana ||= lunesDe(hoyISO());
  const cont = h('div');
  c.append(h('div', { class: 'fila acciones-top', style: 'justify-content:flex-end;margin-bottom:12px' },
    h('button', { class: 'btn', onclick: intentar(async () => { const d = await cargarDatos(a.id); dialogoImprimir(a, d); }) }, '🖨 Imprimir / PDF'),
    h('button', { class: 'btn prim', onclick: () => asignarPlan([a.id], S.semana) }, 'Asignar plan semanal')), cont);
  const pintar = intentar(async () => {
    const desde = S.semana, hasta = sumar(desde, 6);
    const rutinas = await api('GET', `/api/rutinas?alumno=${a.id}&desde=${desde}&hasta=${hasta}`);
    const hechas = rutinas.filter((r) => r.hecha).length;
    cont.replaceChildren(
      navSemana(desde, hasta, (n) => { S.semana = n; pintar(); }, rutinas.length ? `${hechas}/${rutinas.length} sesiones hechas` : 'Semana sin rutinas'),
      h('div', { class: 'semana' }, DIAS_C.map((dn, i) => {
        const f = sumar(desde, i), delDia = rutinas.filter((r) => r.fecha === f);
        return h('div', { class: 'dia' + (f === hoyISO() ? ' hoy' : '') },
          h('div', { class: 'dia-cab' }, h('span', {}, dn), h('b', {}, desdeISO(f).getDate())),
          delDia.map((r) => h('div', { class: 'rut' + (r.hecha ? ' hecha' : ''), onclick: () => editarRutina(a, r, pintar) },
            h('div', {}, (r.hecha ? '✓ ' : '') + (r.titulo || 'Entrenamiento')), h('small', {}, [r.enfoque, `${r.items.length} ejercicios`].filter(Boolean).join(' · ')))),
          h('button', { class: 'agregar', onclick: () => editarRutina(a, { fecha: f, titulo: '', enfoque: '', notas: '', items: [] }, pintar) }, '+ Rutina'));
      })));
  });
  pintar();
}
function navSemana(desde, hasta, ir, derecha) {
  return h('div', { class: 'fila entre', style: 'margin-bottom:12px' },
    h('div', { class: 'fila' },
      h('button', { class: 'btn icono', onclick: () => ir(sumar(desde, -7)), 'aria-label': 'Semana anterior' }, '‹'),
      h('b', {}, `${fechaCorta(desde)} – ${fechaCorta(hasta)}`),
      h('button', { class: 'btn icono', onclick: () => ir(sumar(desde, 7)), 'aria-label': 'Semana siguiente' }, '›'),
      h('button', { class: 'btn chico', onclick: () => ir(lunesDe(hoyISO())) }, 'Hoy')),
    derecha ? h('span', { class: 'sub' }, derecha) : null);
}
function dialogoImprimir(a, d) {
  const desde = h('input', { type: 'date', value: S.semana || lunesDe(hoyISO()) });
  const semanas = selector([[1, '1 semana'], [2, '2 semanas'], [4, '4 semanas (1 mes)']], 4, { vacio: null });
  modal('Imprimir plan de entrenamiento', (cerrar) => [
    h('p', { class: 'sub', style: 'margin-top:0' }, 'Se abre la ventana de impresión: elegí "Guardar como PDF" para enviárselo al alumno.'),
    h('div', { class: 'grid2' }, campo('Desde la semana del', desde), campo('Período', semanas)),
    h('div', { class: 'modal-pie' }, h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', { class: 'btn prim', onclick: () => { cerrar(); imprimirEntrenamiento(a, d.rutinas, lunesDe(desde.value), Number(semanas.value), d); } }, 'Imprimir')),
  ]);
}

function editarRutina(alumno, r, alGuardar) {
  const nueva = !r.id;
  const items = r.items.map((x) => ({ ...x }));
  const fecha = h('input', { type: 'date', value: r.fecha });
  const titulo = h('input', { value: r.titulo || '', placeholder: 'Ej: Entrenamiento 1 – Pierna' });
  const enfoque = selector(ENFOQUES, r.enfoque, { vacio: 'Sin enfoque' });
  const notas = h('textarea', { placeholder: 'Indicaciones generales del día…' }, r.notas || '');
  modal(nueva ? `Nueva rutina · ${alumno.nombre}` : `Rutina · ${fechaLarga(r.fecha)}`, (cerrar) => [
    h('div', { class: 'grid3' }, campo('Fecha', fecha), campo('Título', titulo), campo('Enfoque', enfoque)),
    campo('Notas', notas),
    r.hecha ? h('div', { class: 'card', style: 'margin-bottom:12px;border-color:rgba(61,220,151,.4)' },
      h('b', { style: 'color:var(--ok)' }, '✓ El alumno marcó esta sesión como hecha'),
      r.comentario_alumno ? h('div', { class: 'sub' }, '“' + r.comentario_alumno + '”') : null,
      h('div', { class: 'sub', style: 'margin-top:6px' }, r.items.filter((i) => i.carga_real || i.reps_real).map((i) => `${i.nombre}: ${i.carga_real || '-'} kg × ${i.reps_real || '-'}`).join(' · '))) : null,
    editorItems(items, () => enfoque.value),
    h('div', { class: 'modal-pie' },
      !nueva ? h('button', {
        class: 'btn peligro', style: 'margin-right:auto', onclick: intentar(async () => {
          if (!confirm('¿Eliminar esta rutina?')) return;
          await api('DELETE', '/api/rutinas/' + r.id); cerrar(); toast('Rutina eliminada'); alGuardar();
        }),
      }, 'Eliminar') : null,
      !nueva ? h('button', {
        class: 'btn', onclick: intentar(async () => {
          const f = prompt('Copiar esta rutina a la fecha (AAAA-MM-DD):', sumar(r.fecha, 7));
          if (!f) return;
          await api('POST', `/api/rutinas/${r.id}/copiar`, { fecha: f }); cerrar(); toast('Rutina copiada al ' + fechaCorta(f)); alGuardar();
        }),
      }, 'Copiar a otra fecha') : null,
      h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', {
        class: 'btn prim', onclick: intentar(async () => {
          const d = { alumno_id: alumno.id, fecha: fecha.value, titulo: titulo.value.trim(), enfoque: enfoque.value, notas: notas.value, items };
          if (nueva) await api('POST', '/api/rutinas', d); else await api('PUT', '/api/rutinas/' + r.id, d);
          cerrar(); toast('Rutina guardada'); alGuardar();
        }),
      }, 'Guardar')),
  ], { ancho: true });
}

// Editor reutilizable de lista de ejercicios (rutina o día de plan)
function editorItems(items, getEnfoque) {
  const cont = h('div');
  const pintar = () => {
    cont.replaceChildren(
      h('div', { class: 'card', style: 'padding:6px 12px' },
        items.length ? [
          h('div', { class: 'ej-fila ej-cab' }, h('div', {}, 'Ejercicio'), h('div', {}, 'Series'), h('div', {}, 'Reps'), h('div', {}, 'Desc. (s)'), h('div', {}, 'Carga'), h('div', {}, 'Observaciones'), h('div', {})),
          items.map((it, i) => {
            const inp = (k, ph, extra = {}) => h('input', { value: it[k] ?? '', placeholder: ph, oninput: (e) => (it[k] = e.target.value), ...extra });
            return h('div', { class: 'ej-fila' },
              h('div', { class: 'nom' }, it.nombre, h('small', {}, it.grupo || '')),
              inp('series', 'Series', { inputmode: 'numeric', 'aria-label': 'Series' }), inp('reps', 'Reps', { 'aria-label': 'Repeticiones' }),
              inp('descanso', 'Desc. s', { inputmode: 'numeric', 'aria-label': 'Descanso en segundos' }), inp('carga', 'Carga', { 'aria-label': 'Carga sugerida' }),
              h('div', { class: 'obs' }, inp('obs', 'Observaciones', { 'aria-label': 'Observaciones' })),
              h('div', { class: 'acciones-ej' },
                h('button', { class: 'btn icono chico', title: 'Subir', disabled: i === 0, onclick: () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; pintar(); } }, '↑'),
                h('button', { class: 'btn icono chico', title: 'Bajar', disabled: i === items.length - 1, onclick: () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; pintar(); } }, '↓'),
                h('button', { class: 'btn icono chico peligro', title: 'Quitar', onclick: () => { items.splice(i, 1); pintar(); } }, '✕')));
          }),
        ] : h('div', { class: 'vacio', style: 'padding:16px' }, 'Sin ejercicios todavía')),
      h('button', { class: 'btn', style: 'margin-top:10px', onclick: () => selectorEjercicios(items, pintar, getEnfoque && getEnfoque()) }, '+ Agregar ejercicios'));
  };
  pintar();
  return cont;
}

async function selectorEjercicios(items, alCambiar, enfoque) {
  const lista = await ejercicios();
  const grupos = [...new Set(lista.map((e) => e.grupo))];
  const filtroEnfoque = GRUPOS_ENFOQUE[enfoque];
  let grupo = filtroEnfoque ? '@enfoque' : null;
  const series = h('input', { value: '4', inputmode: 'numeric' }), reps = h('input', { value: '12' }), desc = h('input', { value: '60', inputmode: 'numeric' });
  const buscar = h('input', { placeholder: 'Buscar ejercicio…' });
  const res = h('div', { class: 'selector-lista' }), contador = h('span', { class: 'sub' }), chips = h('div', { class: 'chips' });
  const opciones = [[null, 'Todos'], ...(filtroEnfoque ? [['@enfoque', enfoque]] : []), ...grupos.map((g) => [g, g])];
  const pintarChips = () => chips.replaceChildren(...opciones.map(([v, t]) => h('span', { class: 'chip chip-btn' + (grupo === v ? ' on' : ''), onclick: () => { grupo = v; pintarChips(); pintar(); } }, t)));
  let agregados = 0;
  const pintar = () => {
    const q = sinTildes(buscar.value);
    const f = lista.filter((e) => (!grupo || (grupo === '@enfoque' ? filtroEnfoque.includes(e.grupo) : e.grupo === grupo)) && sinTildes(e.nombre).includes(q)).slice(0, 250);
    res.replaceChildren(...(f.length ? f.map((e) => {
      const el = h('div', {
        class: 'sel-item', onclick: () => {
          items.push({ ejercicio_id: e.id, nombre: e.nombre, grupo: e.grupo, video: e.video, series: series.value, reps: reps.value, descanso: desc.value, carga: '', obs: '' });
          agregados++; contador.textContent = `${agregados} agregado(s)`; el.classList.add('add'); alCambiar();
        },
      }, h('div', {}, e.nombre, h('div', { class: 'sub' }, e.grupo)), chip('+ Agregar', 'acc'));
      return el;
    }) : [h('div', { class: 'vacio' }, 'No hay ejercicios con ese nombre. Podés crearlo en la pestaña Ejercicios.')]));
  };
  buscar.oninput = pintar;
  modal('Agregar ejercicios', (cerrar) => [
    h('p', { class: 'sub', style: 'margin-top:0' }, 'Valores por defecto para los que agregues (después podés editarlos uno por uno):'),
    h('div', { class: 'grid3' }, campo('Series', series), campo('Reps', reps), campo('Descanso (s)', desc)),
    buscar, chips, res,
    h('div', { class: 'modal-pie' }, contador, h('span', { class: 'esp' }), h('button', { class: 'btn prim', onclick: cerrar }, 'Listo')),
  ]);
  pintarChips(); pintar(); buscar.focus();
}

// ---------- alimentación ----------
async function tabAlimentacion(c, a) {
  const [dieta, al, med] = await Promise.all([api('GET', '/api/dieta?alumno=' + a.id), alimentos(), api('GET', '/api/mediciones?alumno=' + a.id)]);
  const cont = h('div');
  c.append(h('div', { class: 'fila acciones-top', style: 'justify-content:flex-end;margin-bottom:12px' },
    h('button', { class: 'btn', onclick: intentar(async () => imprimirDieta(a, await api('GET', '/api/dieta?alumno=' + a.id), al, med)) }, '🖨 Imprimir / PDF')), cont);
  vistaDieta(cont, a, dieta, al, med, {
    editable: true,
    guardar: async (d) => { await api('PUT', '/api/dieta?alumno=' + a.id, d); toast('Plan de alimentación guardado'); },
  });
}

// ---------- progreso ----------
async function tabProgreso(c, a, recargar) {
  const d = await cargarDatos(a.id);
  c.append(
    h('div', { class: 'card' }, h('h2', {}, 'Medidas · inicio vs hoy'), tablaMedidas(a, d.mediciones)),
    h('div', { class: 'card', style: 'margin-top:12px' }, h('h2', {}, 'Control corporal'), seccionControl(a, d.mediciones, { editable: true, recargar })),
    h('div', { class: 'card', style: 'margin-top:12px' }, h('h2', {}, 'Registro fotográfico'), seccionFotos(a, d.fotos, { editable: true, recargar })));
}

// ---------- ficha completa (Datos personales del Clarity) ----------
function tabFicha(c, a, recargar) {
  const u = JSON.parse(JSON.stringify(a)), f = u.ficha;
  f.medidas_inicio ||= {}; f.medidas_meta ||= {}; f.macros_ajuste ||= {}; f.anamnesis ||= {}; f.habitos ||= {}; f.preferencias ||= {}; f.comercial ||= {};
  for (const [k] of ANAMNESIS) f.anamnesis[k] ||= { si: null, cual: '' };
  let pass = '';
  const calcCont = h('div');
  const pintarCalc = () => calcCont.replaceChildren(bloqueCalorias(u, pintarCalc));
  // helpers de enlace
  const inp = (obj, k, attrs = {}) => h('input', { value: obj[k] ?? '', ...attrs, oninput: (e) => { const v = e.target.value; obj[k] = attrs.type === 'number' ? (v === '' ? null : Number(v)) : v; pintarCalc(); } });
  const sel = (obj, k, ops, vacio = '—') => selector(ops, obj[k], { vacio, onchange: (e) => { obj[k] = isNaN(Number(e.target.value)) || e.target.value === '' ? e.target.value : Number(e.target.value); pintarCalc(); finTxt.textContent = fechaFin(); } });
  const fechaFin = () => (f.fecha_inicio && f.duracion ? fechaNum(sumar(f.fecha_inicio, f.duracion * 7)) : '—');
  const finTxt = h('div', { class: 'valor-calc' }, fechaFin());
  const fechaIni = h('input', { type: 'date', value: f.fecha_inicio || '', onchange: (e) => { f.fecha_inicio = e.target.value; finTxt.textContent = fechaFin(); } });
  const activo = h('input', { type: 'checkbox', checked: u.activo, style: 'width:auto', onchange: (e) => (u.activo = e.target.checked) });

  const anam = ANAMNESIS.map(([k, pregunta]) => {
    const q = f.anamnesis[k];
    const cual = h('input', { value: q.cual || '', placeholder: 'Escribí cuál', hidden: q.si !== true, oninput: (e) => (q.cual = e.target.value) });
    const radio = (val, t) => h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'an-' + k, checked: q.si === val, onchange: () => { q.si = val; cual.hidden = val !== true; } }), t);
    return h('div', { class: 'pregunta' }, h('div', {}, pregunta), h('div', { class: 'fila' }, radio(true, 'Sí'), radio(false, 'No'), cual));
  });

  c.append(h('div', { class: 'ficha' },
    h('div', { class: 'card' }, h('h2', {}, 'Identidad'),
      h('div', { class: 'grid2' },
        campo('Nombre del alumno', inp(u, 'nombre')), campo('CI', inp(u, 'ci', { inputmode: 'numeric' })),
        campo('Género', sel(f, 'genero', GENEROS)), campo('Edad', inp(u, 'edad', { type: 'number' })),
        campo('Contacto (teléfono)', inp(u, 'telefono')),
        campo('Nueva contraseña', h('input', { autocomplete: 'off', placeholder: 'vacío = no cambiar', oninput: (e) => (pass = e.target.value) }))),
      h('label', { class: 'fila', style: 'text-transform:none;font-size:14px;color:var(--text)' }, activo, 'Alumno activo (puede ingresar)')),
    h('div', { class: 'card' }, h('h2', {}, 'Datos del programa'),
      h('div', { class: 'grid2' },
        campo('Fecha de inicio', fechaIni), campo('Duración (semanas)', sel(f, 'duracion', DURACIONES)),
        campo('Fecha final', finTxt), campo('Entrenamientos por semana', sel(f, 'frecuencia', FRECUENCIAS)),
        campo('Objetivo', sel(u, 'objetivo', Object.keys(OBJETIVOS))), campo('Nivel', sel(u, 'nivel', NIVELES)),
        campo('Nivel de actividad', sel(f, 'actividad', Object.keys(ACTIVIDAD))), campo('Meta', inp(u, 'meta', { placeholder: 'Ej: llegar a 65 kg' })))),
    h('div', { class: 'card' }, h('h2', {}, 'Medidas iniciales y meta'),
      h('table', { class: 'tabla medidas-form' }, h('thead', {}, h('tr', {}, h('th', {}, 'Medida'), h('th', {}, 'Inicio'), h('th', {}, 'Meta'), h('th', {}, ''))),
        h('tbody', {}, MEDIDAS.map(([k, n, un]) => h('tr', {}, h('td', {}, n),
          h('td', {}, inp(f.medidas_inicio, k, { type: 'number', step: '0.1', inputmode: 'decimal', 'aria-label': n + ' inicio' })),
          h('td', {}, k === 'altura' ? '' : inp(f.medidas_meta, k, { type: 'number', step: '0.1', inputmode: 'decimal', 'aria-label': n + ' meta' })),
          h('td', { class: 'sub' }, un)))))),
    h('div', { class: 'card' }, h('h2', {}, 'Calorías y metas nutricionales'), calcCont),
    h('div', { class: 'card' }, h('h2', {}, 'Anamnesis · historial de salud'), anam),
    h('div', { class: 'card' }, h('h2', {}, 'Hábitos de vida'),
      campo('Nivel de actividad física fuera del entrenamiento', sel(f.habitos, 'actividad', NIV_ACTIVIDAD_HAB)),
      campo('Horas de sueño promedio por noche', sel(f.habitos, 'sueno', SUENO)),
      campo('¿Consume alcohol o fuma?', sel(f.habitos, 'alcohol', ALCOHOL)),
      h('h2', { style: 'margin-top:16px' }, 'Preferencias personales'),
      campo('¿Qué tipo de entrenamiento disfruta más?', inp(f.preferencias, 'tipo', { placeholder: 'fuerza, cardio, funcional, gimnasio, en casa…' })),
      campo('¿Algún ejercicio que NO le guste o no tolere?', inp(f.preferencias, 'no_gusta')),
      campo('¿Cómo le gusta sentir el entrenamiento?', sel(f.preferencias, 'sensacion', SENSACION)),
      campo('¿Cómo se alimenta durante su rutina diaria?', h('textarea', { oninput: (e) => (f.preferencias.alimentacion = e.target.value) }, f.preferencias.alimentacion || ''))),
    h('div', { class: 'card ancho-total' }, h('h2', {}, 'Observaciones'),
      h('div', { class: 'grid2' },
        campo('Observaciones generales (las ve el alumno)', h('textarea', { oninput: (e) => (u.observaciones = e.target.value) }, u.observaciones || '')),
        campo('Notas del entrenador · uso interno', h('textarea', { oninput: (e) => (f.notas_entrenador = e.target.value) }, f.notas_entrenador || ''), 'El alumno no ve estas notas.')))),
  h('div', { class: 'barra-guardar' },
    h('button', { class: 'btn peligro', onclick: intentar(async () => {
      if (!confirm(`¿Eliminar a ${a.nombre} con todas sus rutinas, medidas, fotos y pagos? No se puede deshacer.`)) return;
      await api('DELETE', '/api/alumnos/' + a.id); S.sub = null; toast('Alumno eliminado'); render();
    }) }, 'Eliminar alumno'),
    h('span', { class: 'esp' }),
    h('button', { class: 'btn prim', onclick: intentar(async () => {
      await api('PUT', '/api/alumnos/' + a.id, { ...u, password: pass || null });
      toast('Ficha guardada'); recargar();
    }) }, 'Guardar ficha')));
  pintarCalc();
}
function bloqueCalorias(u, repintar) {
  const f = u.ficha, pesoIni = f.medidas_inicio.peso, cal = calorias(u, pesoIni), mac = macros(u);
  if (!cal) return h('div', { class: 'sub' }, 'Completá género, edad, peso y altura iniciales y el nivel de actividad para calcular las calorías (fórmula Mifflin-St Jeor).');
  const aj = (k) => h('input', { type: 'number', value: f.macros_ajuste[k] ?? '', placeholder: '—', style: 'width:90px', 'aria-label': 'Ajuste',
    onchange: (e) => { f.macros_ajuste[k] = e.target.value === '' ? null : Number(e.target.value); repintar(); } });
  const pct = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  return h('div', {},
    h('div', { class: 'sub', style: 'margin-bottom:10px' }, `Peso ${fmt(pesoIni, 1)} kg · Altura ${fmt(f.medidas_inicio.altura)} cm · ${u.edad} años · ${f.genero}.`),
    h('div', { class: 'stats chicas' },
      h('div', {}, h('div', { class: 'stat-tit' }, 'Calorías base'), h('b', {}, fmt(cal.base))),
      h('div', {}, h('div', { class: 'stat-tit' }, 'Factor actividad'), h('b', {}, cal.factor ? fmt(cal.factor, 2) : '—')),
      h('div', {}, h('div', { class: 'stat-tit' }, 'Calorías ajustadas'), h('b', {}, fmt(cal.ajustadas))),
      h('div', {}, h('div', { class: 'stat-tit' }, 'Ajuste por objetivo'), h('b', {}, OBJETIVOS[u.objetivo] ? pct(cal.ajuste) : '—')),
      h('div', {}, h('div', { class: 'stat-tit' }, 'Meta calórica'), h('b', { class: 'acento' }, cal.meta ? fmt(cal.meta) + ' kcal' : '—')),
      h('div', {}, h('div', { class: 'stat-tit' }, 'Rango de meta'), h('b', {}, cal.min ? `${fmt(cal.min)} a ${fmt(cal.max)}` : '—'))),
    h('table', { class: 'tabla', style: 'margin-top:12px' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Macro'), h('th', {}, 'Sugerido'), h('th', {}, 'Ajuste del entrenador'), h('th', {}, 'Final'))),
      h('tbody', {}, [['prot', 'Proteína (g)'], ['carb', 'Carbohidratos (g)'], ['grasa', 'Grasas (g)']].map(([k, n]) => h('tr', {}, h('td', {}, n), h('td', {}, fmt(mac.sugeridos[k])), h('td', {}, aj(k)), h('td', {}, h('b', {}, fmt(mac.final[k]))))))),
    mac.kcal ? h('div', { class: 'sub', style: 'margin-top:6px' }, `Los macros finales suman ${fmt(mac.kcal)} kcal.`) : null);
}

// ---------- pagos / acuerdo comercial ----------
async function tabPagos(c, a, recargar) {
  const [pagos, canc, rutinas] = await Promise.all([api('GET', '/api/pagos?alumno=' + a.id), api('GET', '/api/cancelaciones?alumno=' + a.id), api('GET', '/api/rutinas?alumno=' + a.id)]);
  const u = JSON.parse(JSON.stringify(a)), co = (u.ficha.comercial ||= {});
  const simb = () => MONEDAS[co.moneda] || '₲';
  const bono = bonoSesiones(u, rutinas);
  const enl = (k, attrs = {}) => h('input', { value: co[k] ?? '', ...attrs, oninput: (e) => (co[k] = attrs.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value) });
  c.append(
    h('div', { class: 'card' }, h('h2', {}, 'Modalidad y tarifa'),
      h('div', { class: 'grid3' },
        campo('Modalidad', selector(MODALIDADES, co.modalidad, { onchange: (e) => (co.modalidad = e.target.value) })),
        campo('Moneda', selector(Object.keys(MONEDAS), co.moneda || 'Paraguay (PYG)', { vacio: null, onchange: (e) => (co.moneda = e.target.value) })),
        campo('Tarifa', enl('tarifa', { type: 'number', inputmode: 'numeric' })),
        campo('Sesiones incluidas en el bono', enl('sesiones_bono', { type: 'number' }), 'Solo para "Bono de sesiones". Se descuentan las sesiones marcadas como hechas.'),
        campo('Renovación o próximo pago', h('input', { type: 'date', value: co.proximo_pago || '', onchange: (e) => (co.proximo_pago = e.target.value) })),
        bono ? campo('Sesiones del bono', h('div', { class: 'valor-calc' }, `${bono.usadas} usadas · ${bono.restantes} restantes`)) : null),
      h('button', { class: 'btn prim', onclick: intentar(async () => { await api('PUT', '/api/alumnos/' + a.id, u); toast('Acuerdo guardado'); recargar(); }) }, 'Guardar')),
    h('div', { class: 'grid-graf' },
      h('div', { class: 'card' }, h('h2', {}, 'Historial de pagos'),
        pagos.length ? h('table', { class: 'tabla' }, h('thead', {}, h('tr', {}, h('th', {}, 'Fecha'), h('th', {}, 'Monto'), h('th', {}, 'Estado'), h('th', {}))),
          h('tbody', {}, pagos.map((p) => h('tr', {}, h('td', {}, fechaNum(p.fecha)), h('td', {}, `${simb()} ${fmt(p.monto)}`), h('td', {}, chip(p.estado, p.estado === 'Pagado' ? 'ok' : 'warn')),
            h('td', {}, p.estado !== 'Pagado' ? h('button', { class: 'btn chico', onclick: intentar(async () => { await api('PUT', '/api/pagos/' + p.id, { ...p, estado: 'Pagado' }); recargar(); }) }, 'Marcar pagado') : null,
              h('button', { class: 'btn icono chico peligro', title: 'Borrar', onclick: intentar(async () => { if (!confirm('¿Borrar este pago?')) return; await api('DELETE', '/api/pagos/' + p.id); recargar(); }) }, '✕')))))) : h('div', { class: 'vacio' }, 'Sin pagos registrados.'),
        h('button', { class: 'btn', style: 'margin-top:10px', onclick: () => formPago(a, co, recargar) }, '+ Registrar pago')),
      h('div', { class: 'card' }, h('h2', {}, 'Cancelaciones de última hora'),
        canc.length ? h('table', { class: 'tabla' }, h('tbody', {}, canc.map((x) => h('tr', {}, h('td', {}, fechaNum(x.fecha)), h('td', {}, x.nota),
          h('td', {}, h('button', { class: 'btn icono chico peligro', onclick: intentar(async () => { await api('DELETE', '/api/cancelaciones/' + x.id); recargar(); }) }, '✕')))))) : h('div', { class: 'vacio' }, 'Sin cancelaciones.'),
        h('button', { class: 'btn', style: 'margin-top:10px', onclick: () => {
          const fe = h('input', { type: 'date', value: hoyISO() }), nota = h('input', { placeholder: 'Motivo' });
          modal('Registrar cancelación', (cerrar) => [h('div', { class: 'grid2' }, campo('Fecha', fe), campo('Nota', nota)),
            h('div', { class: 'modal-pie' }, h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'), h('button', { class: 'btn prim', onclick: intentar(async () => { await api('POST', '/api/cancelaciones', { alumno_id: a.id, fecha: fe.value, nota: nota.value }); cerrar(); recargar(); }) }, 'Guardar'))]);
        } }, '+ Registrar cancelación'))));
}
function formPago(a, co, recargar) {
  const fe = h('input', { type: 'date', value: hoyISO() }), monto = h('input', { type: 'number', value: co.tarifa ?? '' });
  const estado = selector(EST_PAGO, 'Pagado', { vacio: null }), nota = h('input');
  const prox = h('input', { type: 'checkbox', checked: co.modalidad === 'Mensualidad', style: 'width:auto' });
  modal('Registrar pago', (cerrar) => [
    h('div', { class: 'grid2' }, campo('Fecha', fe), campo(`Monto (${MONEDAS[co.moneda] || '₲'})`, monto), campo('Estado', estado), campo('Nota', nota)),
    h('label', { class: 'fila', style: 'text-transform:none;font-size:14px;color:var(--text)' }, prox, 'Mover el próximo pago un mes después de esta fecha'),
    h('div', { class: 'modal-pie' }, h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', { class: 'btn prim', onclick: intentar(async () => {
        await api('POST', '/api/pagos', { alumno_id: a.id, fecha: fe.value, monto: monto.value, estado: estado.value, nota: nota.value });
        if (prox.checked) {
          const d = desdeISO(fe.value); d.setMonth(d.getMonth() + 1);
          const u = JSON.parse(JSON.stringify(a)); u.ficha.comercial = { ...co, proximo_pago: iso(d) };
          await api('PUT', '/api/alumnos/' + a.id, u);
        }
        cerrar(); toast('Pago registrado'); recargar();
      }) }, 'Guardar')),
  ]);
}

// ---------- planes semanales ----------
async function vistaPlanes(main) {
  const planes = await api('GET', '/api/planes');
  main.append(h('div', { class: 'cab' },
    h('div', {}, h('h1', {}, 'Planes semanales'), h('div', { class: 'sub' }, 'Plantillas reutilizables: armalas una vez y asignalas a uno o varios alumnos.')),
    h('button', { class: 'btn prim', onclick: () => editarPlan() }, '+ Nuevo plan')),
  h('div', { class: 'lista' }, planes.length ? planes.map((p) => h('div', { class: 'card fila entre' },
    h('div', { class: 'item-click', onclick: () => editarPlan(p) }, h('h3', {}, p.nombre),
      h('div', { class: 'sub' }, p.dias.map((d) => (d.dia_semana != null ? DIAS_C[d.dia_semana] + ': ' : '') + d.titulo + (d.enfoque ? ` · ${d.enfoque}` : '') + ` (${d.items.length})`).join('  |  ')),
      p.descripcion ? h('div', { class: 'sub' }, p.descripcion) : null),
    h('div', { class: 'fila' },
      h('button', { class: 'btn', onclick: () => editarPlan(p) }, 'Editar'),
      h('button', { class: 'btn', onclick: () => editarPlan({ ...p, id: null, nombre: p.nombre + ' (copia)' }) }, 'Duplicar'),
      h('button', { class: 'btn prim', onclick: () => asignarPlan([], lunesDe(hoyISO()), p.id) }, 'Asignar')))) :
    h('div', { class: 'vacio' }, 'Todavía no hay planes. Creá uno, por ejemplo “Full body 3 días” o “Torso / Pierna”.')));
}
function editarPlan(p) {
  const nuevo = !p || !p.id;
  p = p ? JSON.parse(JSON.stringify(p)) : { nombre: '', descripcion: '', dias: [{ titulo: 'Entrenamiento 1', enfoque: '', dia_semana: 0, items: [] }] };
  const nombre = h('input', { value: p.nombre, placeholder: 'Ej: Hipertrofia 4 días – Semana A' });
  const desc = h('textarea', { placeholder: 'Indicaciones generales del plan…' }, p.descripcion || '');
  const diasCont = h('div');
  const pintar = () => diasCont.replaceChildren(...p.dias.map((d, i) => h('div', { class: 'dia-plan' },
    h('div', { class: 'fila', style: 'margin-bottom:10px' },
      h('input', { value: d.titulo, style: 'flex:2;min-width:160px', 'aria-label': 'Nombre del día', oninput: (e) => (d.titulo = e.target.value) }),
      selector(DIAS.map((n, k) => [k, n]), d.dia_semana, { vacio: 'Día libre (en orden)', attrs: { style: 'flex:1;min-width:120px', 'aria-label': 'Día de la semana' }, onchange: (e) => (d.dia_semana = e.target.value === '' ? null : Number(e.target.value)) }),
      selector(ENFOQUES, d.enfoque, { vacio: 'Sin enfoque', attrs: { style: 'flex:1;min-width:140px', 'aria-label': 'Enfoque' }, onchange: (e) => (d.enfoque = e.target.value) }),
      h('button', { class: 'btn icono peligro', title: 'Quitar día', onclick: () => { if (confirm('¿Quitar ' + d.titulo + '?')) { p.dias.splice(i, 1); pintar(); } } }, '✕')),
    editorItems(d.items, () => d.enfoque))));
  pintar();
  modal(nuevo ? 'Nuevo plan semanal' : 'Editar plan', (cerrar) => [
    campo('Nombre del plan', nombre), campo('Descripción', desc),
    h('h2', { style: 'margin-top:8px' }, 'Días de entrenamiento'), diasCont,
    h('button', {
      class: 'btn', onclick: () => {
        const usados = p.dias.map((d) => d.dia_semana);
        const sig = [0, 1, 2, 3, 4, 5, 6].find((k) => !usados.includes(k));
        p.dias.push({ titulo: 'Entrenamiento ' + (p.dias.length + 1), enfoque: '', dia_semana: sig ?? null, items: [] }); pintar();
      },
    }, '+ Agregar día'),
    h('div', { class: 'modal-pie' },
      !nuevo ? h('button', {
        class: 'btn peligro', style: 'margin-right:auto', onclick: intentar(async () => {
          if (!confirm('¿Eliminar el plan? Las rutinas ya asignadas a alumnos se mantienen.')) return;
          await api('DELETE', '/api/planes/' + p.id); cerrar(); toast('Plan eliminado'); render();
        }),
      }, 'Eliminar') : null,
      h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', {
        class: 'btn prim', onclick: intentar(async () => {
          const d = { nombre: nombre.value, descripcion: desc.value, dias: p.dias };
          if (nuevo) await api('POST', '/api/planes', d); else await api('PUT', '/api/planes/' + p.id, d);
          cerrar(); toast('Plan guardado'); render();
        }),
      }, 'Guardar plan')),
  ], { ancho: true });
}
async function asignarPlan(alumnosPre, lunes, planPre) {
  const [planes, alumnosL] = await Promise.all([api('GET', '/api/planes'), api('GET', '/api/alumnos')]);
  if (!planes.length) return toast('Primero creá un plan en la pestaña Planes', true);
  const plan = selector(planes.map((p) => [p.id, p.nombre]), planPre, { vacio: null });
  const desde = h('input', { type: 'date', value: lunes });
  const semanas = h('input', { type: 'number', min: 1, max: 16, value: 4 });
  const reemplazar = h('input', { type: 'checkbox', style: 'width:auto' });
  const marcados = new Set(alumnosPre);
  const listaAl = h('div', { class: 'selector-lista', style: 'max-height:240px' }, alumnosL.filter((a) => a.activo).map((a) =>
    h('label', { class: 'sel-item', style: 'text-transform:none;font-size:14px;color:var(--text);margin:0' },
      h('span', {}, a.nombre, h('span', { class: 'sub' }, '  CI ' + a.ci)),
      h('input', { type: 'checkbox', style: 'width:auto', checked: marcados.has(a.id), onchange: (e) => (e.target.checked ? marcados.add(a.id) : marcados.delete(a.id)) }))));
  modal('Asignar plan semanal', (cerrar) => [
    campo('Plan', plan),
    h('div', { class: 'grid2' }, campo('Semana que empieza (se toma el lunes)', desde), campo('Repetir durante (semanas)', semanas)),
    campo('Alumnos', listaAl),
    h('label', { class: 'fila', style: 'text-transform:none;font-size:14px;color:var(--text)' }, reemplazar, 'Reemplazar rutinas que ya existan en esos días'),
    h('div', { class: 'modal-pie' }, h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', {
        class: 'btn prim', onclick: intentar(async () => {
          const r = await api('POST', `/api/planes/${plan.value}/asignar`, { alumnos: [...marcados], lunes: desde.value, semanas: semanas.value, reemplazar: reemplazar.checked });
          cerrar(); toast(`Listo: ${r.creadas} sesiones asignadas`); S.semana = lunesDe(desde.value); render();
        }),
      }, 'Asignar')),
  ]);
}

// ---------- catálogo de ejercicios ----------
async function vistaEjercicios(main) {
  const lista = await ejercicios(true);
  const grupos = [...new Set(lista.map((e) => e.grupo))];
  let grupo = null;
  const buscar = h('input', { placeholder: 'Buscar…', style: 'max-width:260px' });
  const chips = h('div', { class: 'chips' }), cont = h('div', { class: 'card', style: 'padding:0' });
  const pintar = () => {
    chips.replaceChildren(...[null, ...grupos].map((g) => h('span', { class: 'chip chip-btn' + (grupo === g ? ' on' : ''), onclick: () => { grupo = g; pintar(); } }, g || 'Todos')));
    const q = sinTildes(buscar.value);
    const f = lista.filter((e) => (!grupo || e.grupo === grupo) && sinTildes(e.nombre).includes(q));
    cont.replaceChildren(...(f.length ? f.map((e) => h('div', { class: 'sel-item', onclick: () => formEjercicio(e, grupos) },
      h('div', {}, e.nombre, h('div', { class: 'sub' }, e.grupo)),
      e.video ? h('a', { href: e.video, target: '_blank', rel: 'noopener', class: 'btn chico', onclick: (ev) => ev.stopPropagation() }, '▶ Video') : h('span', { class: 'sub' }, 'sin video'))) : [h('div', { class: 'vacio' }, 'Sin resultados')]));
  };
  buscar.oninput = pintar;
  main.append(h('div', { class: 'cab' }, h('div', {}, h('h1', {}, 'Catálogo de ejercicios'), h('div', { class: 'sub' }, `${lista.length} ejercicios con video de referencia`)),
    h('div', { class: 'fila' }, buscar, h('button', { class: 'btn prim', onclick: () => formEjercicio(null, grupos) }, '+ Nuevo'))), chips, cont);
  pintar();
}
function formEjercicio(e, grupos) {
  const nuevo = !e; e ||= { nombre: '', grupo: '', video: '' };
  const nombre = h('input', { value: e.nombre }), grupo = h('input', { value: e.grupo, list: 'grupos-dl' });
  const video = h('input', { value: e.video, placeholder: 'https://www.youtube.com/…' });
  modal(nuevo ? 'Nuevo ejercicio' : 'Editar ejercicio', (cerrar) => [
    campo('Nombre', nombre), campo('Grupo muscular', grupo), h('datalist', { id: 'grupos-dl' }, grupos.map((g) => h('option', { value: g }))),
    campo('Link del video', video),
    h('div', { class: 'modal-pie' },
      !nuevo ? h('button', { class: 'btn peligro', style: 'margin-right:auto', onclick: intentar(async () => {
        if (!confirm('¿Eliminar este ejercicio del catálogo? Las rutinas ya asignadas no cambian.')) return;
        await api('DELETE', '/api/ejercicios/' + e.id); cerrar(); render();
      }) }, 'Eliminar') : null,
      h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', { class: 'btn prim', onclick: intentar(async () => {
        const d = { nombre: nombre.value, grupo: grupo.value, video: video.value };
        if (nuevo) await api('POST', '/api/ejercicios', d); else await api('PUT', '/api/ejercicios/' + e.id, d);
        cerrar(); toast('Ejercicio guardado'); render();
      }) }, 'Guardar')),
  ]);
}

// ---------- catálogo de alimentos ----------
async function vistaAlimentos(main) {
  const lista = await alimentos(true);
  let grupo = null;
  const buscar = h('input', { placeholder: 'Buscar…', style: 'max-width:260px' });
  const chips = h('div', { class: 'chips' }), cont = h('div', { class: 'card tabla-scroll', style: 'padding:0' });
  const pintar = () => {
    chips.replaceChildren(...[null, ...GRUPOS_ALIMENTO].map((g) => h('span', { class: 'chip chip-btn' + (grupo === g ? ' on' : ''), onclick: () => { grupo = g; pintar(); } }, g || 'Todos')));
    const q = sinTildes(buscar.value);
    const f = lista.filter((e) => (!grupo || e.grupo === grupo) && sinTildes(e.nombre).includes(q));
    cont.replaceChildren(f.length ? h('table', { class: 'tabla clic' },
      h('thead', {}, h('tr', {}, ['Alimento', 'Grupo', 'Porción', 'kcal', 'Prot', 'Carb', 'Grasa'].map((t) => h('th', {}, t)))),
      h('tbody', {}, f.map((e) => h('tr', { onclick: () => formAlimento(e) },
        h('td', {}, e.nombre, e.nota ? h('div', { class: 'sub' }, e.nota) : null), h('td', {}, e.grupo), h('td', {}, `${fmt(e.porcion, e.porcion % 1 ? 1 : 0)} ${e.unidad}`),
        h('td', {}, fmt(e.kcal)), h('td', {}, fmt(e.prot, 1)), h('td', {}, fmt(e.carb, 1)), h('td', {}, fmt(e.grasa, 1)))))) : h('div', { class: 'vacio' }, 'Sin resultados'));
  };
  buscar.oninput = pintar;
  main.append(h('div', { class: 'cab' }, h('div', {}, h('h1', {}, 'Catálogo de alimentos'), h('div', { class: 'sub' }, `${lista.length} alimentos · valores por porción base`)),
    h('div', { class: 'fila' }, buscar, h('button', { class: 'btn prim', onclick: () => formAlimento(null) }, '+ Nuevo'))), chips, cont);
  pintar();
}
function formAlimento(e) {
  const nuevo = !e; e ||= { nombre: '', grupo: GRUPOS_ALIMENTO[0], porcion: 100, unidad: 'g', kcal: '', prot: '', carb: '', grasa: '', nota: '' };
  const f = {};
  const inp = (k, attrs = {}) => (f[k] = h('input', { value: e[k] ?? '', ...attrs }));
  modal(nuevo ? 'Nuevo alimento' : 'Editar alimento', (cerrar) => [
    campo('Alimento', inp('nombre')),
    h('div', { class: 'grid3' }, campo('Grupo', (f.grupo = selector(GRUPOS_ALIMENTO, e.grupo, { vacio: null }))), campo('Porción base', inp('porcion', { type: 'number', step: 'any' })),
      campo('Unidad', inp('unidad', { list: 'unidades-dl' }), 'g, ml, unidad, rebanada, cucharada…')),
    h('datalist', { id: 'unidades-dl' }, ['g', 'ml', 'unidad', 'rebanada', 'cucharada'].map((u) => h('option', { value: u }))),
    h('div', { class: 'grid3' }, campo('Energía (kcal)', inp('kcal', { type: 'number', step: 'any' })), campo('Proteína (g)', inp('prot', { type: 'number', step: 'any' })),
      campo('Carbohidratos (g)', inp('carb', { type: 'number', step: 'any' })), campo('Grasa (g)', inp('grasa', { type: 'number', step: 'any' }))),
    campo('Nota de equivalencia', inp('nota')),
    h('div', { class: 'modal-pie' },
      !nuevo ? h('button', { class: 'btn peligro', style: 'margin-right:auto', onclick: intentar(async () => {
        if (!confirm('¿Eliminar este alimento? Si está en algún menú, esa línea quedará vacía.')) return;
        await api('DELETE', '/api/alimentos/' + e.id); cerrar(); render();
      }) }, 'Eliminar') : null,
      h('button', { class: 'btn', onclick: cerrar }, 'Cancelar'),
      h('button', { class: 'btn prim', onclick: intentar(async () => {
        const d = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value]));
        if (nuevo) await api('POST', '/api/alimentos', d); else await api('PUT', '/api/alimentos/' + e.id, d);
        cerrar(); toast('Alimento guardado'); S.alimentos = null; render();
      }) }, 'Guardar')),
  ]);
}

// ---------- ajustes: marca del entrenador ----------
function vistaAjustes(main) {
  const c = { ...S.config };
  const inp = (k, ph) => h('input', { value: c[k] || '', placeholder: ph || '', oninput: (e) => (c[k] = e.target.value) });
  const prev = h('div', { class: 'logo-prev' }, c.logo ? h('img', { src: c.logo, alt: 'Logo' }) : h('span', { class: 'sub' }, 'Sin logo'));
  const archivo = h('input', { type: 'file', accept: 'image/*', onchange: intentar(async (e) => {
    if (!e.target.files[0]) return;
    c.logo = await imagenADataURL(e.target.files[0], 400, 0.9); prev.replaceChildren(h('img', { src: c.logo, alt: 'Logo' }));
  }) });
  main.append(h('div', { class: 'cab' }, h('div', {}, h('h1', {}, 'Ajustes'), h('div', { class: 'sub' }, `${S.usuario.nombre} · CI ${S.usuario.ci}`))),
    h('div', { class: 'grid-graf' },
      h('div', { class: 'card' }, h('h2', {}, 'Tu marca'), h('p', { class: 'sub', style: 'margin-top:-4px' }, 'Aparece en la app y en los PDF de entrenamiento y alimentación.'),
        campo('Logo', h('div', { class: 'fila' }, prev, archivo)),
        h('div', { class: 'grid2' }, campo('Nombre de la empresa', inp('empresa')), campo('Entrenador', inp('entrenador', 'Ej: Carlos Fabián Areco')),
          campo('Contacto', inp('contacto', 'Teléfono o email')), campo('Instagram', inp('instagram', '@usuario'))),
        h('div', { class: 'fila' },
          h('button', { class: 'btn prim', onclick: intentar(async () => { await api('PUT', '/api/config', c); S.configCargada = false; toast('Marca guardada'); render(); }) }, 'Guardar'),
          c.logo ? h('button', { class: 'btn', onclick: () => { c.logo = ''; prev.replaceChildren(h('span', { class: 'sub' }, 'Sin logo')); } }, 'Quitar logo') : null)),
      h('div', { class: 'lista' }, formPassword(), h('button', { class: 'btn peligro', onclick: () => salir() }, 'Cerrar sesión'))));
}
