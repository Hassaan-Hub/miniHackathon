import { db } from '/js/firebase-config.js';
import { collection, query, where, onSnapshot, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireRole } from '/js/middleware.js';
import { setupNav, populateUser, setupMobileMenu, getSidebar } from '/js/middleware.js';
import { statusBadge, formatDate, esc, showToast } from '/js/utils.js';

requireRole(['admin', 'manager'], async (user, userData) => {
  document.getElementById('sidebar').innerHTML = getSidebar('dashboard', userData.role);
  setupNav('dashboard');
  populateUser(userData);
  setupMobileMenu();

  const orgId = userData.orgId;

  if (!orgId) {
    showToast('No organization linked to your account.', 'error');
    return;
  }

  const assetsQuery = query(collection(db, 'assets'), where('orgId', '==', orgId));
  onSnapshot(assetsQuery, (snap) => {
    const el = document.getElementById('stat-assets');
    if (el) el.textContent = snap.size;
  }, (err) => {
    console.error('[dashboard] Assets snapshot error:', err);
  });

  const openStatuses = ['reported', 'triaged', 'assigned', 'in_progress'];
  const issuesQuery = query(collection(db, 'issues'), where('orgId', '==', orgId));
  onSnapshot(issuesQuery, (snap) => {
    let open = 0, critical = 0, resolved = 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (openStatuses.includes(d.status)) {
        open++;
        if (d.urgency === 'critical' || d.urgency === 'high') critical++;
      }
      if (d.status === 'resolved' || d.status === 'closed') {
        const resolvedDate = d.resolvedAt?.toDate?.() || d.updatedAt?.toDate?.();
        if (resolvedDate && resolvedDate >= monthStart) resolved++;
      }
    });

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('stat-open', open);
    setTxt('stat-resolved', resolved);
    setTxt('stat-critical', critical);
  }, (err) => {
    console.error('[dashboard] Issues snapshot error:', err);
  });

  const recentQuery = query(collection(db, 'issues'), where('orgId', '==', orgId));
  onSnapshot(recentQuery, (snap) => {
    const sorted = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
      .slice(0, 5);

    const tbody = document.getElementById('recent-issues');
    if (!tbody) return;

    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state"><p>No issues yet</p></td></tr>';
      return;
    }

    const assetIds = [...new Set(sorted.map(d => d.assetId).filter(Boolean))];
    Promise.all(assetIds.map(id => getDoc(doc(db, 'assets', id)))).then(assetSnaps => {
      const assetMap = {};
      assetSnaps.forEach(s => { if (s.exists()) assetMap[s.id] = s.data().name; });

      tbody.innerHTML = sorted.map(data => {
        return `<tr>
          <td class="font-medium">${esc(data.description?.substring(0, 50) || 'Issue')}</td>
          <td>${esc(assetMap[data.assetId] || data.assetId)}</td>
          <td>${statusBadge(data.status)}</td>
          <td>${statusBadge(data.urgency || 'low')}</td>
          <td class="text-slate-500 text-xs">${formatDate(data.createdAt)}</td>
        </tr>`;
      }).join('');
    }).catch(err => {
      console.error('[dashboard] Failed to load asset names:', err);
    });
  }, (err) => {
    console.error('[dashboard] Recent issues snapshot error:', err);
  });

  loadPreventiveAlerts(orgId);
  loadTechWorkload(orgId);
});

async function loadPreventiveAlerts(orgId) {
  const container = document.getElementById('alerts-list');
  if (!container) return;

  try {
    const assetsSnap = await getDocs(query(collection(db, 'assets'), where('orgId', '==', orgId)));
    const issuesSnap = await getDocs(query(collection(db, 'issues'), where('orgId', '==', orgId)));

    const issuesByAsset = {};
    issuesSnap.forEach(d => {
      const data = d.data();
      if (!issuesByAsset[data.assetId]) issuesByAsset[data.assetId] = [];
      issuesByAsset[data.assetId].push(data);
    });

    const alerts = [];
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    assetsSnap.forEach(d => {
      const asset = d.data();
      const assetIssues = issuesByAsset[d.id] || [];

      const recentIssues = assetIssues.filter(i => {
        const created = i.createdAt?.toDate?.() || new Date();
        return created >= ninetyDaysAgo;
      });

      if (recentIssues.length >= 3) {
        alerts.push({
          assetId: d.id,
          assetName: asset.name,
          message: `${recentIssues.length} issues in the last 90 days — recommend inspection`,
          type: 'warning'
        });
      }

      const lastServiced = assetIssues
        .filter(i => i.status === 'resolved' || i.status === 'closed')
        .sort((a, b) => (b.resolvedAt?.toMillis?.() || 0) - (a.resolvedAt?.toMillis?.() || 0))[0];

      if (lastServiced) {
        const lastDate = lastServiced.resolvedAt?.toDate?.() || new Date();
        const monthsAgo = (Date.now() - lastDate.getTime()) / (30 * 24 * 60 * 60 * 1000);
        if (monthsAgo > 6) {
          alerts.push({
            assetId: d.id,
            assetName: asset.name,
            message: `Last serviced ${Math.floor(monthsAgo)} months ago — preventive check recommended`,
            type: 'info'
          });
        }
      }

      if (asset.warrantyExpiry) {
        const warrantyDate = asset.warrantyExpiry?.toDate?.() || new Date(asset.warrantyExpiry);
        const daysUntilExpiry = (warrantyDate - Date.now()) / (24 * 60 * 60 * 1000);
        if (daysUntilExpiry > 0 && daysUntilExpiry < 90) {
          alerts.push({
            assetId: d.id,
            assetName: asset.name,
            message: `Warranty expires in ${Math.floor(daysUntilExpiry)} days`,
            type: 'warning'
          });
        }
      }
    });

    if (alerts.length === 0) {
      container.innerHTML = '<p class="text-slate-500 text-sm">No alerts at this time. All assets are in good shape.</p>';
      return;
    }

    container.innerHTML = alerts.map(a => `
      <div class="flex items-center gap-3 p-3 rounded-lg mb-2 ${a.type === 'warning' ? 'bg-amber-50' : 'bg-blue-50'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="${a.type === 'warning' ? '#f59e0b' : '#2563eb'}" stroke-width="2" class="w-5 h-5 shrink-0">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <div>
          <a href="/asset-detail.html?id=${a.assetId}" class="font-semibold text-sm no-underline text-slate-900">${esc(a.assetName)}</a>
          <p class="text-xs text-slate-600">${esc(a.message)}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('[dashboard] Preventive alerts error:', err);
    container.innerHTML = '<p class="text-slate-500 text-sm">Error loading alerts.</p>';
  }
}

async function loadTechWorkload(orgId) {
  try {
    const techSnap = await getDocs(query(collection(db, 'users'), where('orgId', '==', orgId), where('role', '==', 'technician')));
    if (techSnap.empty) return;

    const techCard = document.getElementById('tech-card');
    if (techCard) techCard.style.display = 'block';

    const tbody = document.getElementById('tech-workload');
    if (!tbody) return;

    const allIssues = await getDocs(query(collection(db, 'issues'), where('orgId', '==', orgId)));
    const issuesList = allIssues.docs.map(d => d.data());

    const techRows = techSnap.docs.map(d => {
      const tech = d.data();
      const myIssues = issuesList.filter(i => i.assignedTo === d.id);
      const assigned = myIssues.filter(i => i.status === 'assigned').length;
      const inProgress = myIssues.filter(i => i.status === 'in_progress').length;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const resolved = myIssues.filter(i => {
        if (i.status !== 'resolved' && i.status !== 'closed') return false;
        const rd = i.resolvedAt?.toDate?.() || new Date();
        return rd >= thirtyDaysAgo;
      }).length;

      return `<tr>
        <td class="font-medium">${esc(tech.name || tech.email)}</td>
        <td><span class="badge badge-info">${assigned}</span></td>
        <td><span class="badge badge-primary">${inProgress}</span></td>
        <td><span class="badge badge-success">${resolved}</span></td>
      </tr>`;
    }).join('');

    tbody.innerHTML = techRows;
  } catch (err) {
    console.error('[dashboard] Tech workload error:', err);
  }
}
