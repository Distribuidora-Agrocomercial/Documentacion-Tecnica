import { clearSessionCookie } from '../../lib/session.js';

export default {
  async fetch() {
    return Response.json({ ok: true }, {
      status: 200,
      headers: { 'Set-Cookie': clearSessionCookie() }
    });
  }
};
