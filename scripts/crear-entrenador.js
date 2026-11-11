// Crea (o actualiza) el usuario entrenador.
// Uso: node scripts/crear-entrenador.js <CI> "<Nombre>" <contraseña>
// Requiere DATABASE_URL en el archivo .env o en el entorno.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(dir, '.env');
if (fs.existsSync(envFile)) for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const [ci, nombre, pass] = process.argv.slice(2);
if (!ci || !nombre || !pass) { console.error('Uso: node scripts/crear-entrenador.js <CI> "<Nombre>" <contraseña>'); process.exit(1); }
const { hash } = await import('../api/rutas.js');
const postgres = (await import('postgres')).default;
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
await sql`insert into usuarios (ci, nombre, rol, pass_hash) values (${ci.replace(/\D/g, '')}, ${nombre}, 'entrenador', ${hash(pass)})
  on conflict (ci) do update set nombre = excluded.nombre, rol = 'entrenador', pass_hash = excluded.pass_hash, activo = true`;
console.log(`Entrenador listo → CI ${ci}`);
await sql.end();
