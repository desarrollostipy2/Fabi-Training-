'use strict';
// Gráficos SVG livianos (una serie, eje único, tooltip al pasar el mouse / tocar)
const SVGNS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...hijos) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of hijos.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
function escalaNice(min, max, n = 4) {
  if (min === max) { min -= 1; max += 1; }
  const paso0 = (max - min) / n, mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= paso0);
  const lo = Math.floor(min / paso) * paso, hi = Math.ceil(max / paso) * paso;
  const ticks = []; for (let v = lo; v <= hi + paso / 2; v += paso) ticks.push(redondear(v, 2));
  return { lo, hi, ticks };
}

// puntos: [{x:'AAAA-MM-DD', y:Number, etiqueta?}]
function graficoLinea(puntos, { unidad = '', meta = null, alto = 200, vacio = 'Sin datos todavía' } = {}) {
  const caja = h('div', { class: 'grafico' });
  if (puntos.length === 0) { caja.append(h('div', { class: 'vacio' }, vacio)); return caja; }
  const W = 600, H = alto, m = { t: 14, r: 16, b: 26, l: 44 };
  const xs = puntos.map((p) => desdeISO(p.x).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 864e5 * 3; x1 += 864e5 * 3; }
  const ys = puntos.map((p) => p.y).concat(meta != null ? [meta] : []);
  const esc = escalaNice(Math.min(...ys), Math.max(...ys));
  const X = (t) => m.l + ((t - x0) / (x1 - x0)) * (W - m.l - m.r);
  const Y = (v) => m.t + (1 - (v - esc.lo) / (esc.hi - esc.lo)) * (H - m.t - m.b);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svg-graf', role: 'img', 'aria-label': `Gráfico de ${puntos.length} registros` });
  for (const t of esc.ticks) {
    svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: 'g-grid' }));
    svg.append(s('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', class: 'g-eje' }, fmt(t, t % 1 ? 1 : 0)));
  }
  // etiquetas de fecha: primera, última y alguna intermedia
  const idxs = [...new Set([0, Math.floor((puntos.length - 1) / 2), puntos.length - 1])];
  for (const i of idxs) svg.append(s('text', { x: X(xs[i]), y: H - 6, 'text-anchor': i === 0 && puntos.length > 1 ? 'start' : i === puntos.length - 1 && puntos.length > 1 ? 'end' : 'middle', class: 'g-eje' }, fechaCorta(puntos[i].x)));
  if (meta != null) {
    svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(meta), y2: Y(meta), class: 'g-meta' }));
    svg.append(s('text', { x: W - m.r, y: Y(meta) - 6, 'text-anchor': 'end', class: 'g-meta-txt' }, `Meta ${fmt(meta, 1)} ${unidad}`));
  }
  const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  svg.append(s('path', { d, class: 'g-linea' }));
  puntos.forEach((p, i) => svg.append(s('circle', { cx: X(xs[i]), cy: Y(p.y), r: 4, class: 'g-punto' })));
  // etiqueta directa del último valor
  const ul = puntos.length - 1;
  svg.append(s('text', { x: Math.min(X(xs[ul]), W - m.r), y: Y(puntos[ul].y) - 10, 'text-anchor': 'end', class: 'g-valor' }, `${fmt(puntos[ul].y, puntos[ul].y % 1 ? 1 : 0)} ${unidad}`));
  // capa de hover
  const cruz = s('line', { y1: m.t, y2: H - m.b, class: 'g-cruz', visibility: 'hidden' });
  const foco = s('circle', { r: 6, class: 'g-foco', visibility: 'hidden' });
  svg.append(cruz, foco);
  const tip = h('div', { class: 'g-tip', hidden: true });
  const zona = s('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: 'transparent' });
  const mover = (ev) => {
    const r = svg.getBoundingClientRect(), px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) * (W / r.width);
    let mejor = 0; xs.forEach((x, i) => { if (Math.abs(X(x) - px) < Math.abs(X(xs[mejor]) - px)) mejor = i; });
    const p = puntos[mejor], cx = X(xs[mejor]), cy = Y(p.y);
    cruz.setAttribute('x1', cx); cruz.setAttribute('x2', cx); cruz.setAttribute('visibility', 'visible');
    foco.setAttribute('cx', cx); foco.setAttribute('cy', cy); foco.setAttribute('visibility', 'visible');
    tip.hidden = false; tip.replaceChildren(h('b', {}, `${fmt(p.y, p.y % 1 ? 1 : 0)} ${unidad}`), h('span', {}, p.etiqueta || fechaLarga(p.x)));
    const izq = (cx / W) * r.width; tip.style.left = Math.min(Math.max(izq, 60), r.width - 60) + 'px'; tip.style.top = (cy / H) * r.height - 8 + 'px';
  };
  const salir = () => { cruz.setAttribute('visibility', 'hidden'); foco.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  zona.addEventListener('mousemove', mover); zona.addEventListener('touchstart', mover, { passive: true }); zona.addEventListener('touchmove', mover, { passive: true });
  zona.addEventListener('mouseleave', salir);
  svg.append(zona);
  caja.append(svg, tip);
  return caja;
}

// barras: [{etiqueta, valor (0..1), detalle}]
function graficoBarras(barras, { alto = 160, formato = (v) => Math.round(v * 100) + '%', max = 1 } = {}) {
  const caja = h('div', { class: 'grafico' });
  if (!barras.length) { caja.append(h('div', { class: 'vacio' }, 'Sin semanas cerradas todavía')); return caja; }
  const W = 600, H = alto, m = { t: 18, r: 8, b: 24, l: 8 };
  const ancho = (W - m.l - m.r) / barras.length, bw = Math.min(46, ancho - 6);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'svg-graf', role: 'img', 'aria-label': 'Cumplimiento semana a semana' });
  svg.append(s('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'g-grid' }));
  const tip = h('div', { class: 'g-tip', hidden: true });
  barras.forEach((b, i) => {
    const cx = m.l + ancho * i + ancho / 2, hgt = Math.max(0, (b.valor / max) * (H - m.t - m.b)), y = H - m.b - hgt;
    const r = Math.min(4, hgt / 2, bw / 2);
    const path = hgt > 0 ? `M${cx - bw / 2},${H - m.b} V${y + r} Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y} H${cx + bw / 2 - r} Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r} V${H - m.b} Z` : '';
    if (path) svg.append(s('path', { d: path, class: 'g-barra' }));
    if (barras.length <= 12) svg.append(s('text', { x: cx, y: y - 5, 'text-anchor': 'middle', class: 'g-valor chico' }, formato(b.valor)));
    svg.append(s('text', { x: cx, y: H - 7, 'text-anchor': 'middle', class: 'g-eje' }, b.etiqueta));
    const hit = s('rect', { x: cx - ancho / 2, y: 0, width: ancho, height: H, fill: 'transparent' });
    const ver = () => { tip.hidden = false; tip.replaceChildren(h('b', {}, formato(b.valor)), h('span', {}, b.detalle || b.etiqueta)); const rr = svg.getBoundingClientRect(); tip.style.left = Math.min(Math.max((cx / W) * rr.width, 60), rr.width - 60) + 'px'; tip.style.top = (y / H) * rr.height - 8 + 'px'; };
    hit.addEventListener('mouseenter', ver); hit.addEventListener('touchstart', ver, { passive: true });
    hit.addEventListener('mouseleave', () => (tip.hidden = true));
    svg.append(hit);
  });
  caja.append(svg, tip);
  return caja;
}
