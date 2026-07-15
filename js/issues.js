import { db } from '/js/firebase-config.js';
import { collection, query, where, onSnapshot, updateDoc, addDoc, doc, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireRole } from '/js/middleware.js';
import { setupNav, populateUser, setupMobileMenu, getSidebar } from '/js/middleware.js';
import { showToast, statusBadge, esc, formatDateTime, openModal, closeModal, setupModals } from '/js/utils.js';

let currentOrgId = null;
let issuesData = {};
let assetsMap = {};
let technicians = {};
let currentTriageId = null;

function safeOn(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
}

requireRole(['admin', 'manager'], async (user, userData) => {
  document.getElementById('sidebar').innerHTML = getSidebar('issues', userData.role);
  setupNav('issues');
  populateUser(userData);
  setupMobileMenu();
  setupModals();

  currentOrgId = userData.orgId;

  if (!currentOrgId) {
    document.getElementById('issues-list').innerHTML =
      '<tr><td colspan="9"><div class="empty-state"><h3>Configuration Error</h3><p>No organization linked to your account.</p></div></td></tr>';
    return;
  }

  try {
    const techSnap = await getDocs(query(collection(db, 'users'), where('orgId', '==', currentOrgId), where('role', '==', 'technician')));
    const assignSelect = document.getElementById('triageAssignTo');
    techSnap.forEach(d => {
      const t = d.data();
      technicians[d.id] = t;
      if (assignSelect) {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = t.name || t.email;
        assignSelect.appendChild(opt);
      }
    });

    const assetsSnap = await getDocs(query(collection(db, 'assets'), where('orgId', '==', currentOrgId)));
    assetsSnap.forEach(d => { assetsMap[d.id] = d.data(); });

    const categories = [...new Set(Object.values(assetsMap).map(a => a.category).filter(Boolean))];
    const catFilter = document.getElementById('categoryFilter');
    categories.forEach(c => {
      if (catFilter) {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        catFilter.appendChild(opt);
      }
    });
  } catch (err) {
    console.error('[issues] Failed to load technicians/assets:', err);
    showToast('Error loading data: ' + err.message, 'error');
  }

  const q = query(collection(db, 'issues'), where('orgId', '==', currentOrgId));
  onSnapshot(q, (snap) => {
    issuesData = {};
    snap.forEach(d => { issuesData[d.id] = { id: d.id, ...d.data() }; });
    renderIssues();
  }, (err) => {
    console.error('[issues] Snapshot error:', err);
    showToast('Error loading issues: ' + err.message, 'error');
  });

  safeOn('statusFilter', 'change', renderIssues);
  safeOn('urgencyFilter', 'change', renderIssues);
  safeOn('categoryFilter', 'change', renderIssues);
  safeOn('searchInput', 'input', renderIssues);
  safeOn('saveTriageBtn', 'click', saveTriage);
  safeOn('rejectBtn', 'click', rejectIssue);
  safeOn('cancelTriageBtn', 'click', () => closeModal('triageModal'));
});

function openTriage(issueId) {
  const issue = issuesData[issueId];
  if (!issue) return;
  currentTriageId = issueId;

  const asset = assetsMap[issue.assetId] || {};
  const infoEl = document.getElementById('triageIssueInfo');
  if (infoEl) {
    infoEl.innerHTML = `
      <div class="text-sm">
        <strong>Asset:</strong> ${esc(asset.name || 'Unknown')}<br>
        <strong>Description:</strong> ${esc(issue.description || 'No description')}<br>
        <strong>Reported by:</strong> ${esc(issue.reportedBy || 'Anonymous')}<br>
        ${issue.photos?.length ? `<strong>Evidence:</strong> ${issue.photos.length} photo(s) uploaded` : ''}
      </div>
    `;
  }

  const setVal = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val || ''; };
  setVal('triageCategory', issue.category || asset.category || '');
  setVal('triageUrgency', issue.urgency || 'medium');
  setVal('triageAssignTo', issue.assignedTo || '');
  setVal('triageNotes', issue.triageNotes || '');

  openModal('triageModal');
}

function renderIssues() {
  const tbody = document.getElementById('issues-list');
  if (!tbody) return;
  const status = document.getElementById('statusFilter')?.value || '';
  const urgency = document.getElementById('urgencyFilter')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const search = document.getElementById('searchInput')?.value?.toLowerCase() || '';

  let filtered = Object.values(issuesData).filter(i => {
    if (status && i.status !== status) return false;
    if (urgency && i.urgency !== urgency) return false;
    if (category && i.category !== category) return false;
    if (search && !i.description?.toLowerCase().includes(search)) return false;
    return true;
  });

  filtered.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state"><h3>No issues found</h3><p>Issues reported via QR scans will appear here</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(i => {
    const asset = assetsMap[i.assetId] || {};
    const tech = technicians[i.assignedTo] || {};
    const shortId = i.id.substring(0, 6).toUpperCase();

    return `<tr>
      <td><code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs">${shortId}</code></td>
      <td class="font-medium">${esc(asset.name || 'Unknown')}</td>
      <td class="max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">${esc(i.description || '')}</td>
      <td><span class="badge badge-secondary">${esc(i.category || asset.category || 'N/A')}</span></td>
      <td>${statusBadge(i.urgency || 'low')}</td>
      <td>${statusBadge(i.status)}</td>
      <td>${tech.name ? esc(tech.name) : '<span class="text-slate-400">Unassigned</span>'}</td>
      <td class="text-slate-500 text-xs">${formatDateTime(i.createdAt)}</td>
      <td>
        <button class="btn btn-secondary btn-xs triage-btn" data-id="${i.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Triage
        </button>
      </td>
    </tr>`;
  }).join('');

  document.querySelectorAll('.triage-btn').forEach(btn => {
    btn.addEventListener('click', () => openTriage(btn.dataset.id));
  });
}

async function saveTriage() {
  if (!currentTriageId) return;
  const btn = document.getElementById('saveTriageBtn');
  if (btn) { btn.disabled = true; }

  try {
    const assignTo = document.getElementById('triageAssignTo')?.value || '';
    const updateData = {
      category: document.getElementById('triageCategory')?.value || '',
      urgency: document.getElementById('triageUrgency')?.value || 'medium',
      triageNotes: document.getElementById('triageNotes')?.value?.trim() || '',
      triagedBy: currentOrgId,
      updatedAt: serverTimestamp(),
      status: assignTo ? 'assigned' : 'triaged'
    };

    if (assignTo) updateData.assignedTo = assignTo;

    await updateDoc(doc(db, 'issues', currentTriageId), updateData);

    const issue = issuesData[currentTriageId];
    await addDoc(collection(db, 'serviceHistory'), {
      assetId: issue.assetId,
      orgId: currentOrgId,
      issueId: currentTriageId,
      action: 'triaged',
      performedBy: currentOrgId,
      notes: `Category: ${updateData.category}, Urgency: ${updateData.urgency}${assignTo ? ', Assigned to technician' : ''}`,
      timestamp: serverTimestamp()
    });

    if (assignTo) {
      await updateDoc(doc(db, 'assets', issue.assetId), {
        status: 'under_maintenance',
        updatedAt: serverTimestamp()
      });
    }

    showToast('Issue triaged successfully', 'success');
    closeModal('triageModal');
  } catch (err) {
    console.error('[issues] Triage error:', err);
    showToast('Error: ' + err.message, 'error');
  }

  if (btn) { btn.disabled = false; }
}

async function rejectIssue() {
  if (!currentTriageId) return;
  if (!confirm('Reject this issue?')) return;

  try {
    await updateDoc(doc(db, 'issues', currentTriageId), {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
    showToast('Issue rejected', 'info');
    closeModal('triageModal');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}
