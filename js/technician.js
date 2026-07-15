import { db } from '/js/firebase-config.js';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireRole } from '/js/middleware.js';
import { setupNav, populateUser, setupMobileMenu, getSidebar } from '/js/middleware.js';
import { showToast, statusBadge, esc, formatDateTime, uploadFile, openModal, closeModal, setupModals, writeServiceHistory } from '/js/utils.js';

let currentUserId = null;
let currentOrgId = null;
let issuesData = {};
let assetsMap = {};
let currentTab = 'active';

requireRole(['technician'], async (user, userData) => {
  currentUserId = user.uid;
  currentOrgId = userData.orgId;

  document.getElementById('sidebar').innerHTML = getSidebar('technician', userData.role);
  setupNav('technician');
  populateUser(userData);
  setupMobileMenu();
  setupModals();

  try {
    if (currentOrgId) {
      const assetsSnap = await getDocs(query(collection(db, 'assets'), where('orgId', '==', currentOrgId)));
      assetsSnap.forEach(d => { assetsMap[d.id] = d.data(); });
    }
  } catch (err) {
    console.error('[technician] Failed to load assets:', err);
  }

  const q = query(collection(db, 'issues'), where('assignedTo', '==', currentUserId));
  onSnapshot(q, (snap) => {
    issuesData = {};
    snap.forEach(d => { issuesData[d.id] = { id: d.id, ...d.data() }; });
    renderTasks();
  }, (err) => {
    console.error('[technician] Snapshot error:', err);
    showToast('Error loading tasks: ' + err.message, 'error');
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        if (b.dataset.tab === currentTab) {
          b.classList.remove('bg-slate-100', 'text-slate-600');
          b.classList.add('bg-blue-600', 'text-white');
        } else {
          b.classList.remove('bg-blue-600', 'text-white');
          b.classList.add('bg-slate-100', 'text-slate-600');
        }
      });
      renderTasks();
    });
  });

  const cancelBtn = document.getElementById('cancelIssueBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal('issueModal'));
});

function renderTasks() {
  const container = document.getElementById('tasks-list');
  if (!container) return;
  const activeStatuses = ['assigned', 'in_progress'];
  const resolvedStatuses = ['resolved', 'closed'];

  let filtered = Object.values(issuesData).filter(i => {
    if (currentTab === 'active') return activeStatuses.includes(i.status);
    return resolvedStatuses.includes(i.status);
  });

  filtered.sort((a, b) => {
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return (urgencyOrder[a.urgency] || 3) - (urgencyOrder[b.urgency] || 3);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <h3>${currentTab === 'active' ? 'No active tasks' : 'No completed tasks yet'}</h3>
          <p>${currentTab === 'active' ? 'New assignments will appear here' : 'Completed issues will show up here'}</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(i => {
    const asset = assetsMap[i.assetId] || {};
    return `
      <div class="card mb-4 cursor-pointer task-card" data-issue-id="${i.id}">
        <div class="card-body">
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                ${statusBadge(i.urgency || 'low')}
                ${statusBadge(i.status)}
              </div>
              <h4 class="font-semibold mb-1">${esc(asset.name || 'Unknown Asset')}</h4>
              <p class="text-slate-500 text-sm mb-2">${esc(i.description || 'No description')}</p>
              <div class="flex gap-4 text-xs text-slate-400">
                <span>Category: ${esc(i.category || asset.category || 'N/A')}</span>
                <span>Reported: ${formatDateTime(i.createdAt)}</span>
                ${i.photos?.length ? `<span>${i.photos.length} evidence photo(s)</span>` : ''}
              </div>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" class="w-5 h-5 shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => openIssueDetail(card.dataset.issueId));
  });
}

function openIssueDetail(issueId) {
  const issue = issuesData[issueId];
  if (!issue) return;

  const asset = assetsMap[issue.assetId] || {};
  const detail = document.getElementById('issueDetail');
  if (!detail) return;

  const photosHTML = issue.photos?.length ? `
    <div class="mt-4">
      <strong class="text-xs">Evidence Photos:</strong>
      <div class="preview-grid mt-2">
        ${issue.photos.map(p => `<img src="${p}" class="cursor-pointer issue-photo" data-src="${p}">`).join('')}
      </div>
    </div>
  ` : '';

  detail.innerHTML = `
    <div class="flex gap-2 mb-4">${statusBadge(issue.urgency || 'low')} ${statusBadge(issue.status)}</div>

    <h4 class="font-semibold text-lg mb-1">${esc(asset.name || 'Unknown')}</h4>
    <p class="text-slate-500 text-sm mb-4">${esc(asset.location || '')}</p>

    <div class="bg-slate-50 rounded-lg p-4 mb-4">
      <p class="text-[0.9375rem]">${esc(issue.description || 'No description')}</p>
      <p class="text-xs text-slate-400 mt-2">Reported by ${esc(issue.reportedBy || 'Anonymous')} on ${formatDateTime(issue.createdAt)}</p>
    </div>

    ${photosHTML}

    ${issue.triageNotes ? `
      <div class="bg-blue-50 rounded-lg p-4 mt-4">
        <strong class="text-xs">Triage Notes:</strong>
        <p class="text-sm mt-1">${esc(issue.triageNotes)}</p>
      </div>
    ` : ''}

    <div class="mt-6 pt-6 border-t border-slate-200">
      <h4 class="font-semibold mb-4">Update Status</h4>

      ${issue.status === 'assigned' ? `
        <button class="btn btn-primary btn-sm w-full mb-3 update-status-btn" data-status="in_progress" data-issue="${issueId}">
          Start Working
        </button>
      ` : ''}

      ${issue.status === 'in_progress' ? `
        <div class="input-group">
          <label>Resolution Notes *</label>
          <textarea id="resolutionNotes" rows="3" placeholder="Describe what you did to fix the issue..."></textarea>
        </div>
        <div class="input-group">
          <label>Upload Evidence Photos *</label>
          <input type="file" id="evidenceFiles" accept="image/*" multiple>
          <div class="preview-grid" id="evidencePreview"></div>
        </div>
        <div class="input-group">
          <label>Cost (optional)</label>
          <input type="number" id="resolutionCost" placeholder="0.00" step="0.01">
        </div>
        <button class="btn btn-success btn-sm w-full resolve-btn" data-issue="${issueId}">
          Mark as Resolved
        </button>
      ` : ''}

      ${issue.status === 'resolved' ? `
        <div class="bg-green-50 rounded-lg p-4">
          <p class="text-sm text-green-800">Awaiting admin verification and closure.</p>
        </div>
      ` : ''}
    </div>
  `;

  detail.querySelectorAll('.issue-photo').forEach(img => {
    img.addEventListener('click', () => window.open(img.dataset.src, '_blank'));
  });

  const updateBtn = detail.querySelector('.update-status-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', () => updateStatus(updateBtn.dataset.issue, updateBtn.dataset.status));
  }

  const resolveBtn = detail.querySelector('.resolve-btn');
  if (resolveBtn) {
    resolveBtn.addEventListener('click', (e) => resolveIssue(resolveBtn.dataset.issue, e));
  }

  const evidenceInput = document.getElementById('evidenceFiles');
  if (evidenceInput) {
    evidenceInput.addEventListener('change', (e) => {
      const preview = document.getElementById('evidencePreview');
      if (!preview) return;
      preview.innerHTML = '';
      Array.from(e.target.files).forEach(file => {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        preview.appendChild(img);
      });
    });
  }

  openModal('issueModal');
}

async function updateStatus(issueId, newStatus) {
  try {
    await updateDoc(doc(db, 'issues', issueId), {
      status: newStatus,
      updatedAt: serverTimestamp()
    });

    const issue = issuesData[issueId];
    await writeServiceHistory(issue.assetId, currentOrgId, 'status_change', currentUserId, `Status changed to ${newStatus}`, issueId);

    showToast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');
    closeModal('issueModal');
  } catch (err) {
    console.error('[technician] Status update error:', err);
    showToast('Error: ' + err.message, 'error');
  }
}

async function resolveIssue(issueId, evt) {
  const notes = document.getElementById('resolutionNotes')?.value?.trim();
  const files = document.getElementById('evidenceFiles')?.files;
  const cost = document.getElementById('resolutionCost')?.value;

  if (!notes) {
    showToast('Please add resolution notes', 'error');
    return;
  }

  if (!files || files.length === 0) {
    showToast('Please upload at least one evidence photo', 'error');
    return;
  }

  const btn = evt.target;
  btn.disabled = true;
  btn.textContent = 'Uploading evidence...';

  try {
    const photoUrls = [];
    for (let i = 0; i < files.length; i++) {
      const url = await uploadFile(files[i], `evidence/${issueId}/${Date.now()}-${i}`);
      photoUrls.push(url);
    }

    const issue = issuesData[issueId];
    await updateDoc(doc(db, 'issues', issueId), {
      status: 'resolved',
      resolutionNotes: notes,
      resolutionPhotos: photoUrls,
      cost: cost ? parseFloat(cost) : null,
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await updateDoc(doc(db, 'assets', issue.assetId), {
      status: 'operational',
      updatedAt: serverTimestamp()
    });

    await writeServiceHistory(issue.assetId, currentOrgId, 'resolved', currentUserId, `Issue resolved: ${notes}`, issueId);

    showToast('Issue resolved successfully!', 'success');
    closeModal('issueModal');
  } catch (err) {
    console.error('[technician] Resolve error:', err);
    showToast('Error: ' + err.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Mark as Resolved';
}
