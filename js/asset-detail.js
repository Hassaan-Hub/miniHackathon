import { db } from '/js/firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireAuth } from '/js/middleware.js';
import { setupNav, populateUser, setupMobileMenu, getSidebar } from '/js/middleware.js';
import { showToast, statusBadge, esc, formatDate, formatDateTime, openModal, closeModal, setupModals } from '/js/utils.js';

const params = new URLSearchParams(window.location.search);
const assetId = params.get('id');

if (!assetId) {
  window.location.href = '/assets.html';
}

requireAuth(async (user, userData) => {
  document.getElementById('sidebar').innerHTML = getSidebar('assets', userData.role);
  setupNav('assets');
  populateUser(userData);
  setupMobileMenu();
  setupModals();

  const cancelBtn = document.getElementById('cancelQrBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('qrModal'));

  if (!assetId) return;

  try {
    const assetDoc = await getDoc(doc(db, 'assets', assetId));
    if (!assetDoc.exists()) {
      window.location.href = '/assets.html';
      return;
    }

    const asset = assetDoc.data();
    const contentEl = document.getElementById('content');
    const loadingEl = document.getElementById('loading');
    if (contentEl) contentEl.style.display = 'block';
    if (loadingEl) loadingEl.style.display = 'none';

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('assetName', asset.name);
    setTxt('assetLocation', asset.location || '');
    document.title = `${asset.name} — MaintainIQ`;

    const statusEl = document.getElementById('assetStatus');
    if (statusEl) {
      statusEl.textContent = (asset.status || 'operational').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      statusEl.className = `asset-status-indicator ${asset.status || 'operational'}`;
    }
    setTxt('assetCategory', asset.category || 'N/A');
    setTxt('detailLocation', asset.location || 'N/A');
    setTxt('detailInstall', asset.installDate || 'N/A');
    setTxt('detailWarranty', asset.warrantyExpiry || 'N/A');

    const publicUrl = `/asset/${assetId}`;
    const publicLink = document.getElementById('publicLink');
    if (publicLink) publicLink.href = publicUrl;

    const QRScript = document.createElement('script');
    QRScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    document.head.appendChild(QRScript);

    const viewQrBtn = document.getElementById('viewQrBtn');
    if (viewQrBtn) {
      viewQrBtn.addEventListener('click', () => {
        const display = document.getElementById('qrDisplay');
        if (!display) return;
        display.innerHTML = '';
        const generateQR = () => {
          if (typeof QRCode === 'undefined') { setTimeout(generateQR, 100); return; }
          new QRCode(display, { text: window.location.origin + publicUrl, width: 200, height: 200, colorDark: '#0f172a', colorLight: '#ffffff' });
        };
        generateQR();
        openModal('qrModal');
      });
    }

    const issuesSnap = await getDocs(query(collection(db, 'issues'), where('assetId', '==', assetId)));
    setTxt('detailTotalIssues', issuesSnap.size);

    const issuesDocs = issuesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    const techIds = [...new Set(issuesDocs.map(d => d.assignedTo).filter(Boolean))];
    const techMap = {};
    await Promise.all(techIds.map(async id => {
      try {
        const uDoc = await getDoc(doc(db, 'users', id));
        if (uDoc.exists()) techMap[id] = uDoc.data();
      } catch (err) {
        console.error('[asset-detail] Failed to load tech:', id, err);
      }
    }));

    const issuesTbody = document.getElementById('issueHistory');
    if (issuesTbody) {
      if (issuesDocs.length === 0) {
        issuesTbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>No issues reported yet</p></div></td></tr>';
      } else {
        issuesTbody.innerHTML = issuesDocs.map(i => {
          const tech = techMap[i.assignedTo] || {};
          return `<tr>
            <td><code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs">${i.id.substring(0, 6).toUpperCase()}</code></td>
            <td class="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">${esc(i.description || '')}</td>
            <td>${statusBadge(i.status)}</td>
            <td>${statusBadge(i.urgency || 'low')}</td>
            <td>${tech.name ? esc(tech.name) : '<span class="text-slate-400">-</span>'}</td>
            <td>${i.cost ? `$${i.cost.toFixed(2)}` : '-'}</td>
            <td class="text-xs text-slate-500">${formatDate(i.createdAt)}</td>
            <td class="text-xs text-slate-500">${formatDate(i.resolvedAt)}</td>
          </tr>`;
        }).join('');
      }
    }

    const historySnap = await getDocs(query(collection(db, 'serviceHistory'), where('assetId', '==', assetId)));
    const timeline = document.getElementById('serviceTimeline');
    if (timeline) {
      if (historySnap.empty) {
        timeline.innerHTML = '<p class="text-slate-500 text-center">No service history yet</p>';
      } else {
        const actionColors = { reported: '#dc2626', triaged: '#f59e0b', assigned: '#2563eb', status_change: '#0891b2', resolved: '#16a34a', closed: '#64748b' };
        const sortedHistory = historySnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
        timeline.innerHTML = sortedHistory.map(log => {
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
      }
    }

    loadRecommendations(assetId, asset, issuesDocs);

  } catch (err) {
    console.error('[asset-detail] Error:', err);
    showToast('Error loading asset details', 'error');
  }
});

function loadRecommendations(assetId, asset, issues) {
  const container = document.getElementById('recommendations');
  if (!container) return;

  const alerts = [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const recentIssues = issues.filter(i => {
    const created = i.createdAt?.toDate?.() || new Date();
    return created >= ninetyDaysAgo;
  });

  if (recentIssues.length >= 3) {
    alerts.push({ type: 'warning', message: `This asset has had ${recentIssues.length} issues in the last 90 days. A thorough inspection is recommended.` });
  }

  const resolvedIssues = issues.filter(i => i.status === 'resolved' || i.status === 'closed');
  if (resolvedIssues.length > 0) {
    const lastResolved = resolvedIssues.sort((a, b) => (b.resolvedAt?.toMillis?.() || 0) - (a.resolvedAt?.toMillis?.() || 0))[0];
    const lastDate = lastResolved.resolvedAt?.toDate?.() || new Date();
    const monthsAgo = (Date.now() - lastDate.getTime()) / (30 * 24 * 60 * 60 * 1000);

    if (monthsAgo > 6) {
      alerts.push({ type: 'info', message: `Last serviced ${Math.floor(monthsAgo)} months ago. Preventive maintenance check recommended.` });
    }
  }

  if (asset.warrantyExpiry) {
    const warrantyDate = new Date(asset.warrantyExpiry);
    const daysUntil = (warrantyDate - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysUntil > 0 && daysUntil < 90) {
      alerts.push({ type: 'warning', message: `Warranty expires in ${Math.floor(daysUntil)} days. Schedule any needed covered repairs soon.` });
    } else if (daysUntil < 0) {
      alerts.push({ type: 'info', message: 'Warranty has expired. Budget for potential repair costs.' });
    }
  }

  const catCounts = {};
  issues.forEach(i => { if (i.category) catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  Object.entries(catCounts).forEach(([cat, count]) => {
    if (count >= 3) {
      alerts.push({ type: 'warning', message: `${count} ${cat}-related issues on record. Consider root cause analysis for this category.` });
    }
  });

  if (alerts.length === 0) {
    container.innerHTML = '<p class="text-slate-500 text-sm">No recommendations at this time. Asset is in good standing.</p>';
    return;
  }

  container.innerHTML = alerts.map(a => `
    <div class="flex items-start gap-3 p-3 rounded-lg mb-2 ${a.type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'}">
      <svg viewBox="0 0 24 24" fill="none" stroke="${a.type === 'warning' ? '#f59e0b' : '#2563eb'}" stroke-width="2" class="w-5 h-5 shrink-0 mt-0.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <p class="text-sm">${esc(a.message)}</p>
    </div>
  `).join('');
}
