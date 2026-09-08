import { requireSession } from '../../lib/session.js';
import { getCatalog, putCatalog } from '../../lib/github.js';
import { del } from '@vercel/blob';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405 });
  }
  if (!requireSession(request)) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { producto, tipo, nombre } = await request.json().catch(() => ({}));
  if (!producto || !tipo || !nombre) {
    return Response.json({ error: 'Faltan datos (producto/tipo/nombre)' }, { status: 400 });
  }

  try {
    const { content: catalogData, sha } = await getCatalog();

    const updatedData = catalogData.filter(i =>
      !(
        i.producto.toUpperCase() === producto.toUpperCase() &&
        i.tipo === tipo &&
        i.nombre === nombre
      )
    );

    if (updatedData.length === catalogData.length) {
      return Response.json({ error: 'No se encontró el documento a eliminar' }, { status: 404 });
    }

    await putCatalog(updatedData, sha, `Eliminar documento: ${nombre} (${producto} · ${tipo})`);

    // Best-effort: free storage if this document lived in Vercel Blob (not a legacy /uploads/ repo file).
    const removed = catalogData.find(i =>
      i.producto.toUpperCase() === producto.toUpperCase() &&
      i.tipo === tipo &&
      i.nombre === nombre
    );
    if (removed?.url && !removed.url.startsWith('/uploads/')) {
      try {
        await del(removed.url);
      } catch (e) {
        console.error('No se pudo eliminar el blob:', e.message);
      }
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
