import { handleUpload } from '@vercel/blob/client';
import { requireSession } from '../../lib/session.js';
import { getCatalog, putCatalog } from '../../lib/github.js';

const MAX_SIZE_BYTES = 30 * 1024 * 1024; // 30MB safety cap per document

export default {
  async fetch(request) {
    const body = await request.json();

    try {
      const jsonResponse = await handleUpload({
        body,
        request,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          if (!requireSession(request)) {
            throw new Error('No autenticado');
          }

          let payload;
          try {
            payload = JSON.parse(clientPayload || '{}');
          } catch {
            throw new Error('clientPayload inválido');
          }

          const { producto, tipo, nombre } = payload;
          if (!producto || !tipo || !nombre) {
            throw new Error('Faltan datos del documento (producto/tipo/nombre)');
          }
          if (!['hoja', 'panfleto', 'ficha'].includes(tipo)) {
            throw new Error('Tipo de documento inválido');
          }

          return {
            allowedContentTypes: ['application/pdf'],
            addRandomSuffix: true,
            maximumSizeInBytes: MAX_SIZE_BYTES,
            tokenPayload: JSON.stringify({ producto, tipo, nombre })
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          const { producto, tipo, nombre } = JSON.parse(tokenPayload);

          const { content: catalogData, sha } = await getCatalog();

          const exists = catalogData.some(i =>
            i.producto.toLowerCase() === producto.toLowerCase() &&
            i.tipo === tipo &&
            i.nombre === nombre
          );
          if (exists) return;

          const updatedData = [...catalogData, { producto, tipo, nombre, url: blob.url }];
          await putCatalog(updatedData, sha, `Agregar ${tipo}: ${producto} (${nombre})`);
        }
      });

      return Response.json(jsonResponse);
    } catch (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }
};
