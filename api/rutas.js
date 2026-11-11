// API de la App de Entrenamiento (Postgres / Supabase).
// La usan el servidor local (server.js) y la función de Netlify (netlify/functions/api.mjs).
import crypto from 'node:crypto';
import postgres from 'postgres';

let _sql;
function sql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('Falta la variable DATABASE_URL (conexión a Supabase)');
    _sql = postgres(process.env.DATABASE_URL, {
      prepare: false, // necesario con el pooler de Supabase (modo transacción)
      max: 3, idle_timeout: 20, connect_timeout: 15,
      types: { date: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x } }, // fechas como 'AAAA-MM-DD'
    });
  }
  return _sql;
}

// ---------- utilidades ----------
const limpiarCI = (ci) => String(ci || '').replace(/\D/g, '');
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const txt = (v, n = 300) => (v == null ? '' : String(v).slice(0, n));
const num = (v) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v));
export function hash(pass) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pass), salt, 32).toString('hex');
}
function verificar(pass, stored) {
  const [salt, h] = String(stored).split(':');
  const calc = crypto.scryptSync(String(pass), salt, 32).toString('hex');
  return h && h.length === calc.length && crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(calc, 'hex'));
}
const MEDIDAS = ['peso', 'altura', 'cuello', 'pecho', 'biceps_izq', 'biceps_der', 'abdomen_bajo', 'cintura', 'caderas', 'muslo_izq', 'muslo_der', 'pantorrilla_izq', 'pantorrilla_der'];

class ErrorHttp extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const falla = (status, msg) => { throw new ErrorHttp(status, msg); };

function publico(u, paraAlumno) {
  if (!u) return u;
  const { pass_hash, ...r } = u;
  r.ficha = r.ficha || {};
  if (paraAlumno) { r.ficha = { ...r.ficha }; delete r.ficha.notas_entrenador; }
  return r;
}
const alumnoObjetivo = (u, id) => (u.rol === 'alumno' ? u.id : Number(id) || 0);
function sumarDias(fechaISO, n) {
  const d = new Date(fechaISO + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
async function limpiarItems(items) {
  if (!Array.isArray(items)) return [];
  items = items.filter((i) => i && (i.ejercicio_id || i.nombre)).slice(0, 40);
  const ids = items.map((i) => Number(i.ejercicio_id)).filter(Boolean);
  const ejs = ids.length ? await sql()`select * from ejercicios where id = any(${ids})` : [];
  return items.map((i) => {
    const ej = ejs.find((e) => e.id === Number(i.ejercicio_id));
    return {
      ejercicio_id: ej ? ej.id : null, nombre: ej ? ej.nombre : txt(i.nombre, 200), grupo: ej ? ej.grupo : txt(i.grupo, 60), video: ej ? ej.video : txt(i.video, 500),
      series: txt(i.series, 20), reps: txt(i.reps, 30), descanso: txt(i.descanso, 20), carga: txt(i.carga, 30), obs: txt(i.obs),
      carga_real: txt(i.carga_real, 30), reps_real: txt(i.reps_real, 30), ok: !!i.ok,
    };
  });
}
function limpiarFicha(f) {
  f = f && typeof f === 'object' ? f : {};
  const obj = (o) => (o && typeof o === 'object' ? o : {});
  const medidas = (o) => Object.fromEntries(MEDIDAS.map((k) => [k, num(obj(o)[k])]));
  const sino = (o) => ({ si: obj(o).si === true ? true : obj(o).si === false ? false : null, cual: txt(obj(o).cual) });
  const an = obj(f.anamnesis), ha = obj(f.habitos), pr = obj(f.preferencias), co = obj(f.comercial), ma = obj(f.macros_ajuste);
  return {
    genero: txt(f.genero, 20), fecha_inicio: esFecha(f.fecha_inicio) ? f.fecha_inicio : '',
    duracion: num(f.duracion), frecuencia: num(f.frecuencia), actividad: txt(f.actividad, 40),
    medidas_inicio: medidas(f.medidas_inicio), medidas_meta: medidas(f.medidas_meta),
    macros_ajuste: { prot: num(ma.prot), carb: num(ma.carb), grasa: num(ma.grasa) },
    anamnesis: Object.fromEntries(['cronica', 'condicion', 'medicacion', 'cirugia', 'lesion', 'suplementos'].map((k) => [k, sino(an[k])])),
    habitos: { actividad: txt(ha.actividad, 40), sueno: txt(ha.sueno, 40), alcohol: txt(ha.alcohol, 40) },
    preferencias: { tipo: txt(pr.tipo, 500), no_gusta: txt(pr.no_gusta, 500), sensacion: txt(pr.sensacion, 60), alimentacion: txt(pr.alimentacion, 800) },
    comercial: { modalidad: txt(co.modalidad, 40), moneda: txt(co.moneda, 40), tarifa: num(co.tarifa), sesiones_bono: num(co.sesiones_bono), proximo_pago: esFecha(co.proximo_pago) ? co.proximo_pago : '' },
    notas_entrenador: txt(f.notas_entrenador, 3000),
  };
}
function limpiarDieta(d) {
  d = d && typeof d === 'object' ? d : {};
  const menu = (m) => (Array.isArray(m) ? m : []).slice(0, 6).map((comida) => ({
    nombre: txt(comida && comida.nombre, 60),
    items: (Array.isArray(comida && comida.items) ? comida.items : []).slice(0, 12).filter((i) => i && i.alimento_id).map((i) => ({ alimento_id: Number(i.alimento_id), cantidad: num(i.cantidad) })),
  }));
  return {
    comidas: Math.min(Math.max(Number(d.comidas) || 4, 3), 6), entreno: menu(d.entreno), descanso: menu(d.descanso),
    suplementos: (Array.isArray(d.suplementos) ? d.suplementos : []).slice(0, 15).map((s) => ({ nombre: txt(s.nombre, 100), marca: txt(s.marca, 100), dosis: txt(s.dosis, 200) })).filter((s) => s.nombre),
    notas: txt(d.notas, 3000),
  };
}

// ---------- rutas ----------
const rutas = [];
const ruta = (metodo, patron, rol, fn) => rutas.push({ metodo, re: new RegExp('^' + patron.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), rol, fn });
const OK = { ok: true };

ruta('POST', '/api/login', null, async ({ b }) => {
  const [u] = await sql()`select * from usuarios where ci = ${limpiarCI(b.ci)} and activo`;
  if (!u || !verificar(b.password || '', u.pass_hash)) falla(401, 'CI o contraseña incorrecta');
  const token = crypto.randomBytes(24).toString('hex');
  await sql()`insert into sesiones (token, usuario_id) values (${token}, ${u.id})`;
  return { token, usuario: publico(u, u.rol === 'alumno') };
});
ruta('POST', '/api/logout', 'any', async ({ token }) => { await sql()`delete from sesiones where token = ${token}`; return OK; });
ruta('GET', '/api/yo', 'any', async ({ u }) => publico(u, u.rol === 'alumno'));
ruta('POST', '/api/cambiar-password', 'any', async ({ b, u }) => {
  if (!verificar(b.actual || '', u.pass_hash)) falla(400, 'La contraseña actual no coincide');
  if (!b.nueva || String(b.nueva).length < 4) falla(400, 'La nueva contraseña debe tener al menos 4 caracteres');
  await sql()`update usuarios set pass_hash = ${hash(b.nueva)} where id = ${u.id}`;
  return OK;
});

// Configuración (marca del entrenador)
const CONF = ['entrenador', 'empresa', 'instagram', 'contacto', 'logo', 'moneda'];
ruta('GET', '/api/config', 'any', async () => Object.fromEntries((await sql()`select clave, valor from config`).map((r) => [r.clave, r.valor])));
ruta('PUT', '/api/config', 'entrenador', async ({ b }) => {
  for (const k of CONF) if (k in b) {
    const v = k === 'logo' ? String(b[k] || '').slice(0, 1_500_000) : txt(b[k], 200);
    await sql()`insert into config (clave, valor) values (${k}, ${v}) on conflict (clave) do update set valor = excluded.valor`;
  }
  return OK;
});

// Ejercicios
ruta('GET', '/api/ejercicios', 'any', async () => sql()`select * from ejercicios order by grupo, nombre`);
ruta('POST', '/api/ejercicios', 'entrenador', async ({ b }) => {
  if (!b.nombre || !b.grupo) falla(400, 'Nombre y grupo son obligatorios');
  const [r] = await sql()`insert into ejercicios (nombre, grupo, video) values (${b.nombre.trim()}, ${b.grupo.trim()}, ${(b.video || '').trim()}) returning id`;
  return r;
});
ruta('PUT', '/api/ejercicios/:id', 'entrenador', async ({ b, p }) => {
  if (!b.nombre || !b.grupo) falla(400, 'Nombre y grupo son obligatorios');
  await sql()`update ejercicios set nombre = ${b.nombre.trim()}, grupo = ${b.grupo.trim()}, video = ${(b.video || '').trim()} where id = ${Number(p.id)}`;
  return OK;
});
ruta('DELETE', '/api/ejercicios/:id', 'entrenador', async ({ p }) => { await sql()`delete from ejercicios where id = ${Number(p.id)}`; return OK; });

// Alimentos
const datosAlimento = (b) => ({ nombre: txt(b.nombre, 150).trim(), grupo: txt(b.grupo, 40), porcion: num(b.porcion) || 100, unidad: txt(b.unidad, 30) || 'g', kcal: num(b.kcal) || 0, prot: num(b.prot) || 0, carb: num(b.carb) || 0, grasa: num(b.grasa) || 0, nota: txt(b.nota) });
ruta('GET', '/api/alimentos', 'any', async () => sql()`select * from alimentos order by grupo, nombre`);
ruta('POST', '/api/alimentos', 'entrenador', async ({ b }) => {
  const d = datosAlimento(b); if (!d.nombre || !d.grupo) falla(400, 'Nombre y grupo son obligatorios');
  const [r] = await sql()`insert into alimentos ${sql()(d)} returning id`; return r;
});
ruta('PUT', '/api/alimentos/:id', 'entrenador', async ({ b, p }) => {
  const d = datosAlimento(b); if (!d.nombre || !d.grupo) falla(400, 'Nombre y grupo son obligatorios');
  await sql()`update alimentos set ${sql()(d)} where id = ${Number(p.id)}`; return OK;
});
ruta('DELETE', '/api/alimentos/:id', 'entrenador', async ({ p }) => { await sql()`delete from alimentos where id = ${Number(p.id)}`; return OK; });

// Alumnos
const datosAlumno = (b) => ({ nombre: txt(b.nombre, 150).trim(), edad: num(b.edad), objetivo: b.objetivo || null, nivel: b.nivel || null, meta: b.meta || null, telefono: b.telefono || null, observaciones: b.observaciones || null });
ruta('GET', '/api/alumnos', 'entrenador', async () => {
  const hoy = new Date().toISOString().slice(0, 10);
  const lista = await sql()`select u.*,
      (select count(*)::int from rutinas r where r.alumno_id = u.id and r.fecha >= ${hoy}) as pendientes,
      (select count(*)::int from rutinas r where r.alumno_id = u.id and r.hecha) as hechas,
      (select estado from pagos p where p.alumno_id = u.id order by fecha desc, id desc limit 1) as ultimo_pago
    from usuarios u where rol = 'alumno' order by activo desc, nombre`;
  return lista.map((u) => publico(u));
});
ruta('GET', '/api/alumnos/:id', 'entrenador', async ({ p }) => {
  const [u] = await sql()`select * from usuarios where id = ${Number(p.id)} and rol = 'alumno'`;
  if (!u) falla(404, 'No encontrado'); return publico(u);
});
ruta('POST', '/api/alumnos', 'entrenador', async ({ b }) => {
  const ci = limpiarCI(b.ci), d = datosAlumno(b);
  if (!ci || !d.nombre) falla(400, 'CI y nombre son obligatorios');
  if ((await sql()`select 1 from usuarios where ci = ${ci}`).length) falla(400, 'Ya existe un usuario con esa CI');
  const [r] = await sql()`insert into usuarios ${sql()({ ...d, ci, rol: 'alumno', pass_hash: hash(b.password || ci), ficha: sql().json(limpiarFicha(b.ficha)) })} returning id`;
  return r;
});
ruta('PUT', '/api/alumnos/:id', 'entrenador', async ({ b, p }) => {
  const ci = limpiarCI(b.ci), d = datosAlumno(b), id = Number(p.id);
  if (!ci || !d.nombre) falla(400, 'CI y nombre son obligatorios');
  if ((await sql()`select 1 from usuarios where ci = ${ci} and id <> ${id}`).length) falla(400, 'Ya existe otro usuario con esa CI');
  await sql()`update usuarios set ${sql()({ ...d, ci, activo: b.activo !== false, ficha: sql().json(limpiarFicha(b.ficha)) })} where id = ${id} and rol = 'alumno'`;
  if (b.password) { await sql()`update usuarios set pass_hash = ${hash(b.password)} where id = ${id}`; await sql()`delete from sesiones where usuario_id = ${id}`; }
  if (b.activo === false) await sql()`delete from sesiones where usuario_id = ${id}`;
  return OK;
});
ruta('DELETE', '/api/alumnos/:id', 'entrenador', async ({ p }) => { await sql()`delete from usuarios where id = ${Number(p.id)} and rol = 'alumno'`; return OK; });

// Planes semanales
async function datosPlan(b) {
  const dias = [];
  for (const [i, d] of (Array.isArray(b.dias) ? b.dias : []).slice(0, 7).entries()) {
    dias.push({ titulo: txt(d.titulo || `Entrenamiento ${i + 1}`, 100), enfoque: txt(d.enfoque, 40), dia_semana: d.dia_semana === '' || d.dia_semana == null ? null : Number(d.dia_semana), items: await limpiarItems(d.items) });
  }
  const nombre = String(b.nombre || '').trim(); if (!nombre) falla(400, 'El plan necesita un nombre');
  return { nombre, descripcion: txt(b.descripcion, 2000), dias: sql().json(dias) };
}
ruta('GET', '/api/planes', 'entrenador', async () => sql()`select * from planes order by nombre`);
ruta('POST', '/api/planes', 'entrenador', async ({ b }) => { const [r] = await sql()`insert into planes ${sql()(await datosPlan(b))} returning id`; return r; });
ruta('PUT', '/api/planes/:id', 'entrenador', async ({ b, p }) => { await sql()`update planes set ${sql()(await datosPlan(b))} where id = ${Number(p.id)}`; return OK; });
ruta('DELETE', '/api/planes/:id', 'entrenador', async ({ p }) => { await sql()`delete from planes where id = ${Number(p.id)}`; return OK; });
ruta('POST', '/api/planes/:id/asignar', 'entrenador', async ({ b, p }) => {
  const [plan] = await sql()`select * from planes where id = ${Number(p.id)}`;
  if (!plan) falla(404, 'Plan no encontrado');
  const alumnos = (b.alumnos || []).map(Number).filter(Boolean);
  const semanas = Math.min(Math.max(Number(b.semanas) || 1, 1), 16);
  if (!alumnos.length || !esFecha(b.lunes)) falla(400, 'Elegí alumno(s) y la semana de inicio');
  const d0 = new Date(b.lunes + 'T12:00:00Z'), lunes = sumarDias(b.lunes, -((d0.getUTCDay() + 6) % 7));
  const filas = [];
  for (const a of alumnos) for (let s = 0; s < semanas; s++) plan.dias.forEach((dia, i) => {
    filas.push({ alumno_id: a, fecha: sumarDias(lunes, s * 7 + (dia.dia_semana != null ? dia.dia_semana : i)), titulo: dia.titulo, enfoque: dia.enfoque || '', notas: plan.descripcion || '',
      items: sql().json(dia.items.map((it) => ({ ...it, carga_real: '', reps_real: '', ok: false }))), plan_id: plan.id });
  });
  await sql().begin(async (tx) => {
    if (b.reemplazar) for (const f of filas) await tx`delete from rutinas where alumno_id = ${f.alumno_id} and fecha = ${f.fecha}`;
    if (filas.length) await tx`insert into rutinas ${tx(filas)}`;
  });
  return { creadas: filas.length };
});

// Rutinas
ruta('GET', '/api/rutinas', 'any', async ({ u, q }) => {
  const desde = esFecha(q.get('desde')) ? q.get('desde') : '1900-01-01', hasta = esFecha(q.get('hasta')) ? q.get('hasta') : '2999-12-31';
  return sql()`select * from rutinas where alumno_id = ${alumnoObjetivo(u, q.get('alumno'))} and fecha between ${desde} and ${hasta} order by fecha, id`;
});
ruta('POST', '/api/rutinas', 'entrenador', async ({ b }) => {
  if (!b.alumno_id || !esFecha(b.fecha)) falla(400, 'Alumno y fecha son obligatorios');
  const items = await limpiarItems(b.items); if (!items.length) falla(400, 'Agregá al menos un ejercicio');
  const [r] = await sql()`insert into rutinas ${sql()({ alumno_id: Number(b.alumno_id), fecha: b.fecha, titulo: txt(b.titulo, 100) || 'Entrenamiento', enfoque: txt(b.enfoque, 40), notas: txt(b.notas, 2000), items: sql().json(items) })} returning id`;
  return r;
});
ruta('PUT', '/api/rutinas/:id', 'any', async ({ b, p, u }) => {
  const [r] = await sql()`select * from rutinas where id = ${Number(p.id)}`;
  if (!r) falla(404, 'No encontrada');
  if (u.rol === 'alumno') {
    if (r.alumno_id !== u.id) falla(403, 'Sin permiso');
    const items = r.items.map((it, i) => { const n = (b.items || [])[i] || {}; return { ...it, carga_real: txt(n.carga_real ?? it.carga_real, 30), reps_real: txt(n.reps_real ?? it.reps_real, 30), ok: !!n.ok }; });
    await sql()`update rutinas set items = ${sql().json(items)}, hecha = ${!!b.hecha}, comentario_alumno = ${txt(b.comentario_alumno, 500)} where id = ${r.id}`;
  } else {
    const items = await limpiarItems(b.items); if (!items.length) falla(400, 'Agregá al menos un ejercicio');
    await sql()`update rutinas set fecha = ${esFecha(b.fecha) ? b.fecha : r.fecha}, titulo = ${txt(b.titulo, 100) || r.titulo}, enfoque = ${txt(b.enfoque, 40)}, notas = ${txt(b.notas, 2000)},
      items = ${sql().json(items)}, hecha = ${b.hecha == null ? r.hecha : !!b.hecha} where id = ${r.id}`;
  }
  return OK;
});
ruta('DELETE', '/api/rutinas/:id', 'entrenador', async ({ p }) => { await sql()`delete from rutinas where id = ${Number(p.id)}`; return OK; });
ruta('POST', '/api/rutinas/:id/copiar', 'entrenador', async ({ b, p }) => {
  const [r] = await sql()`select * from rutinas where id = ${Number(p.id)}`;
  if (!r || !esFecha(b.fecha)) falla(400, 'Fecha inválida');
  await sql()`insert into rutinas ${sql()({ alumno_id: Number(b.alumno_id) || r.alumno_id, fecha: b.fecha, titulo: r.titulo, enfoque: r.enfoque, notas: r.notas, plan_id: r.plan_id,
    items: sql().json(r.items.map((it) => ({ ...it, carga_real: '', reps_real: '', ok: false }))) })}`;
  return OK;
});

// Control corporal
const datosMedidas = (d) => Object.fromEntries(MEDIDAS.map((k) => [k, num((d || {})[k])]));
ruta('GET', '/api/mediciones', 'any', async ({ u, q }) => sql()`select * from mediciones where alumno_id = ${alumnoObjetivo(u, q.get('alumno'))} order by fecha, id`);
ruta('POST', '/api/mediciones', 'entrenador', async ({ b }) => {
  if (!b.alumno_id || !esFecha(b.fecha)) falla(400, 'Fecha obligatoria');
  const datos = datosMedidas(b.datos); if (!Object.values(datos).some((v) => v != null)) falla(400, 'Cargá al menos una medida');
  const [r] = await sql()`insert into mediciones (alumno_id, fecha, datos) values (${Number(b.alumno_id)}, ${b.fecha}, ${sql().json(datos)}) returning id`; return r;
});
ruta('PUT', '/api/mediciones/:id', 'entrenador', async ({ b, p }) => {
  if (!esFecha(b.fecha)) falla(400, 'Fecha inválida');
  await sql()`update mediciones set fecha = ${b.fecha}, datos = ${sql().json(datosMedidas(b.datos))} where id = ${Number(p.id)}`; return OK;
});
ruta('DELETE', '/api/mediciones/:id', 'entrenador', async ({ p }) => { await sql()`delete from mediciones where id = ${Number(p.id)}`; return OK; });

// Fotos
ruta('GET', '/api/fotos', 'any', async ({ u, q }) => sql()`select id, alumno_id, fecha, tipo from fotos where alumno_id = ${alumnoObjetivo(u, q.get('alumno'))} order by fecha, id`);
ruta('GET', '/api/fotos/:id', 'any', async ({ p, u }) => {
  const [f] = await sql()`select * from fotos where id = ${Number(p.id)}`;
  if (!f || (u.rol === 'alumno' && f.alumno_id !== u.id)) falla(404, 'No encontrada');
  return { __binario: true, tipo: f.mime, datos: Buffer.from(f.data) };
});
ruta('POST', '/api/fotos', 'entrenador', async ({ b }) => {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(b.data || '');
  if (!b.alumno_id || !esFecha(b.fecha) || !m) falla(400, 'Foto o fecha inválida');
  if (!['frente', 'espalda', 'perfil_der', 'perfil_izq'].includes(b.tipo)) falla(400, 'Tipo de foto inválido');
  const [r] = await sql()`insert into fotos (alumno_id, fecha, tipo, mime, data) values (${Number(b.alumno_id)}, ${b.fecha}, ${b.tipo}, ${m[1]}, ${Buffer.from(m[2], 'base64')}) returning id`; return r;
});
ruta('DELETE', '/api/fotos/:id', 'entrenador', async ({ p }) => { await sql()`delete from fotos where id = ${Number(p.id)}`; return OK; });

// Pagos y cancelaciones
ruta('GET', '/api/pagos', 'any', async ({ u, q }) => sql()`select * from pagos where alumno_id = ${alumnoObjetivo(u, q.get('alumno'))} order by fecha desc, id desc`);
ruta('POST', '/api/pagos', 'entrenador', async ({ b }) => {
  if (!b.alumno_id || !esFecha(b.fecha)) falla(400, 'Fecha obligatoria');
  await sql()`insert into pagos (alumno_id, fecha, monto, estado, nota) values (${Number(b.alumno_id)}, ${b.fecha}, ${num(b.monto)}, ${txt(b.estado, 20) || 'Pagado'}, ${txt(b.nota)})`; return OK;
});
ruta('PUT', '/api/pagos/:id', 'entrenador', async ({ b, p }) => {
  if (!esFecha(b.fecha)) falla(400, 'Fecha inválida');
  await sql()`update pagos set fecha = ${b.fecha}, monto = ${num(b.monto)}, estado = ${txt(b.estado, 20)}, nota = ${txt(b.nota)} where id = ${Number(p.id)}`; return OK;
});
ruta('DELETE', '/api/pagos/:id', 'entrenador', async ({ p }) => { await sql()`delete from pagos where id = ${Number(p.id)}`; return OK; });
ruta('GET', '/api/cancelaciones', 'entrenador', async ({ q }) => sql()`select * from cancelaciones where alumno_id = ${Number(q.get('alumno')) || 0} order by fecha desc`);
ruta('POST', '/api/cancelaciones', 'entrenador', async ({ b }) => {
  if (!b.alumno_id || !esFecha(b.fecha)) falla(400, 'Fecha obligatoria');
  await sql()`insert into cancelaciones (alumno_id, fecha, nota) values (${Number(b.alumno_id)}, ${b.fecha}, ${txt(b.nota)})`; return OK;
});
ruta('DELETE', '/api/cancelaciones/:id', 'entrenador', async ({ p }) => { await sql()`delete from cancelaciones where id = ${Number(p.id)}`; return OK; });

// Plan de alimentación
ruta('GET', '/api/dieta', 'any', async ({ u, q }) => {
  const [d] = await sql()`select datos from dietas where alumno_id = ${alumnoObjetivo(u, q.get('alumno'))}`;
  return d ? d.datos : limpiarDieta({});
});
ruta('PUT', '/api/dieta', 'entrenador', async ({ b, q }) => {
  const id = Number(q.get('alumno')); if (!id) falla(400, 'Falta alumno');
  await sql()`insert into dietas (alumno_id, datos) values (${id}, ${sql().json(limpiarDieta(b))}) on conflict (alumno_id) do update set datos = excluded.datos`;
  return OK;
});

// ---------- despachador ----------
// req: { metodo, ruta, query (URLSearchParams), headers (objeto en minúsculas), body (string) }
// devuelve: { status, headers, body (string | Buffer) }
export async function manejar(req) {
  const json = (status, data) => ({ status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, body: JSON.stringify(data) });
  try {
    for (const r of rutas) {
      const m = r.re.exec(req.ruta);
      if (!m || r.metodo !== req.metodo) continue;
      const token = (req.headers.authorization || '').replace('Bearer ', '') || req.query.get('t') || '';
      let u = null;
      if (r.rol) {
        if (token) [u] = await sql()`select u.* from sesiones s join usuarios u on u.id = s.usuario_id where s.token = ${token} and u.activo`;
        if (!u) return json(401, { error: 'Sesión expirada, ingresá de nuevo' });
        if (r.rol !== 'any' && u.rol !== r.rol) return json(403, { error: 'Sin permiso' });
      }
      let b = {};
      if (['POST', 'PUT'].includes(req.metodo) && req.body) {
        if (req.body.length > 12e6) return json(413, { error: 'Archivo demasiado grande' });
        try { b = JSON.parse(req.body); } catch { return json(400, { error: 'JSON inválido' }); }
      }
      const res = await r.fn({ b, p: m.groups || {}, u, q: req.query, token });
      if (res && res.__binario) return { status: 200, headers: { 'Content-Type': res.tipo, 'Cache-Control': 'private, max-age=86400' }, body: res.datos };
      return json(200, res);
    }
    return json(404, { error: 'Ruta no encontrada' });
  } catch (e) {
    if (e instanceof ErrorHttp) return json(e.status, { error: e.message });
    console.error(e);
    return json(500, { error: 'Error interno del servidor' });
  }
}
