import { db } from '/js/firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast, statusBadge, esc, formatDate, formatDateTime, uploadFile } from '/js/utils.js';

let assetId = null;
const params = new URLSearchParams(window.location.search);
assetId = params.get('id');

if (!assetId) {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  if (pathParts.length >= 2 && pathParts[0] === 'asset') {
    assetId = pathParts[1];
  }
}

if (!assetId) {
  const loading = document.getElementById('loadingState');
  const notFound = document.getElementById('notFoundState');
  if (loading) loading.style.display = 'none';
  if (notFound) notFound.style.display = 'block';
} else {
  loadAsset(assetId);
}

async function loadAsset(id) {
  try {
    const assetDoc = await getDoc(doc(db, 'assets', id));
    if (!assetDoc.exists()) {
      const loading = document.getElementById('loadingState');
      const notFound = document.getElementById('notFoundState');
      if (loading) loading.style.display = 'none';
      if (notFound) notFound.style.display = 'block';
      return;
    }

    const asset = assetDoc.data();

    const setTxt = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val; };
    setTxt('assetName', asset.name);
    setTxt('assetLocation', asset.location || '');
    document.title = `${asset.name} — MaintainIQ`;

    const loading = document.getElementById('loadingState');
    const content = document.getElementById('assetContent');
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = 'block';

    setTxt('assetTitle', asset.name);
    const statusEl = document.getElementById('assetStatus');
    if (statusEl) {
      statusEl.textContent = (asset.status || 'operational').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      statusEl.className = `asset-status-indicator ${asset.status || 'operational'}`;
    }

    setTxt('assetCategory', asset.category || 'N/A');
    setTxt('assetLocationInfo', asset.location || 'N/A');
    setTxt('assetInstall', asset.installDate || 'N/A');
    setTxt('assetWarranty', asset.warrantyExpiry || 'N/A');

    if (asset.photoUrl) {
      const section = document.getElementById('assetPhotoSection');
      const photo = document.getElementById('assetPhoto');
      if (section) section.style.display = 'block';
      if (photo) { photo.src = asset.photoUrl; photo.alt = asset.name; }
    }

    document.querySelectorAll('.tab-btns button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btns button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tabReport = document.getElementById('tab-report');
        const tabHistory = document.getElementById('tab-history');
        const tabIssues = document.getElementById('tab-issues');
        if (tabReport) tabReport.style.display = btn.dataset.tab === 'report' ? 'block' : 'none';
        if (tabHistory) tabHistory.style.display = btn.dataset.tab === 'history' ? 'block' : 'none';
        if (tabIssues) tabIssues.style.display = btn.dataset.tab === 'issues' ? 'block' : 'none';

        if (btn.dataset.tab === 'history') loadHistory(id);
        if (btn.dataset.tab === 'issues') loadOpenIssues(id);
      });
    });

    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
      reportForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitIssueReport(id, asset.orgId);
      });
    }

    const reportPhotos = document.getElementById('reportPhotos');
    if (reportPhotos) {
      reportPhotos.addEventListener('change', (e) => {
        const preview = document.getElementById('reportPhotoPreview');
        if (!preview) return;
        preview.innerHTML = '';
        Array.from(e.target.files).forEach(file => {
          const img = document.createElement('img');
          img.src = URL.createObjectURL(file);
          preview.appendChild(img);
        });
      });
    }

    if (window.location.hash === '#report') {
      const reportBtn = document.getElementById('reportBtn');
      if (reportBtn) reportBtn.scrollIntoView({ behavior: 'smooth' });
    }

  } catch (err) {
    console.error('[public-asset] Error loading asset:', err);
    const loading = document.getElementById('loadingState');
    const notFound = document.getElementById('notFoundState');
    if (loading) loading.style.display = 'none';
    if (notFound) notFound.style.display = 'block';
  }
}

async function submitIssueReport(assetId, orgId) {
  const btn = document.getElementById('submitReport');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    const description = document.getElementById('reportDesc')?.value?.trim() || '';
    const urgency = document.getElementById('reportUrgency')?.value || 'medium';
    const name = document.getElementById('reportName')?.value?.trim() || 'Anonymous';
    const contact = document.getElementById('reportContact')?.value?.trim() || '';
    const files = document.getElementById('reportPhotos')?.files;

    const photoUrls = [];
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFile(files[i], `reports/${assetId}/${Date.now()}-${i}`);
        photoUrls.push(url);
      }
    }

    let assetCategory = '';
    try {
      const assetDoc = await getDoc(doc(db, 'assets', assetId));
      if (assetDoc.exists()) assetCategory = assetDoc.data().category || '';
    } catch (_) {}

    await addDoc(collection(db, 'issues'), {
      assetId,
      orgId,
      description,
      category: assetCategory,
      urgency,
      status: 'reported',
      reportedBy: contact || name,
      reporterName: name,
      reporterContact: contact,
      photos: photoUrls,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, 'serviceHistory'), {
      assetId,
      orgId,
      action: 'reported',
      performedBy: name,
      notes: `Issue reported: ${description.substring(0, 100)}`,
      timestamp: serverTimestamp()
    });

    showToast('Issue reported successfully! Thank you for your report.', 'success');
    const form = document.getElementById('reportForm');
    if (form) form.reset();
    const preview = document.getElementById('reportPhotoPreview');
    if (preview) preview.innerHTML = '';

  } catch (err) {
    console.error('[public-report] Error:', err);
    showToast('Error submitting report. Please try again.', 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Submit Report';
}

async function loadHistory(assetId) {
  const container = document.getElementById('historyList');
  if (!container) return;

  try {
    const q = query(collection(db, 'serviceHistory'), where('assetId', '==', assetId));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = '<div class="card"><div class="empty-state"><p>No service history yet</p></div></div>';
      return;
    }

    const sortedDocs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

    const actionColors = {
      reported: '#dc2626',
      triaged: '#f59e0b',
      assigned: '#2563eb',
      status_change: '#0891b2',
      resolved: '#16a34a',
      closed: '#64748b'
    };

    container.innerHTML = sortedDocs.map(log => {
      return `
        <div class="timeline-item">
          <div class="time">${formatDateTime(log.timestamp)}</div>
          <div class="content">
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" style="background:${actionColors[log.action] || '#64748b'};"></span>
              <strong class="capitalize">${(log.action || '').replace(/_/g, ' ')}</strong>
            </span>
            ${log.notes ? `<p class="text-slate-500 text-xs mt-1">${esc(log.notes)}</p>` : ''}
            <p class="text-slate-400 text-xs mt-1">by ${esc(log.performedBy || 'System')}</p>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('[public-asset] History error:', err);
    container.innerHTML = '<p class="text-slate-500 text-center p-4">Error loading history</p>';
  }
}

async function loadOpenIssues(assetId) {
  const container = document.getElementById('openIssuesList');
  if (!container) return;

  try {
    const q = query(collection(db, 'issues'), where('assetId', '==', assetId));
    const snap = await getDocs(q);

    const openIssues = snap.docs.filter(d => {
      const status = d.data().status;
      return ['reported', 'triaged', 'assigned', 'in_progress'].includes(status);
    });

    if (openIssues.length === 0) {
      container.innerHTML = '<div class="card"><div class="empty-state"><p>No open issues for this asset</p></div></div>';
      return;
    }

    container.innerHTML = openIssues.map(d => {
      const issue = d.data();
      return `
        <div class="card mb-3">
          <div class="card-body">
            <div class="flex gap-2 mb-2">
              ${statusBadge(issue.urgency || 'low')}
              ${statusBadge(issue.status)}
            </div>
            <p class="text-sm">${esc(issue.description || 'No description')}</p>
            <p class="text-xs text-slate-400 mt-2">Reported ${formatDateTime(issue.createdAt)}</p>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('[public-asset] Issues error:', err);
    container.innerHTML = '<p class="text-slate-500 text-center p-4">Error loading issues</p>';
  }
}
