// Cambia la CI y el nombre del entrenador (mantiene su contraseña).
// Uso: node scripts/datos-entrenador.js <CI actual> <CI nueva> "<Nombre>"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const l of fs.readFileSync(path.join(dir, '.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const [actual, nueva, nombre] = process.argv.slice(2);
if (!actual || !nueva || !nombre) { console.error('Uso: node scripts/datos-entrenador.js <CI actual> <CI nueva> "<Nombre>"'); process.exit(1); }
const ci = nueva.replace(/\D/g, '');
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
if ((await sql`select 1 from usuarios where ci = ${ci} and ci <> ${actual}`).length) { console.error('Ya existe otro usuario con la CI ' + ci); process.exit(1); }
const r = await sql`update usuarios set ci = ${ci}, nombre = ${nombre} where ci = ${actual} and rol = 'entrenador' returning id`;
if (!r.length) { console.error('No se encontró el entrenador con CI ' + actual); process.exit(1); }
await sql`delete from sesiones where usuario_id = ${r[0].id}`;
await sql`insert into config (clave, valor) values ('entrenador', ${nombre}) on conflict (clave) do update set valor = excluded.valor`;
console.log('Entrenador:', (await sql`select nombre, ci from usuarios where rol = 'entrenador'`).map((u) => `${u.nombre} (CI ${u.ci})`).join(', '));
console.log('Marca:', (await sql`select clave, valor from config where clave in ('empresa','entrenador')`).map((x) => `${x.clave}=${x.valor}`).join(', '));
await sql.end();
