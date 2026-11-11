// Define el nombre de la marca (empresa) y el nombre visible del entrenador.
// Uso: node scripts/marca.js "<Nombre de la marca>"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const l of fs.readFileSync(path.join(dir, '.env'), 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const marca = process.argv[2];
if (!marca) { console.error('Uso: node scripts/marca.js "<Nombre>"'); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
for (const [k, v] of [['empresa', marca], ['entrenador', marca]]) {
  await sql`insert into config (clave, valor) values (${k}, ${v}) on conflict (clave) do update set valor = excluded.valor`;
}
await sql`update usuarios set nombre = ${marca} where rol = 'entrenador'`;
console.log('Marca:', (await sql`select clave, valor from config where clave in ('empresa','entrenador')`).map((r) => `${r.clave}=${r.valor}`).join(', '));
console.log('Entrenador(es):', (await sql`select nombre, ci from usuarios where rol = 'entrenador'`).map((r) => `${r.nombre} (CI ${r.ci})`).join(', '));
await sql.end();
