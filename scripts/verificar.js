// Verifica la conexión a Supabase y el estado de las tablas (no muestra la contraseña).
// Uso: node scripts/verificar.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(dir, '.env');
if (fs.existsSync(envFile)) for (const l of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
  const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(l); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const url = process.env.DATABASE_URL || '';
if (!url) { console.log('No hay DATABASE_URL en .env'); process.exit(1); }
if (url.includes('TU_CONTRASEÑA') || url.includes('[YOUR-PASSWORD]')) { console.log('El .env todavía tiene el texto de ejemplo en lugar de la contraseña.'); process.exit(1); }
try { const u = new URL(url); console.log('Servidor:', u.hostname, 'puerto', u.port, 'usuario', u.username); } catch { console.log('La dirección no tiene un formato válido (¿la contraseña tiene símbolos como @ # / : ?)'); process.exit(1); }
const sql = postgres(url, { prepare: false, connect_timeout: 15 });
try {
  await sql`select 1`;
  console.log('Conexión: OK');
  const tablas = (await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`).map((r) => r.table_name);
  console.log('Tablas:', tablas.join(', ') || '(ninguna)');
  for (const t of ['usuarios', 'ejercicios', 'alimentos']) if (tablas.includes(t)) {
    const [r] = await sql.unsafe(`select count(*)::int as n from ${t}`); console.log(`  ${t}: ${r.n}`);
  }
} catch (e) {
  console.log('Error:', e.code || '', e.message);
} finally { await sql.end(); }
