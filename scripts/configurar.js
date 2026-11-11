// Pide la contraseña de la base de Supabase y escribe el archivo .env (no muestra la contraseña).
// Uso: node scripts/configurar.js
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROYECTO = 'sekaaimmrfgsrjgmtblt';
const HOST = 'aws-0-sa-east-1.pooler.supabase.com';

function preguntarOculto(texto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(texto)) rl.output.write(texto); };
    rl.question(texto, (r) => { rl.close(); process.stdout.write('\n'); resolve(r.trim()); });
  });
}

const pass = await preguntarOculto('Pegá la contraseña de la base de Supabase y apretá Enter: ');
if (!pass) { console.log('No escribiste nada. No se cambió el .env.'); process.exit(1); }
const url = `postgresql://postgres.${PROYECTO}:${encodeURIComponent(pass)}@${HOST}:6543/postgres`;
fs.writeFileSync(path.join(dir, '.env'), `# Conexión a Supabase — este archivo NO se sube a GitHub\nDATABASE_URL=${url}\n`);
console.log('Listo: .env guardado. Probando la conexión...\n');
await import('./verificar.js');
