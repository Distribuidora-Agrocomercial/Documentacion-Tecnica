import { requireSession } from '../../lib/session.js';

export default async function handler(request) {
  return Response.json({ authenticated: requireSession(request) });
}
