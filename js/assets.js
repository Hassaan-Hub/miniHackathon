import { db } from '/js/firebase-config.js';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireRole } from '/js/middleware.js';
import { setupNav, populateUser, setupMobileMenu, getSidebar } from '/js/middleware.js';
import { showToast, statusBadge, esc, openModal, closeModal, setupModals } from '/js/utils.js';

const QRCodeScript = document.createElement('script');
QRCodeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
document.head.appendChild(QRCodeScript);

let currentOrgId = null;
let assetsData = {};

function safeOn(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

requireRole(['admin', 'manager'], async (user, userData) => {
  document.getElementById('sidebar').innerHTML = getSidebar('assets', userData.role);
  setupNav('assets');
  populateUser(userData);
  setupMobileMenu();
  setupModals();

  currentOrgId = userData.orgId;

  if (!currentOrgId) {
    document.getElementById('assets-list').innerHTML =
      '<tr><td colspan="6"><div class="empty-state"><h3>Configuration Error</h3><p>Your account is not linked to an organization.</p></div></td></tr>';
    return;
  }

  const q = query(collection(db, 'assets'), where('orgId', '==', currentOrgId));
  onSnapshot(q, (snap) => {
    assetsData = {};
    snap.forEach(d => { assetsData[d.id] = { id: d.id, ...d.data() }; });
    renderAssets();
  }, (err) => {
    console.error('[assets] Snapshot error:', err);
    showToast('Error loading assets: ' + err.message, 'error');
  });

  safeOn('addAssetBtn', 'click', () => {
    const form = document.getElementById('assetForm');
    if (form) form.reset();
    const idField = document.getElementById('assetId');
    if (idField) idField.value = '';
    const title = document.getElementById('modalTitle');
    if (title) title.textContent = 'Add New Asset';
    openModal('assetModal');
  });

  safeOn('saveAssetBtn', 'click', saveAsset);
  safeOn('searchInput', 'input', renderAssets);
  safeOn('categoryFilter', 'change', renderAssets);
  safeOn('statusFilter', 'change', renderAssets);
  safeOn('cancelAssetBtn', 'click', () => closeModal('assetModal'));
});

async function saveAsset() {
  const btn = document.getElementById('saveAssetBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    const id = document.getElementById('assetId')?.value;

    const data = {
      orgId: currentOrgId,
      name: document.getElementById('assetName')?.value?.trim() || '',
      category: document.getElementById('assetCategory')?.value || '',
      location: document.getElementById('assetLocation')?.value?.trim() || '',
      status: document.getElementById('assetStatus')?.value || 'operational',
      installDate: document.getElementById('assetInstallDate')?.value || null,
      warrantyExpiry: document.getElementById('assetWarranty')?.value || null,
      updatedAt: serverTimestamp()
    };

    if (id) {
      await updateDoc(doc(db, 'assets', id), data);
      showToast('Asset updated successfully', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'assets'), data);
      showToast('Asset created successfully', 'success');
    }

    closeModal('assetModal');
    const form = document.getElementById('assetForm');
    if (form) form.reset();
  } catch (err) {
    console.error('[assets] Save error:', err);
    showToast('Error saving asset: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Save Asset';
}

function renderAssets() {
  const tbody = document.getElementById('assets-list');
  if (!tbody) return;
  const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const status = document.getElementById('statusFilter')?.value || '';

  let filtered = Object.values(assetsData).filter(a => {
    if (search && !a.name?.toLowerCase().includes(search) && !a.location?.toLowerCase().includes(search)) return false;
    if (category && a.category !== category) return false;
    if (status && a.status !== status) return false;
    return true;
  });

  filtered.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><h3>No assets found</h3><p>Add your first asset to get started</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(a => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" class="w-5 h-5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
          </div>
          <div>
            <div class="font-medium">${esc(a.name)}</div>
          </div>
        </div>
      </td>
      <td><span class="badge badge-secondary">${esc(a.category || 'N/A')}</span></td>
      <td class="text-slate-500 text-xs">${esc(a.location || 'N/A')}</td>
      <td>${statusBadge(a.status || 'operational')}</td>
      <td id="issue-count-${a.id}">-</td>
      <td>
        <div class="flex gap-1.5">
          <button class="btn btn-secondary btn-xs asset-action-btn" data-action="viewQR" data-id="${a.id}" title="QR Code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/></svg>
          </button>
          <button class="btn btn-secondary btn-xs asset-action-btn" data-action="editAsset" data-id="${a.id}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-secondary btn-xs asset-action-btn text-red-600" data-action="deleteAsset" data-id="${a.id}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          </button>
          <a href="/asset-detail.html?id=${a.id}" class="btn btn-secondary btn-xs" title="Detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </a>
        </div>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.asset-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'viewQR') viewQR(id);
      if (action === 'editAsset') editAsset(id);
      if (action === 'deleteAsset') deleteAsset(id);
    });
  });

  filtered.forEach(async a => {
    try {
      const issuesSnap = await getDocs(query(collection(db, 'issues'), where('assetId', '==', a.id), where('status', 'in', ['reported', 'triaged', 'assigned', 'in_progress'])));
      const el = document.getElementById(`issue-count-${a.id}`);
      if (el) el.innerHTML = issuesSnap.size > 0 ? `<span class="badge badge-danger">${issuesSnap.size}</span>` : '<span class="text-slate-500">0</span>';
    } catch (err) {
      console.error('[assets] Failed to fetch issue count for asset', a.id, err);
    }
  });
}

function editAsset(id) {
  const asset = assetsData[id];
  if (!asset) return;
  const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  setVal('assetId', id);
  setVal('assetName', asset.name);
  setVal('assetCategory', asset.category);
  setVal('assetLocation', asset.location);
  setVal('assetStatus', asset.status || 'operational');
  setVal('assetInstallDate', asset.installDate);
  setVal('assetWarranty', asset.warrantyExpiry);
  const title = document.getElementById('modalTitle');
  if (title) title.textContent = 'Edit Asset';
  openModal('assetModal');
}

async function deleteAsset(id) {
  if (!confirm('Are you sure you want to delete this asset?')) return;
  try {
    await deleteDoc(doc(db, 'assets', id));
    showToast('Asset deleted', 'success');
  } catch (err) {
    showToast('Error deleting asset: ' + err.message, 'error');
  }
}

function viewQR(id) {
  const asset = assetsData[id];
  if (!asset) return;

  const qrUrl = `${window.location.origin}/asset/${id}`;
  const display = document.getElementById('qrDisplay');
  if (!display) return;
  display.innerHTML = '';

  const generateQR = () => {
    if (typeof QRCode === 'undefined') {
      setTimeout(generateQR, 100);
      return;
    }
    new QRCode(display, {
      text: qrUrl,
      width: 200,
      height: 200,
      colorDark: '#0f172a',
      colorLight: '#ffffff'
    });
  };
  generateQR();

  const nameEl = document.getElementById('qrAssetName');
  if (nameEl) nameEl.textContent = asset.name;
  openModal('qrModal');

  const downloadBtn = document.getElementById('downloadQr');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const canvas = display.querySelector('canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `QR-${asset.name.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
    };
  }
}
