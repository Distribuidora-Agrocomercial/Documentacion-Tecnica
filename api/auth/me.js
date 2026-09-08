import { requireSession } from '../../lib/session.js';

export default {
  async fetch(request) {
    return Response.json({ authenticated: requireSession(request) });
  }
};
