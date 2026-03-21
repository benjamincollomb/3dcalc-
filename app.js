/* ══════════════════════════════════════
   3DCalc — app.js
   Firebase Firestore + Auth
══════════════════════════════════════ */

// ── GLOBALS ──
let db, auth, fns;
let bobbinesCache = [];
let archivesCache = [];
let devisBobinesRows = [];   // rows in the devis form
let lastResultBreakdown = null;

// colour palette for filament dots
const PALETTE = ['#c8ff57','#ff6b35','#57c8ff','#ff57c8','#57ffb0','#ffc857','#c857ff','#ff5757'];

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  // wait for firebase module to expose globals
  const ready = setInterval(() => {
    if (window._auth && window._db && window._fns) {
      clearInterval(ready);
      auth = window._auth;
      db   = window._db;
      fns  = window._fns;
      document.getElementById('today-date').textContent = todayStr();
    }
  }, 80);
});

// ══════════════════════════════════════
//  AUTH
// ══════════════════════════════════════
function showLogin()    { toggle('auth-login', 'auth-register'); }
function showRegister() { toggle('auth-register', 'auth-login'); }

function toggle(show, hide) {
  document.getElementById(show).style.display = 'flex';
  document.getElementById(hide).style.display = 'none';
}

async function login() {
  clearMsg('login-msg');
  const email = v('login-email');
  const pass  = v('login-password');
  if (!email || !pass) { showMsg('login-msg', 'Remplis tous les champs.', 'error'); return; }
  try {
    await fns.signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    showMsg('login-msg', firebaseError(e), 'error');
  }
}

async function register() {
  clearMsg('reg-msg');
  const email = v('reg-email');
  const pass  = v('reg-password');
  if (!email || !pass) { showMsg('reg-msg', 'Remplis tous les champs.', 'error'); return; }
  if (pass.length < 6) { showMsg('reg-msg', 'Mot de passe min. 6 caractères.', 'error'); return; }
  try {
    await fns.createUserWithEmailAndPassword(auth, email, pass);
    showMsg('reg-msg', 'Compte créé !', 'success');
  } catch(e) {
    showMsg('reg-msg', firebaseError(e), 'error');
  }
}

async function logout() {
  await fns.signOut(auth);
}

function firebaseError(e) {
  const map = {
    'auth/wrong-password': 'Mot de passe incorrect.',
    'auth/user-not-found': 'Aucun compte avec cet email.',
    'auth/email-already-in-use': 'Email déjà utilisé.',
    'auth/invalid-email': 'Email invalide.',
    'auth/weak-password': 'Mot de passe trop faible (min. 6 chars).',
    'auth/invalid-credential': 'Email ou mot de passe incorrect.',
  };
  return map[e.code] || e.message;
}

// ══════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  document.getElementById('page-' + name)?.classList.add('active');
  document.querySelector(`.nav-link[data-page="${name}"]`)?.classList.add('active');

  if (name === 'bobines')  renderBobines();
  if (name === 'archives') renderArchives();
  if (name === 'accueil')  renderAccueil();
  if (name === 'devis')    initDevis();
}

// ══════════════════════════════════════
//  LOAD ALL DATA
// ══════════════════════════════════════
async function loadAll() {
  try {
    await Promise.all([loadBobines(), loadArchives()]);
    renderAccueil();
  } catch(e) {
    console.error('loadAll error', e);
  }
}

async function loadBobines() {
  const uid = window._uid;
  const snap = await fns.getDocs(fns.collection(db, `users/${uid}/bobines`));
  bobbinesCache = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

async function loadArchives() {
  const uid = window._uid;
  const q = fns.query(fns.collection(db, `users/${uid}/archives`), fns.orderBy('date', 'desc'));
  const snap = await fns.getDocs(q);
  archivesCache = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
}

// ══════════════════════════════════════
//  ACCUEIL
// ══════════════════════════════════════
function renderAccueil() {
  const total  = bobbinesCache.length;
  const rupture = bobbinesCache.filter(b => b.rupture).length;
  const dispo  = total - rupture;

  setEl('stat-bobines',  dispo);
  setEl('stat-rupture',  rupture);
  setEl('stat-archives', archivesCache.length);

  const last = archivesCache[0];
  if (last) {
    setEl('stat-last', last.nom || '—');
  }

  // Stat colors
  document.getElementById('stat-rupture').style.color = rupture > 0 ? 'var(--warn)' : 'var(--success)';

  // Recent list
  const el = document.getElementById('recent-list');
  if (!archivesCache.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">▤</div>Aucun devis archivé</div>`;
    return;
  }
  el.innerHTML = archivesCache.slice(0, 6).map(a => `
    <div class="recent-item" onclick='openArchiveDetail(${JSON.stringify(a._id)})'>
      <div class="recent-info">
        <div class="recent-nom">${esc(a.nom)}</div>
        <div class="recent-meta">${esc(a.typeMarge)} · marge ${a.margePct}%</div>
      </div>
      <div class="recent-date">${formatDate(a.date)}</div>
      <div class="recent-prix">${chf(a.prixArrondi)}</div>
    </div>
  `).join('');
}

// ══════════════════════════════════════
//  BOBINES
// ══════════════════════════════════════
function renderBobines() {
  const q = v('search-bobines').toLowerCase();
  const rows = bobbinesCache.filter(b =>
    !q || JSON.stringify(b).toLowerCase().includes(q)
  );

  const tbody = document.getElementById('bobines-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty-state"><div class="empty-icon">◎</div>Aucune bobine</div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map((b, i) => {
    const rupture = b.rupture;
    const dot = `<span class="color-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>`;
    return `<tr class="${rupture ? 'rupture' : ''}" data-id="${esc(b._id)}">
      <td class="mono">${esc(b.id || b._id)}</td>
      <td class="strong">${esc(b.marque)}</td>
      <td>${esc(b.matiere)}</td>
      <td>${dot}${esc(b.couleur)}</td>
      <td class="accent-val">${formatPrix(b.prix)} CHF/kg</td>
      <td>${esc(b.diametre)}</td>
      <td>${esc(b.poids)}</td>
      <td>${rupture
        ? '<span class="badge badge-warn">RUPTURE</span>'
        : '<span class="badge badge-ok">DISPO</span>'
      }</td>
      <td>${b.lien ? `<a href="${esc(b.lien)}" target="_blank" style="color:var(--accent);font-size:12px;">Commander ↗</a>` : '—'}</td>
      <td>
        <button class="btn-danger" onclick="deleteBobine('${esc(b._id)}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

async function saveBobine() {
  clearMsg('modal-bobine-msg');
  const id       = v('b-id').trim();
  const marque   = v('b-marque').trim();
  const matiere  = v('b-matiere').trim();
  const couleur  = v('b-couleur').trim();
  const prix     = parseFloat(v('b-prix'));
  const diametre = v('b-diam');
  const poids    = v('b-poids');
  const lien     = v('b-lien').trim();
  const rupture  = document.getElementById('b-rupture').checked;

  if (!id || !marque || !matiere || !couleur || isNaN(prix)) {
    showMsg('modal-bobine-msg', 'Tous les champs marqués * sont obligatoires.', 'error');
    return;
  }
  if (bobbinesCache.find(b => (b.id || b._id) === id)) {
    showMsg('modal-bobine-msg', `ID déjà utilisé : ${id}`, 'error');
    return;
  }

  try {
    const uid = window._uid;
    await fns.setDoc(fns.doc(db, `users/${uid}/bobines`, id), {
      id, marque, matiere, couleur, prix, diametre, poids, lien, rupture
    });
    await loadBobines();
    closeBobineModal();
    renderBobines();
    renderAccueil();
    showToast('Bobine ajoutée ✓');
  } catch(e) {
    showMsg('modal-bobine-msg', e.message, 'error');
  }
}

async function deleteBobine(docId) {
  if (!confirm('Supprimer cette bobine ?')) return;
  try {
    const uid = window._uid;
    await fns.deleteDoc(fns.doc(db, `users/${uid}/bobines`, docId));
    await loadBobines();
    renderBobines();
    renderAccueil();
    showToast('Bobine supprimée');
  } catch(e) {
    alert('Erreur : ' + e.message);
  }
}

function openBobineModal() {
  // Reset form
  ['b-id','b-marque','b-matiere','b-couleur','b-prix','b-lien'].forEach(id => setEl(id, '', 'val'));
  document.getElementById('b-rupture').checked = false;
  clearMsg('modal-bobine-msg');
  document.getElementById('modal-bobine').style.display = 'flex';
}

function closeBobineModal() {
  document.getElementById('modal-bobine').style.display = 'none';
}

// ══════════════════════════════════════
//  DEVIS — CALCUL
// ══════════════════════════════════════
function initDevis() {
  devisBobinesRows = [];
  document.getElementById('devis-bobines-list').innerHTML = '';
  document.getElementById('result-card').classList.add('hidden');
  lastResultBreakdown = null;
  addBobineRow();
}

function addBobineRow() {
  const disponibles = bobbinesCache.filter(b => !b.rupture);
  const idx = devisBobinesRows.length;
  const rowId = 'bobrow-' + idx;
  devisBobinesRows.push(rowId);

  const options = disponibles.map(b =>
    `<option value="${esc(b.id || b._id)}">${esc(b.id || b._id)} — ${esc(b.marque)} ${esc(b.matiere)} ${esc(b.couleur)} (${formatPrix(b.prix)} CHF/kg)</option>`
  ).join('');

  const html = `
    <div class="bobine-row" id="${rowId}">
      <div>
        <div class="bobine-row-label">Bobine</div>
        <select class="field brow-sel">${options ? `<option value="">— choisir —</option>${options}` : '<option value="">Aucune bobine disponible</option>'}</select>
      </div>
      <div>
        <div class="bobine-row-label">Grammes</div>
        <input class="field brow-g" type="number" step="0.5" placeholder="ex: 70" min="0"/>
      </div>
      <button class="btn-remove" onclick="removeBobineRow('${rowId}')">✕</button>
    </div>`;

  document.getElementById('devis-bobines-list').insertAdjacentHTML('beforeend', html);
}

function removeBobineRow(rowId) {
  document.getElementById(rowId)?.remove();
  devisBobinesRows = devisBobinesRows.filter(r => r !== rowId);
}

function calculerDevis() {
  clearMsg('devis-msg');
  document.getElementById('result-card').classList.add('hidden');

  // Collect form values
  const nom      = v('d-nom').trim();
  const client   = v('d-client').trim();
  const typeMarge = v('d-type-marge');
  const margePct = parseInt(v('d-marge')) || 0;
  const temps    = parseFloat(v('d-temps')) || 0;
  const watts    = parseFloat(v('d-watts')) || 100;
  const elecKwh  = parseFloat(v('d-elec')) || 0.33;
  const fichier  = parseFloat(v('d-fichier')) || 0;
  const amorti   = parseInt(v('d-amorti')) || 1;
  const designH  = parseFloat(v('d-design-h')) || 0;
  const designRate = parseFloat(v('d-design-rate')) || 0;

  if (!nom)    { showMsg('devis-msg', 'Nom du projet obligatoire.', 'error'); return; }
  if (temps <= 0) { showMsg('devis-msg', "Temps d'impression obligatoire (> 0).", 'error'); return; }

  // Collect bobines
  const items = [];
  document.querySelectorAll('.bobine-row').forEach(row => {
    const selEl = row.querySelector('.brow-sel');
    const gEl   = row.querySelector('.brow-g');
    const id = selEl?.value?.trim();
    const g  = parseFloat(gEl?.value) || 0;
    if (id && g > 0) {
      const bobine = bobbinesCache.find(b => (b.id || b._id) === id);
      if (bobine) items.push({ id, g, priceKg: parseFloat(bobine.prix) });
    }
  });

  if (!items.length) {
    showMsg('devis-msg', 'Ajoute au moins un filament (bobine + grammes).', 'error');
    return;
  }

  // ── COMPUTE ──
  const costElec        = (watts / 1000) * temps * elecKwh;
  const fichierAmorti   = fichier / Math.max(amorti, 1);
  const designCost      = designH * designRate;
  let   totalFilament   = 0;

  const itemsOut = items.map(it => {
    const cost = (it.g / 1000) * it.priceKg;
    totalFilament += cost;
    return { id: it.id, g: it.g, priceKg: it.priceKg, cost: round2(cost) };
  });

  const totalCost       = round2(totalFilament + costElec + fichierAmorti + designCost);
  const priceWithMargin = round2(totalCost * (1 + margePct / 100));
  const prixArrondi     = ceilTo010(priceWithMargin);

  lastResultBreakdown = {
    nom, client, typeMarge, margePct,
    temps, watts, elecKwh,
    costElec: round2(costElec),
    fichier, amorti,
    fichierAmorti: round2(fichierAmorti),
    designH, designRate,
    designCost: round2(designCost),
    items: itemsOut,
    totalFilament: round2(totalFilament),
    totalCost,
    priceWithMargin,
    prixArrondi,
    date: Date.now()
  };

  renderResult(lastResultBreakdown);
}

function renderResult(b) {
  setEl('r-elec',       chf(b.costElec));
  setEl('r-fichier',    chf(b.fichierAmorti));
  setEl('r-design',     chf(b.designCost));
  setEl('r-filament',   chf(b.totalFilament));
  setEl('r-total',      chf(b.totalCost));
  setEl('r-marge-pct',  `${b.typeMarge} ${b.margePct}%`);
  setEl('r-marge',      chf(b.priceWithMargin));
  setEl('r-arrondi',    chf(b.prixArrondi));

  // Items detail
  const el = document.getElementById('r-items');
  el.innerHTML = b.items.map(it => `
    <div class="item-line">
      <span class="item-id">${esc(it.id)}</span>
      <span>${it.g} g · ${formatPrix(it.priceKg)} CHF/kg</span>
      <span style="color:var(--accent);font-family:var(--mono)">${chf(it.cost)}</span>
    </div>
  `).join('');

  document.getElementById('result-card').classList.remove('hidden');
  document.getElementById('result-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function archiverDevis() {
  if (!lastResultBreakdown) return;
  clearMsg('archive-msg');

  const b = lastResultBreakdown;
  if (!b.nom) { showMsg('archive-msg', 'Donne un nom au projet avant.', 'error'); return; }

  try {
    const uid = window._uid;
    const data = {
      nom:         b.nom,
      client:      b.client || '',
      typeMarge:   b.typeMarge,
      margePct:    b.margePct,
      temps:       b.temps,
      watts:       b.watts,
      elecKwh:     b.elecKwh,
      costElec:    b.costElec,
      fichier:     b.fichier,
      amorti:      b.amorti,
      fichierAmorti: b.fichierAmorti,
      designH:     b.designH,
      designRate:  b.designRate,
      designCost:  b.designCost,
      items:       b.items,
      totalFilament: b.totalFilament,
      totalCost:   b.totalCost,
      priceWithMargin: b.priceWithMargin,
      prixArrondi: b.prixArrondi,
      date:        b.date || Date.now()
    };
    await fns.addDoc(fns.collection(db, `users/${uid}/archives`), data);
    await loadArchives();
    showMsg('archive-msg', '✓ Devis archivé avec succès !', 'success');
    showToast('Archivé ✓');
  } catch(e) {
    showMsg('archive-msg', 'Erreur : ' + e.message, 'error');
  }
}

// ══════════════════════════════════════
//  ARCHIVES
// ══════════════════════════════════════
function renderArchives() {
  const q = v('search-archives').toLowerCase();
  const rows = archivesCache.filter(a =>
    !q || (a.nom || '').toLowerCase().includes(q) || (a.client || '').toLowerCase().includes(q)
  );

  const tbody = document.getElementById('archives-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">▤</div>Aucune archive</div></td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(a => {
    const fils = (a.items || []).map((it, i) =>
      `<span class="color-dot" style="background:${PALETTE[i % PALETTE.length]}" title="${esc(it.id)}"></span>`
    ).join('');

    const marginBadge = badgeMarge(a.typeMarge);

    return `<tr style="cursor:pointer" onclick='openArchiveDetail("${esc(a._id)}")'>
      <td class="mono">${formatDate(a.date)}</td>
      <td class="strong">${esc(a.nom)}</td>
      <td>${esc(a.client || '—')}</td>
      <td>${marginBadge} ${a.margePct}%</td>
      <td class="mono">${a.temps ? a.temps + 'h' : '—'}</td>
      <td>${fils || '—'}</td>
      <td class="mono">${chf(a.totalCost)}</td>
      <td class="accent-val">${chf(a.prixArrondi)}</td>
      <td><button class="btn-danger" onclick="event.stopPropagation();deleteArchive('${esc(a._id)}')">✕</button></td>
    </tr>`;
  }).join('');
}

function openArchiveDetail(id) {
  const a = archivesCache.find(x => x._id === id);
  if (!a) return;

  document.getElementById('modal-archive-title').textContent = a.nom;

  const html = `
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-key">Date</div><div class="detail-val mono">${formatDate(a.date)}</div></div>
      <div class="detail-item"><div class="detail-key">Client</div><div class="detail-val">${esc(a.client || '—')}</div></div>
      <div class="detail-item"><div class="detail-key">Marge</div><div class="detail-val">${esc(a.typeMarge)} — ${a.margePct}%</div></div>
      <div class="detail-item"><div class="detail-key">Temps impression</div><div class="detail-val mono">${a.temps ? a.temps + ' h' : '—'}</div></div>
      <div class="detail-item"><div class="detail-key">Coût électricité</div><div class="detail-val mono">${chf(a.costElec)}</div></div>
      <div class="detail-item"><div class="detail-key">Fichier 3D amorti</div><div class="detail-val mono">${chf(a.fichierAmorti)}</div></div>
      ${a.designCost > 0 ? `<div class="detail-item"><div class="detail-key">Création 3D</div><div class="detail-val mono">${a.designH}h × ${a.designRate} CHF = ${chf(a.designCost)}</div></div>` : ''}
      <div class="detail-item"><div class="detail-key">Coût total</div><div class="detail-val mono">${chf(a.totalCost)}</div></div>
    </div>

    <div class="card-title">Filaments utilisés</div>
    <div class="filaments-list">
      ${(a.items || []).map((it, i) => `
        <div class="fil-item">
          <div>
            <span class="color-dot" style="background:${PALETTE[i % PALETTE.length]}"></span>
            <span class="fil-id">${esc(it.id)}</span>
          </div>
          <span>${it.g} g · ${formatPrix(it.priceKg)} CHF/kg</span>
          <span class="fil-val">${chf(it.cost)}</span>
        </div>
      `).join('')}
    </div>

    <div class="detail-item" style="border:1px solid rgba(200,255,87,0.2);border-radius:10px;padding:16px;margin-top:8px">
      <div class="detail-key">Prix arrondi final</div>
      <div class="detail-val big">${chf(a.prixArrondi)}</div>
    </div>
  `;

  document.getElementById('modal-archive-content').innerHTML = html;
  document.getElementById('modal-archive').style.display = 'flex';
}

async function deleteArchive(id) {
  if (!confirm('Supprimer cette archive ?')) return;
  try {
    await fns.deleteDoc(fns.doc(db, `users/${window._uid}/archives`, id));
    await loadArchives();
    renderArchives();
    renderAccueil();
    showToast('Archive supprimée');
  } catch(e) { alert('Erreur : ' + e.message); }
}

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════
function v(id)        { return document.getElementById(id)?.value ?? ''; }
function setEl(id, val, mode) {
  const el = document.getElementById(id);
  if (!el) return;
  if (mode === 'val') el.value = val;
  else el.textContent = val;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function chf(n)        { return (parseFloat(n) || 0).toFixed(2) + ' CHF'; }
function formatPrix(n) { return (parseFloat(n) || 0).toFixed(2); }
function round2(n)     { return Math.round((parseFloat(n) || 0) * 100) / 100; }
function ceilTo010(n)  { return Math.ceil((parseFloat(n) || 0) * 10) / 10; }

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(typeof ts === 'object' && ts.toDate ? ts.toDate() : ts);
  return d.toLocaleDateString('fr-CH', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function todayStr() {
  return new Date().toLocaleDateString('fr-CH', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function badgeMarge(type) {
  const map = { 'AMI': 'badge-ami', 'CLIENT': 'badge-warn', '7 ART': 'badge-ok', '7ART': 'badge-ok' };
  const cls = map[type] || 'badge-gray';
  return `<span class="badge ${cls}">${esc(type)}</span>`;
}

function showMsg(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = type === 'error' ? 'msg-error' : 'msg-success';
  el.style.display = 'block';
}
function clearMsg(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  el.textContent = '';
}

// ── TOAST ──
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:var(--accent);color:#000;
    font-family:var(--mono);font-size:13px;font-weight:700;
    padding:12px 20px;border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    animation:slideUp 0.2s ease;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

// Auto-preset marge from type
function applyMargePreset() {
  const type = document.getElementById('d-type-marge')?.value;
  const presets = { 'AMI': 20, '7 ART': 5, 'CLIENT': 40, 'PERSO': 0 };
  if (type in presets) {
    document.getElementById('d-marge').value = presets[type];
  }
}

// Auto-générer l'ID bobine depuis les champs
function autoIdBobine() {
  const marque  = v('b-marque').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const matiere = v('b-matiere').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const couleur = v('b-couleur').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const diam    = document.getElementById('b-diam')?.value === '1,75 mm' ? '175' : '285';
  if (matiere && marque && couleur) {
    document.getElementById('b-id').value = `${matiere}-${marque}-${couleur}-${diam}`;
  }
}
