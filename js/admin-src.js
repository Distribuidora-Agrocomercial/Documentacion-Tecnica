import { upload } from '@vercel/blob/client';

/* ─── STATE ─────────────────────────────────────────────── */
let catalogData = [];
let selectedFile = null;

/* ─── HELPERS ───────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function toast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => t.className = '', 3000);
}

function setProgress(pct, label) {
  $('progress-fill').style.width = pct + '%';
  $('progress-label').textContent = label;
}

function showPanel() {
  $('login-screen').style.display = 'none';
  $('admin-panel').style.display  = 'block';
  $('btn-logout').style.display   = 'inline-flex';
  $('user-info').textContent      = '📂 Panel de administración';
}

/* ─── LOGIN ─────────────────────────────────────────────── */
async function login() {
  const password = $('token-input').value;
  if (!password) return;

  const btn = $('btn-login');
  btn.disabled = true;
  btn.textContent = 'Verificando...';
  $('login-error').style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Contraseña incorrecta');
    }

    $('token-input').value = '';
    showPanel();
    await cargarCatalogo();
  } catch (e) {
    $('login-error').textContent = e.message;
    $('login-error').style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Ingresar';
  }
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.reload();
}

async function checkSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.authenticated) {
      showPanel();
      await cargarCatalogo();
    }
  } catch {
    // Ignore — user just sees the login screen.
  }
}

window.addEventListener('DOMContentLoaded', () => {
  checkSession();

  $('btn-login').addEventListener('click', login);
  $('btn-logout').addEventListener('click', logout);
  $('token-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });

  $('cat-search').addEventListener('input', filtrarLista);

  $('f-file').addEventListener('change', onFileSelect);
  $('btn-upload').addEventListener('click', subirDocumento);

  const uploadZone = $('upload-zone');
  uploadZone.addEventListener('click', () => $('f-file').click());
  uploadZone.addEventListener('dragover', e => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', handleDrop);
});

/* ─── CARGAR CATÁLOGO (archivo público, sin autenticación) ── */
async function cargarCatalogo() {
  try {
    const res = await fetch(`/catalogo.json?t=${Date.now()}`);
    if (!res.ok) throw new Error('No se encontró catalogo.json');
    catalogData = await res.json();
    renderStats();
    renderLista(catalogData);
  } catch (e) {
    toast('Error cargando catálogo: ' + e.message, 'error');
  }
}

/* ─── ESTADÍSTICAS ───────────────────────────────────────── */
function renderStats() {
  const productos = new Set(catalogData.map(i => i.producto.toUpperCase()));
  const hojas     = catalogData.filter(i => i.tipo === 'hoja').length;
  const panfletos = catalogData.filter(i => i.tipo === 'panfleto').length;
  const fichas    = catalogData.filter(i => i.tipo === 'ficha').length;
  $('st-total').textContent     = productos.size;
  $('st-hojas').textContent     = hojas;
  $('st-panfletos').textContent = panfletos;
  $('st-fichas').textContent    = fichas;
}

/* Etiquetas legibles por tipo de documento */
const TIPO_LABELS = {
  hoja: 'Hoja',
  panfleto: 'Panfleto',
  ficha: 'Ficha Técnica'
};

/* ─── LISTA CATÁLOGO ─────────────────────────────────────── */
function renderLista(data) {
  const list = $('cat-list');

  // Agrupar por producto, manteniendo cada documento individual
  const productos = {};
  data.forEach(item => {
    const k = item.producto.toUpperCase();
    if (!productos[k]) productos[k] = { nombre: item.producto, docs: [] };
    productos[k].docs.push(item);
  });

  const entries = Object.values(productos).sort((a,b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty">Sin resultados</div>';
    return;
  }

  list.innerHTML = entries.map(p => `
    <div class="cat-item">
      <div class="cat-item-name">${escHtml(p.nombre)}</div>
      <div class="cat-item-docs">
        ${p.docs.map(d => `
          <div class="doc-row">
            <span class="tag ${escHtml(d.tipo)}">${escHtml(TIPO_LABELS[d.tipo] || d.tipo)}</span>
            <span class="doc-file" title="${escHtml(d.nombre)}">${escHtml(d.nombre)}</span>
            <button class="btn-del" data-producto="${escHtml(d.producto)}" data-tipo="${escHtml(d.tipo)}" data-nombre="${escHtml(d.nombre)}">Eliminar</button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// Delegación de eventos para los botones de eliminar (evita problemas
// con comillas/caracteres especiales en nombres de producto o archivo)
document.addEventListener('DOMContentLoaded', () => {
  $('cat-list').addEventListener('click', e => {
    const btn = e.target.closest('.btn-del');
    if (!btn) return;
    eliminarDocumento(btn.dataset.producto, btn.dataset.tipo, btn.dataset.nombre);
  });
});

function filtrarLista() {
  const q = $('cat-search').value.toLowerCase();
  const filtrado = catalogData.filter(i => i.producto.toLowerCase().includes(q));
  renderLista(filtrado);
}

/* ─── ARCHIVO ────────────────────────────────────────────── */
function onFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  selectedFile = file;
  $('file-name-label').textContent = file.name;
  $('btn-upload').disabled = false;
}

function handleDrop(e) {
  e.preventDefault();
  $('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    selectedFile = file;
    $('file-name-label').textContent = file.name;
    $('btn-upload').disabled = false;
  }
}

/* ─── SUBIR DOCUMENTO (directo a Vercel Blob) ────────────── */
async function subirDocumento() {
  const producto = $('f-producto').value.trim();
  const tipo     = $('f-tipo').value;

  if (!producto) {
    toast('Escribí el nombre del producto', 'error');
    return;
  }
  if (!selectedFile) {
    toast('Seleccioná un archivo PDF', 'error');
    return;
  }
  if (selectedFile.type !== 'application/pdf') {
    toast('El archivo debe ser un PDF', 'error');
    return;
  }

  const safeName = selectedFile.name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9.\-_]/g, '');

  const exists = catalogData.some(i =>
    i.producto.toLowerCase() === producto.toLowerCase() &&
    i.tipo === tipo &&
    i.nombre === safeName
  );
  if (exists) {
    toast('Este documento ya existe en el catálogo', 'error');
    return;
  }

  const btn = $('btn-upload');
  btn.disabled = true;
  $('progress-wrap').style.display = 'block';
  setProgress(0, 'Subiendo...');

  try {
    const blob = await upload(safeName, selectedFile, {
      access: 'public',
      handleUploadUrl: '/api/admin/upload',
      clientPayload: JSON.stringify({ producto, tipo, nombre: safeName }),
      onUploadProgress: ({ percentage }) => setProgress(percentage, `Subiendo... ${percentage}%`)
    });

    setProgress(100, 'Actualizando catálogo...');

    catalogData = [...catalogData, { producto, tipo, nombre: safeName, url: blob.url }];
    renderStats();
    renderLista(catalogData);

    toast(`✓ "${producto}" agregado correctamente`);

    setTimeout(() => {
      $('f-producto').value = '';
      selectedFile = null;
      $('f-file').value = '';
      $('file-name-label').textContent = '';
      $('btn-upload').disabled = true;
      $('progress-wrap').style.display = 'none';
      setProgress(0, '');
    }, 1500);
  } catch (e) {
    toast(e.message, 'error');
    $('progress-wrap').style.display = 'none';
    btn.disabled = false;
  }
}

/* ─── ELIMINAR (documento individual) ────────────────────── */
async function eliminarDocumento(producto, tipo, nombre) {
  const tipoLabel = TIPO_LABELS[tipo] || tipo;

  if (!confirm(`¿Eliminar "${nombre}" (${tipoLabel}) de "${producto}"?`)) return;

  try {
    const res = await fetch('/api/admin/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto, tipo, nombre })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');

    catalogData = catalogData.filter(i =>
      !(
        i.producto.toUpperCase() === producto.toUpperCase() &&
        i.tipo === tipo &&
        i.nombre === nombre
      )
    );
    renderStats();
    renderLista(catalogData);
    toast(`"${nombre}" eliminado del catálogo`);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
  }
}

/* ─── UTILS ──────────────────────────────────────────────── */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
