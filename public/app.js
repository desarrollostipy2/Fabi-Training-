'use strict';
// ================= núcleo: utilidades, API, modal, login y navegación =================
const $app = document.getElementById('app');
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function h(tag, attrs, ...hijos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'hidden') el.hidden = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const desdeISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const hoyISO = () => iso(new Date());
const sumar = (s, n) => { const d = desdeISO(s); d.setDate(d.getDate() + n); return iso(d); };
const lunesDe = (s) => { const d = desdeISO(s); return sumar(s, -((d.getDay() + 6) % 7)); };
const diaSemana = (s) => (desdeISO(s).getDay() + 6) % 7;
const fechaLarga = (s) => { const d = desdeISO(s); return `${DIAS[diaSemana(s)]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
const fechaCorta = (s) => { const d = desdeISO(s); return `${d.getDate()} ${MESES[d.getMonth()]}`; };
const fechaNum = (s) => (s ? s.split('-').reverse().join('/') : '—');
const sinTildes = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let toastT;
function toast(msg, err) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'ver' + (err ? ' err' : '');
  clearTimeout(toastT); toastT = setTimeout(() => (t.className = err ? 'err' : ''), 2800);
}

const S = { token: localStorage.getItem('token'), usuario: null, config: {}, ejercicios: null, alimentos: null, tab: null, sub: null, subtab: 'resumen' };

async function api(metodo, url, body) {
  const r = await fetch(url, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { salir(true); throw new Error(data.error || 'Sesión expirada'); }
  if (!r.ok) throw new Error(data.error || 'Error');
  return data;
}
const intentar = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };
async function ejercicios(forzar) { if (!S.ejercicios || forzar) S.ejercicios = await api('GET', '/api/ejercicios'); return S.ejercicios; }
async function alimentos(forzar) { if (!S.alimentos || forzar) S.alimentos = await api('GET', '/api/alimentos'); return S.alimentos; }
const urlFoto = (id) => `/api/fotos/${id}?t=${encodeURIComponent(S.token)}`;

function modal(titulo, contenido, { ancho } = {}) {
  const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape' && fondo === [...document.querySelectorAll('.modal-fondo')].pop()) cerrar(); };
  const cuerpo = h('div');
  const fondo = h('div', { class: 'modal-fondo', onmousedown: (e) => { if (e.target === fondo) cerrar(); } },
    h('div', { class: 'modal' + (ancho ? ' ancho' : ''), role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-cab' }, h('h2', { style: 'margin:0' }, titulo), h('button', { class: 'cerrar', onclick: cerrar, 'aria-label': 'Cerrar' }, '×')),
      cuerpo));
  document.addEventListener('keydown', esc);
  document.body.append(fondo);
  cuerpo.append(...[].concat(typeof contenido === 'function' ? contenido(cerrar) : contenido));
  return cerrar;
}
const campo = (etiqueta, input, ayuda) => h('div', { class: 'campo' }, h('label', {}, etiqueta), input, ayuda ? h('div', { class: 'ayuda' }, ayuda) : null);
function selector(opciones, valor, { vacio = '—', onchange, attrs = {} } = {}) {
  return h('select', { onchange, ...attrs }, vacio != null ? h('option', { value: '' }, vacio) : null,
    opciones.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(valor ?? '') === String(v) }, t); }));
}
const chip = (t, cls = '') => h('span', { class: 'chip ' + cls }, t);

// Reduce una imagen a JPEG (para fotos y logo)
function imagenADataURL(file, max = 1200, calidad = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); resolve(c.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = URL.createObjectURL(file);
  });
}

// ================= login =================
function vistaLogin() {
  const err = h('div', { class: 'error' });
  const ci = h('input', { inputmode: 'numeric', autocomplete: 'username', placeholder: 'Ej: 4567890', required: true });
  const pass = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const btn = h('button', { class: 'btn prim', type: 'submit', style: 'width:100%' }, 'Ingresar');
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault(); err.textContent = ''; btn.disabled = true;
      try {
        const r = await api('POST', '/api/login', { ci: ci.value, password: pass.value });
        S.token = r.token; S.usuario = r.usuario; localStorage.setItem('token', r.token);
        S.tab = null; S.sub = null; render();
      } catch (e2) { err.textContent = e2.message; } finally { btn.disabled = false; }
    },
  }, campo('Cédula de identidad', ci), campo('Contraseña', pass), err, btn,
  h('p', { class: 'sub', style: 'text-align:center;margin:14px 0 0' }, 'Alumnos: tu primera contraseña es tu número de CI.'));
  $app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'card' },
    h('div', { class: 'marca', style: 'margin-bottom:14px' }, h('img', { src: '/icono.svg', alt: '' })),
    h('h1', {}, 'Fabi-Training'), h('p', { class: 'sub', style: 'margin:0 0 18px' }, 'Ingresá con tu CI'), form)));
  ci.focus();
}
async function salir(silencioso) {
  if (!silencioso) try { await api('POST', '/api/logout'); } catch {}
  Object.assign(S, { token: null, usuario: null, ejercicios: null, alimentos: null, tab: null, sub: null });
  localStorage.removeItem('token'); render();
}

// ================= navegación =================
function shell(tabs, contenido) {
  const nav = h('nav', { class: 'tabs' }, tabs.map(([id, txt]) =>
    h('button', { class: 'tab' + (S.tab === id ? ' on' : ''), onclick: () => { S.tab = id; S.sub = null; render(); } }, txt)));
  const main = h('main');
  const logo = S.config.logo ? h('img', { src: S.config.logo, alt: '', class: 'logo-marca' }) : h('img', { src: '/icono.svg', alt: '' });
  $app.replaceChildren(h('header', { class: 'top' }, h('div', { class: 'top-in' },
    h('div', { class: 'marca' }, logo, h('span', {}, S.config.empresa || S.usuario.nombre.split(' ')[0])), nav)), main);
  window.scrollTo(0, 0);
  Promise.resolve(contenido(main)).catch((e) => toast(e.message, true));
}

async function render() {
  if (!S.token) return vistaLogin();
  try {
    [S.usuario, S.config] = await Promise.all([api('GET', '/api/yo'), api('GET', '/api/config')]);
  } catch { return; }
  if (S.usuario.rol === 'entrenador') {
    S.tab ||= 'alumnos';
    shell([['alumnos', 'Alumnos'], ['planes', 'Planes'], ['ejercicios', 'Ejercicios'], ['alimentos', 'Alimentos'], ['ajustes', 'Ajustes']], (main) =>
      ({ alumnos: S.sub ? vistaAlumno : vistaAlumnos, planes: vistaPlanes, ejercicios: vistaEjercicios, alimentos: vistaAlimentos, ajustes: vistaAjustes })[S.tab](main));
  } else {
    S.tab ||= 'semana';
    shell([['semana', 'Mi semana'], ['comida', 'Alimentación'], ['progreso', 'Progreso'], ['historial', 'Historial'], ['cuenta', 'Cuenta']], (main) =>
      ({ semana: vistaSemanaAlumno, comida: vistaComidaAlumno, progreso: vistaProgresoAlumno, historial: vistaHistorial, cuenta: vistaCuenta })[S.tab](main));
  }
}

function formPassword() {
  const actual = h('input', { type: 'password', autocomplete: 'current-password' });
  const nueva = h('input', { type: 'password', autocomplete: 'new-password' });
  return h('form', {
    class: 'card', onsubmit: intentar(async (e) => {
      e.preventDefault();
      await api('POST', '/api/cambiar-password', { actual: actual.value, nueva: nueva.value });
      actual.value = nueva.value = ''; toast('Contraseña actualizada');
    }),
  }, h('h2', {}, 'Cambiar contraseña'), campo('Contraseña actual', actual), campo('Nueva contraseña', nueva), h('button', { class: 'btn prim' }, 'Guardar'));
}
