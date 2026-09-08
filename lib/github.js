const OWNER  = process.env.GITHUB_OWNER;
const REPO   = process.env.GITHUB_REPO;
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const CATALOG = 'catalogo.json';

function assertConfigured() {
  if (!process.env.GITHUB_TOKEN || !OWNER || !REPO) {
    throw new Error('Faltan variables de entorno GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO');
  }
}

async function gh(path, opts = {}) {
  assertConfigured();
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {})
    }
  });
}

export async function getCatalog() {
  const res = await gh(`/repos/${OWNER}/${REPO}/contents/${CATALOG}?ref=${BRANCH}`);
  if (!res.ok) throw new Error('No se pudo leer catalogo.json');
  const data = await res.json();
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
  return { content, sha: data.sha };
}

export async function putCatalog(newContent, sha, message) {
  const body = Buffer.from(JSON.stringify(newContent, null, 2), 'utf-8').toString('base64');
  const res = await gh(`/repos/${OWNER}/${REPO}/contents/${CATALOG}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: body, sha, branch: BRANCH })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error actualizando catalogo.json');
  }
}
