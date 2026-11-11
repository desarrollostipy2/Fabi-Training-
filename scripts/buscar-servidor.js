// Prueba los servidores "pooler" de Supabase hasta encontrar el del proyecto y corrige el .env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(dir, '.env');
const linea = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
const u = new URL(linea.slice('DATABASE_URL='.length));
const regiones = ['sa-east-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'ca-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-central-2', 'eu-north-1', 'ap-south-1', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2'];
for (const pref of ['aws-1', 'aws-0']) for (const r of regiones) {
  const host = `${pref}-${r}.pooler.supabase.com`;
  u.hostname = host;
  const sql = postgres(u.toString(), { prepare: false, connect_timeout: 8, max: 1 });
  try {
    await sql`select 1`;
    console.log('ENCONTRADO:', host);
    fs.writeFileSync(envPath, `# Conexión a Supabase — este archivo NO se sube a GitHub\nDATABASE_URL=${u.toString()}\n`);
    await sql.end(); process.exit(0);
  } catch (e) {
    const msg = String(e.message);
    if (/password authentication failed/i.test(msg)) { console.log('ENCONTRADO', host, 'pero la contraseña es incorrecta'); await sql.end(); process.exit(2); }
    console.log(host, '→', msg.slice(0, 60));
  }
  await sql.end({ timeout: 1 }).catch(() => {});
}
console.log('No se encontró el servidor.');
