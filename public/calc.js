'use strict';
// ===== Constantes y cálculos (tomados del Planificador Clarity Trainer) =====
const OBJETIVOS = {
  'Aumento de masa muscular': { factor: 1.10, prot: 2.0, grasa: 0.9, estrella: 'pecho' },
  'Bajar grasa corporal': { factor: 0.82, prot: 2.0, grasa: 0.8, estrella: 'cintura' },
  'Recomposición': { factor: 0.95, prot: 2.2, grasa: 0.9, estrella: 'cintura' },
  'Fuerza / Rendimiento': { factor: 1.05, prot: 1.8, grasa: 1.0, estrella: 'muslo_der' },
};
const ACTIVIDAD = { 'Sedentario': 1.2, 'Moderado / Activo': 1.55, 'Muy activo': 1.8 };
const NIVELES = ['Principiante', 'Intermedio', 'Avanzado'];
const GENEROS = ['Hombre', 'Mujer'];
const DURACIONES = [8, 12, 16];
const FRECUENCIAS = [2, 3, 4, 5, 6];
const ENFOQUES = ['Tren Superior', 'Tren Inferior', 'Core / Cardio / Otros', 'Cuerpo Completo'];
const GRUPOS_ENFOQUE = {
  'Tren Superior': ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps'],
  'Tren Inferior': ['Cuádriceps', 'Isquiotibiales y Glúteos', 'Pantorrillas'],
  'Core / Cardio / Otros': ['Abdomen', 'Cardio', 'Movilidad'],
};
const MEDIDAS = [
  ['peso', 'Peso', 'kg'], ['altura', 'Altura', 'cm'], ['cuello', 'Cuello', 'cm'], ['pecho', 'Pecho', 'cm'],
  ['biceps_izq', 'Bícep (Izq.)', 'cm'], ['biceps_der', 'Bícep (Der.)', 'cm'], ['abdomen_bajo', 'Abdomen bajo', 'cm'],
  ['cintura', 'Cintura', 'cm'], ['caderas', 'Caderas', 'cm'], ['muslo_izq', 'Muslo (Izq.)', 'cm'], ['muslo_der', 'Muslo (Der.)', 'cm'],
  ['pantorrilla_izq', 'Pantorrilla (Izq.)', 'cm'], ['pantorrilla_der', 'Pantorrilla (Der.)', 'cm'],
];
const NOMBRE_MEDIDA = Object.fromEntries(MEDIDAS.map(([k, n]) => [k, n]));
const ANAMNESIS = [
  ['cronica', '¿Padece alguna enfermedad crónica (hipertensión, diabetes, asma, etc.)?', 'Enfermedad crónica'],
  ['condicion', '¿Tiene alguna condición médica que deba considerarse al entrenar?', 'Condición médica'],
  ['medicacion', '¿Utiliza actualmente algún medicamento?', 'Medicación'],
  ['cirugia', '¿Ha tenido alguna cirugía relevante?', 'Cirugías'],
  ['lesion', '¿Tiene alguna lesión o dolor actual que pueda comprometer el entrenamiento?', 'Lesiones'],
  ['suplementos', '¿Utiliza suplementos actualmente?', 'Suplementos'],
];
const NIV_ACTIVIDAD_HAB = ['Sedentario', 'Ligero', 'Moderado', 'Activo', 'Muy activo'];
const SUENO = ['Menos de 5', '5 a 6', '6 a 7', '7 a 8', 'Más de 8'];
const ALCOHOL = ['No', 'Ocasionalmente', 'Frecuentemente'];
const SENSACION = ['Intenso y exigente', 'Retador pero controlado', 'Suave y progresivo'];
const MODALIDADES = ['Mensualidad', 'Bono de sesiones'];
const EST_PAGO = ['Pagado', 'Pendiente'];
const MONEDAS = { 'Paraguay (PYG)': '₲', 'Argentina (ARS)': '$', 'Bolivia (BOL)': '$b', 'Brasil (BRL)': 'R$', 'Chile (CLP)': '$', 'Colombia (COP)': '$', 'Estados Unidos (USD)': 'US$', 'México (MXN)': '$', 'Perú (PEN)': 'S/', 'Uruguay (UYU)': '$', 'Países Europeos (EUR)': '€' };
const GRUPOS_ALIMENTO = ['Proteína', 'Carbohidrato', 'Grasa', 'Vegetales y Frutas'];
const NOMBRES_COMIDA = ['Desayuno', 'Media mañana', 'Almuerzo', 'Merienda', 'Cena', 'Colación nocturna'];
const RANGO = 0.10; // ±10 % de tolerancia (meta calórica y macros)

const redondear = (n, d = 0) => (n == null || isNaN(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const fmt = (n, d = 0) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('es-PY', { minimumFractionDigits: d, maximumFractionDigits: d }));
const fichaDe = (a) => a.ficha || {};

function ultimoValor(mediciones, k) {
  for (let i = mediciones.length - 1; i >= 0; i--) if (mediciones[i].datos[k] != null) return mediciones[i].datos[k];
  return null;
}
function valorActual(a, mediciones, k) {
  const v = ultimoValor(mediciones, k);
  return v != null ? v : (fichaDe(a).medidas_inicio || {})[k] ?? null;
}

// Mifflin-St Jeor
function calorias(a, peso) {
  const f = fichaDe(a), alt = (f.medidas_inicio || {}).altura, edad = a.edad;
  if (!peso || !alt || !edad || !f.genero) return null;
  const base = Math.round(10 * peso + 6.25 * alt - 5 * edad + (f.genero === 'Hombre' ? 5 : -161));
  const factor = ACTIVIDAD[f.actividad] || null;
  const ajustadas = factor ? Math.round(base * factor) : null;
  const obj = OBJETIVOS[a.objetivo];
  const meta = ajustadas && obj ? Math.round(ajustadas * obj.factor) : ajustadas;
  return { base, factor, ajustadas, ajuste: obj ? obj.factor - 1 : 0, meta, min: meta && Math.round(meta * (1 - RANGO)), max: meta && Math.round(meta * (1 + RANGO)) };
}
function macros(a) {
  const f = fichaDe(a), peso = (f.medidas_inicio || {}).peso, obj = OBJETIVOS[a.objetivo] || { prot: 2.0, grasa: 0.9 };
  const cal = calorias(a, peso);
  const sug = { prot: null, grasa: null, carb: null };
  if (peso) { sug.prot = Math.round(peso * obj.prot); sug.grasa = Math.round(peso * obj.grasa); }
  if (cal && cal.meta && sug.prot != null) sug.carb = Math.max(0, Math.round((cal.meta - sug.prot * 4 - sug.grasa * 9) / 4));
  const aj = f.macros_ajuste || {};
  const fin = { prot: aj.prot ?? sug.prot, carb: aj.carb ?? sug.carb, grasa: aj.grasa ?? sug.grasa };
  return { sugeridos: sug, final: fin, kcal: fin.prot != null && fin.carb != null && fin.grasa != null ? fin.prot * 4 + fin.carb * 4 + fin.grasa * 9 : null };
}
function programa(a, hoy) {
  const f = fichaDe(a);
  if (!f.fecha_inicio || !f.duracion) return null;
  const dias = Math.max(0, (desdeISO(hoy) - desdeISO(f.fecha_inicio)) / 864e5);
  const semana = Math.min(f.duracion, Math.max(1, Math.ceil((dias + 1) / 7)));
  return { semana, total: f.duracion, fin: sumar(f.fecha_inicio, f.duracion * 7), restantes: Math.max(0, f.duracion - semana), dias: Math.round(dias), empezo: hoy >= f.fecha_inicio };
}
function adherencia(rutinas, hoy) {
  const pasadas = rutinas.filter((r) => r.fecha < hoy || r.hecha);
  const hechas = pasadas.filter((r) => r.hecha).length;
  return { planificadas: pasadas.length, hechas, pct: pasadas.length ? hechas / pasadas.length : null, total_hechas: rutinas.filter((r) => r.hecha).length };
}
function avancePeso(a, mediciones, hoy) {
  const f = fichaDe(a), ini = (f.medidas_inicio || {}).peso, meta = (f.medidas_meta || {}).peso, act = valorActual(a, mediciones, 'peso');
  if (!ini || !act) return null;
  const r = { inicial: ini, actual: act, meta, variacion: redondear(act - ini, 1) };
  if (meta && meta !== ini) r.pct = Math.max(0, Math.min(1, (act - ini) / (meta - ini)));
  const prog = programa(a, hoy);
  if (prog && prog.dias >= 7) {
    r.ritmo = redondear((act - ini) / (prog.dias / 7), 2); // kg por semana
    if (meta && prog.restantes > 0) r.necesario = redondear((meta - act) / prog.restantes, 2);
    if (meta && r.ritmo && Math.sign(r.ritmo) === Math.sign(meta - act)) r.llegada = sumar(hoy, Math.round(((meta - act) / r.ritmo) * 7));
  }
  return r;
}
function bonoSesiones(a, rutinas) {
  const c = fichaDe(a).comercial || {};
  if (c.modalidad !== 'Bono de sesiones' || !c.sesiones_bono) return null;
  const ini = fichaDe(a).fecha_inicio || '0000';
  const usadas = rutinas.filter((r) => r.hecha && r.fecha >= ini).length;
  return { incluidas: c.sesiones_bono, usadas, restantes: c.sesiones_bono - usadas };
}
function simboloMoneda(a) { return MONEDAS[(fichaDe(a).comercial || {}).moneda] || '₲'; }

// ===== alimentación =====
function macrosItem(it, alimentos) {
  const al = alimentos.find((x) => x.id === it.alimento_id);
  if (!al || it.cantidad == null) return { kcal: 0, prot: 0, carb: 0, grasa: 0, al };
  const k = it.cantidad / (al.porcion || 1);
  return { kcal: al.kcal * k, prot: al.prot * k, carb: al.carb * k, grasa: al.grasa * k, al };
}
function sumaMacros(lista) {
  return lista.reduce((t, m) => ({ kcal: t.kcal + m.kcal, prot: t.prot + m.prot, carb: t.carb + m.carb, grasa: t.grasa + m.grasa }), { kcal: 0, prot: 0, carb: 0, grasa: 0 });
}
function estadoVsMeta(valor, meta) {
  if (!meta || !valor) return null;
  if (valor < meta * (1 - RANGO)) return { txt: 'Por debajo', cls: 'warn' };
  if (valor > meta * (1 + RANGO)) return { txt: 'Por encima', cls: 'warn' };
  return { txt: 'En objetivo', cls: 'ok' };
}
