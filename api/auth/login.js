import crypto from 'node:crypto';
import { createSessionCookie } from '../../lib/session.js';

function safeEqual(a, b) {
  // Hash both to a fixed length first so length never leaks via timingSafeEqual's early throw.
  const aHash = crypto.createHash('sha256').update(String(a)).digest();
  const bHash = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return Response.json({ error: 'ADMIN_PASSWORD no configurado en el servidor' }, { status: 500 });
  }

  const { password } = await request.json().catch(() => ({}));

  if (!password || !safeEqual(password, adminPassword)) {
    await new Promise(r => setTimeout(r, 400)); // slow down brute-force attempts
    return Response.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  return Response.json({ ok: true }, {
    status: 200,
    headers: { 'Set-Cookie': createSessionCookie() }
  });
}
