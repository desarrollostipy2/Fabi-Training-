// Función de Netlify: atiende todas las rutas /api/* con la misma lógica que el servidor local.
import { manejar } from '../../api/rutas.js';

export default async (request) => {
  const url = new URL(request.url);
  const body = ['POST', 'PUT'].includes(request.method) ? await request.text() : '';
  const headers = Object.fromEntries([...request.headers].map(([k, v]) => [k.toLowerCase(), v]));
  const r = await manejar({ metodo: request.method, ruta: url.pathname, query: url.searchParams, headers, body });
  return new Response(r.body, { status: r.status, headers: r.headers });
};

export const config = { path: '/api/*' };
