'use strict';
// ================= ALUMNO =================
async function vistaSemanaAlumno(main) {
  S.semana ||= lunesDe(hoyISO());
  const desde = S.semana, hasta = sumar(desde, 6), hoy = hoyISO();
  const [rutinas, todas] = await Promise.all([api('GET', `/api/rutinas?desde=${desde}&hasta=${hasta}`), api('GET', '/api/rutinas')]);
  const deHoy = rutinas.filter((r) => r.fecha === hoy);
  const hechas = rutinas.filter((r) => r.hecha).length;
  const prog = programa(S.usuario, hoy), adh = adherencia(todas, hoy);
  main.append(
    h('div', { class: 'cab' }, h('div', {}, h('h1', {}, `Hola, ${S.usuario.nombre.split(' ')[0]}`), h('div', { class: 'sub' }, fechaLarga(hoy))),
      h('div', { class: 'fila' }, prog ? chip(`Semana ${prog.semana} de ${prog.total}`, 'acc') : null, adh.pct != null ? chip(`Adherencia ${Math.round(adh.pct * 100)}%`, 'ok') : null)),
    S.usuario.observaciones ? h('div', { class: 'card', style: 'margin-bottom:14px' }, h('div', { class: 'stat-tit' }, 'Indicaciones de tu entrenador'), h('div', { class: 'pre' }, S.usuario.observaciones)) : null,
    deHoy.length ? h('div', { class: 'lista', style: 'margin-bottom:22px' }, deHoy.map((r) => tarjetaRutina(r))) :
      h('div', { class: 'card', style: 'margin-bottom:22px' }, h('h3', {}, 'Hoy no tenés entrenamiento asignado'), h('div', { class: 'sub' }, 'Descansá o revisá tu semana abajo.')),
    h('div', { class: 'fila entre', style: 'margin-bottom:10px' },
      h('div', { class: 'fila' },
        h('button', { class: 'btn icono', onclick: () => { S.semana = sumar(S.semana, -7); render(); }, 'aria-label': 'Semana anterior' }, '‹'),
        h('b', {}, `${fechaCorta(desde)} – ${fechaCorta(hasta)}`),
        h('button', { class: 'btn icono', onclick: () => { S.semana = sumar(S.semana, 7); render(); }, 'aria-label': 'Semana siguiente' }, '›')),
      h('div', { class: 'fila' }, rutinas.length ? h('span', { class: 'sub' }, `${hechas}/${rutinas.length} hechas`) : null,
        h('button', { class: 'btn chico', onclick: intentar(async () => imprimirEntrenamiento(S.usuario, todas, desde, 4, { rutinas: todas })) }, '🖨 PDF'))),
    rutinas.length ? h('div', { class: 'progreso', style: 'margin-bottom:14px' }, h('div', { style: `width:${(hechas / rutinas.length) * 100}%` })) : null,
    h('div', { class: 'semana' }, DIAS_C.map((dn, i) => {
      const f = sumar(desde, i), delDia = rutinas.filter((r) => r.fecha === f);
      return h('div', { class: 'dia' + (f === hoy ? ' hoy' : '') },
        h('div', { class: 'dia-cab' }, h('span', {}, dn), h('b', {}, desdeISO(f).getDate())),
        delDia.length ? delDia.map((r) => h('div', { class: 'rut' + (r.hecha ? ' hecha' : ''), onclick: () => verRutina(r) },
          h('div', {}, (r.hecha ? '✓ ' : '') + (r.titulo || 'Entrenamiento')), h('small', {}, [r.enfoque, `${r.items.length} ejercicios`].filter(Boolean).join(' · ')))) :
          h('div', { class: 'sub', style: 'font-size:12px' }, 'Descanso'));
    })));
}

function tarjetaRutina(r) {
  return h('div', { class: 'card item-click', onclick: () => verRutina(r) },
    h('div', { class: 'fila entre' }, h('div', {}, h('div', { class: 'sub' }, 'Entrenamiento de hoy' + (r.enfoque ? ' · ' + r.enfoque : '')), h('h2', { style: 'margin:2px 0 0' }, r.titulo || 'Entrenamiento')),
      r.hecha ? chip('✓ Hecho', 'ok') : h('button', { class: 'btn prim' }, 'Empezar')),
    h('div', { class: 'sub', style: 'margin-top:8px' }, r.items.map((i) => i.nombre).join(' · ')));
}

function verRutina(r) {
  const items = r.items.map((x) => ({ ...x }));
  const coment = h('textarea', { placeholder: '¿Cómo te sentiste? (opcional)' }, r.comentario_alumno || '');
  const lista = h('div');
  const pintar = () => lista.replaceChildren(...items.map((it, i) => h('div', { class: 'ejercicio' + (it.ok ? ' ok' : '') },
    h('div', { class: 'num' }, it.ok ? '✓' : i + 1),
    h('div', {},
      h('div', { class: 'fila entre' }, h('h3', {}, it.nombre),
        it.video ? h('a', { class: 'btn chico', href: it.video, target: '_blank', rel: 'noopener' }, '▶ Ver video') : null),
      h('div', { class: 'metricas' },
        it.series ? h('span', {}, h('b', {}, it.series), ' series') : null,
        it.reps ? h('span', {}, h('b', {}, it.reps), ' reps') : null,
        it.descanso ? h('span', {}, h('b', {}, it.descanso), /^\d+$/.test(it.descanso) ? ' s descanso' : ' descanso') : null,
        it.carga ? h('span', {}, h('b', {}, it.carga), ' carga sugerida') : null),
      it.obs ? h('div', { class: 'sub', style: 'margin-top:4px;color:var(--warn)' }, it.obs) : null,
      h('div', { class: 'registro' },
        campo('Carga usada (kg)', h('input', { value: it.carga_real, inputmode: 'decimal', oninput: (e) => (it.carga_real = e.target.value) })),
        campo('Reps hechas', h('input', { value: it.reps_real, oninput: (e) => (it.reps_real = e.target.value) })),
        h('label', { class: 'check', style: 'margin-bottom:12px;text-transform:none;letter-spacing:0' },
          h('input', { type: 'checkbox', checked: it.ok, onchange: (e) => { it.ok = e.target.checked; pintar(); } }), 'Hecho'))))));
  pintar();
  const guardar = async (hecha) => {
    await api('PUT', '/api/rutinas/' + r.id, { items, hecha, comentario_alumno: coment.value });
    toast(hecha ? '¡Sesión completada! 💪' : 'Progreso guardado'); render();
  };
  modal(`${r.titulo || 'Entrenamiento'} · ${fechaLarga(r.fecha)}`, (cerrar) => [
    r.notas ? h('div', { class: 'card pre', style: 'margin-bottom:10px' }, r.notas) : null,
    lista,
    campo('Comentario para tu entrenador', coment),
    h('div', { class: 'modal-pie' },
      h('button', { class: 'btn', onclick: intentar(async () => { await guardar(r.hecha); cerrar(); }) }, 'Guardar progreso'),
      r.hecha ? h('button', { class: 'btn', onclick: intentar(async () => { await guardar(false); cerrar(); }) }, 'Marcar como no hecha') :
        h('button', { class: 'btn prim', onclick: intentar(async () => { items.forEach((i) => (i.ok = true)); await guardar(true); cerrar(); }) }, '✓ Terminé la sesión')),
  ], { ancho: true });
}

async function vistaComidaAlumno(main) {
  const [dieta, al, med] = await Promise.all([api('GET', '/api/dieta'), alimentos(), api('GET', '/api/mediciones')]);
  const vacia = !(dieta.entreno || []).some((c) => c.items && c.items.length) && !(dieta.descanso || []).some((c) => c.items && c.items.length);
  const cont = h('div');
  main.append(h('div', { class: 'cab' }, h('div', {}, h('h1', {}, 'Tu plan de alimentación'), h('div', { class: 'sub' }, 'Armado por tu entrenador')),
    !vacia ? h('button', { class: 'btn', onclick: () => imprimirDieta(S.usuario, dieta, al, med) }, '🖨 PDF') : null), cont);
  if (vacia) cont.append(h('div', { class: 'card vacio' }, 'Tu entrenador todavía no cargó tu plan de alimentación.'));
  else vistaDieta(cont, S.usuario, dieta, al, med, { editable: false });
}

async function vistaProgresoAlumno(main) {
  const d = await cargarDatos(null);
  main.append(h('div', { class: 'cab' }, h('div', {}, h('h1', {}, 'Tu progreso'), h('div', { class: 'sub' }, S.usuario.objetivo || ''))),
    bloqueResumen(S.usuario, d, { entrenador: false }),
    h('div', { class: 'card', style: 'margin-top:12px' }, h('h2', {}, 'Tus medidas'), tablaMedidas(S.usuario, d.mediciones)),
    h('div', { class: 'card', style: 'margin-top:12px' }, h('h2', {}, 'Antes y ahora'), seccionFotos(S.usuario, d.fotos, { editable: false })));
}

async function vistaHistorial(main) {
  const rutinas = (await api('GET', `/api/rutinas?hasta=${hoyISO()}`)).reverse();
  main.append(h('div', { class: 'cab' }, h('div', {}, h('h1', {}, 'Historial'),
    h('div', { class: 'sub' }, `${rutinas.filter((r) => r.hecha).length} de ${rutinas.length} sesiones completadas`))),
  h('div', { class: 'lista' }, rutinas.length ? rutinas.map((r) => h('div', { class: 'card item-click fila entre', onclick: () => verRutina(r) },
    h('div', {}, h('h3', {}, r.titulo || 'Entrenamiento'), h('div', { class: 'sub' }, fechaLarga(r.fecha) + ` · ${r.items.length} ejercicios`)),
    r.hecha ? chip('✓ Hecha', 'ok') : chip('No registrada', 'off'))) :
    h('div', { class: 'vacio' }, 'Todavía no hay sesiones pasadas.')));
}

function vistaCuenta(main) {
  const u = S.usuario, f = fichaDe(u), mi = f.medidas_inicio || {};
  const datos = [['Objetivo', u.objetivo], ['Nivel', u.nivel], ['Meta', u.meta], ['Edad', u.edad && u.edad + ' años'], ['Peso inicial', mi.peso && mi.peso + ' kg'], ['Altura', mi.altura && mi.altura + ' cm'],
    ['Inicio del programa', f.fecha_inicio && fechaNum(f.fecha_inicio)], ['Duración', f.duracion && f.duracion + ' semanas'], ['Frecuencia', f.frecuencia && f.frecuencia + ' entrenamientos por semana']].filter((x) => x[1]);
  const c = S.config;
  main.append(h('div', { class: 'cab' }, h('div', {}, h('h1', {}, u.nombre), h('div', { class: 'sub' }, `CI ${u.ci}`))),
    h('div', { class: 'grid-graf' },
      h('div', { class: 'lista' },
        datos.length ? h('div', { class: 'card' }, h('h2', {}, 'Mis datos'), h('div', { class: 'grid2' }, datos.map(([k, v]) => h('div', { class: 'campo' }, h('label', {}, k), h('div', {}, v))))) : null,
        c.entrenador || c.contacto || c.instagram ? h('div', { class: 'card' }, h('h2', {}, 'Tu entrenador'),
          c.entrenador ? h('div', {}, c.entrenador) : null, c.contacto ? h('div', { class: 'sub' }, 'Contacto: ' + c.contacto) : null,
          c.instagram ? h('div', { class: 'sub' }, 'Instagram: ' + c.instagram) : null) : null),
      h('div', { class: 'lista' }, formPassword(), h('button', { class: 'btn peligro', onclick: () => salir() }, 'Cerrar sesión'))));
}

render();
