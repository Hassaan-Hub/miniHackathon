import { db } from '/js/firebase-config.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { requireRole } from '/js/middleware.js';
import { setupNav, populateUser, setupMobileMenu, getSidebar } from '/js/middleware.js';
import { esc, showToast } from '/js/utils.js';

requireRole(['admin', 'manager'], async (user, userData) => {
  document.getElementById('sidebar').innerHTML = getSidebar('analytics', userData.role);
  setupNav('analytics');
  populateUser(userData);
  setupMobileMenu();

  const orgId = userData.orgId;

  if (!orgId) {
    showToast('No organization linked to your account.', 'error');
    return;
  }

  try {
    const [issuesSnap, assetsSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db, 'issues'), where('orgId', '==', orgId))),
      getDocs(query(collection(db, 'assets'), where('orgId', '==', orgId))),
      getDocs(query(collection(db, 'users'), where('orgId', '==', orgId)))
    ]);

    const issues = issuesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const assets = {};
    assetsSnap.docs.forEach(d => { assets[d.id] = d.data(); });
    const techUsers = {};
    usersSnap.docs.forEach(d => {
      const u = d.data();
      if (u.role === 'technician') techUsers[d.id] = u;
    });

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setTxt('totalIssues', issues.length);

    const resolvedIssues = issues.filter(i => i.resolvedAt && (i.status === 'resolved' || i.status === 'closed'));
    if (resolvedIssues.length > 0) {
      let totalDays = 0;
      resolvedIssues.forEach(i => {
        const created = i.createdAt?.toMillis?.() || 0;
        const resolved = i.resolvedAt?.toMillis?.() || 0;
        if (created && resolved) totalDays += (resolved - created) / (1000 * 60 * 60 * 24);
      });
      setTxt('avgResolution', (totalDays / resolvedIssues.length).toFixed(1) + 'd');
    }

    const completedCount = issues.filter(i => i.status === 'resolved' || i.status === 'closed').length;
    setTxt('completionRate', issues.length > 0 ? Math.round(completedCount / issues.length * 100) + '%' : '0%');

    const totalCost = issues.reduce((sum, i) => sum + (i.cost || 0), 0);
    setTxt('totalCost', totalCost > 0 ? `$${totalCost.toFixed(2)}` : '$0');

    const monthlyData = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      monthlyData[key] = { label: monthNames[d.getMonth()], count: 0 };
    }

    issues.forEach(i => {
      const created = i.createdAt?.toDate?.();
      if (!created) return;
      const key = `${created.getFullYear()}-${created.getMonth()}`;
      if (monthlyData[key]) monthlyData[key].count++;
    });

    const maxCount = Math.max(...Object.values(monthlyData).map(m => m.count), 1);
    const chartEl = document.getElementById('monthlyChart');
    if (chartEl) {
      chartEl.innerHTML = Object.values(monthlyData).map(m => {
        const height = Math.max((m.count / maxCount) * 100, 4);
        return `
          <div class="bar" style="height:${height}%;background:#2563eb;">
            <span class="bar-value">${m.count}</span>
            <span class="bar-label">${m.label}</span>
          </div>
        `;
      }).join('');
    }

    const statusCounts = {};
    issues.forEach(i => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });
    const statusColors = { reported: '#dc2626', triaged: '#f59e0b', assigned: '#2563eb', in_progress: '#0891b2', resolved: '#16a34a', closed: '#64748b', rejected: '#94a3b8' };

    const statusEl = document.getElementById('statusDistribution');
    if (statusEl) {
      if (issues.length === 0) {
        statusEl.innerHTML = '<p class="text-slate-500 text-center">No data yet</p>';
      } else {
        statusEl.innerHTML = Object.entries(statusCounts).map(([status, count]) => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${statusColors[status] || '#64748b'};"></span>
            <span class="flex-1 capitalize">${status.replace(/_/g, ' ')}</span>
            <span class="font-semibold">${count}</span>
            <span class="text-slate-400 text-xs">(${Math.round(count / issues.length * 100)}%)</span>
          </div>
        `).join('');
      }
    }

    const urgencyCounts = {};
    issues.forEach(i => { urgencyCounts[i.urgency || 'low'] = (urgencyCounts[i.urgency || 'low'] || 0) + 1; });
    const urgencyColors = { critical: '#dc2626', high: '#f59e0b', medium: '#2563eb', low: '#16a34a' };

    const urgEl = document.getElementById('urgencyBreakdown');
    if (urgEl) {
      if (issues.length === 0) {
        urgEl.innerHTML = '<p class="text-slate-500 text-center">No data yet</p>';
      } else {
        urgEl.innerHTML = ['critical', 'high', 'medium', 'low'].map(u => {
          const count = urgencyCounts[u] || 0;
          const pct = Math.round(count / issues.length * 100);
          return `
            <div class="mb-3">
              <div class="flex justify-between text-xs mb-1">
                <span class="capitalize font-medium">${u}</span>
                <span class="text-slate-500">${count} (${pct}%)</span>
              </div>
              <div class="h-2 bg-slate-100 rounded overflow-hidden">
                <div class="h-full rounded transition-all duration-500" style="width:${pct}%;background:${urgencyColors[u]};"></div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const assetIssueCounts = {};
    issues.forEach(i => {
      if (!assetIssueCounts[i.assetId]) assetIssueCounts[i.assetId] = 0;
      assetIssueCounts[i.assetId]++;
    });

    const probEl = document.getElementById('problemAssets');
    if (probEl) {
      const sorted = Object.entries(assetIssueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

      if (sorted.length === 0) {
        probEl.innerHTML = '<p class="text-slate-500 text-center">No data yet</p>';
      } else {
        probEl.innerHTML = sorted.map(([assetId, count]) => {
          const a = assets[assetId] || {};
          return `
            <div class="flex items-center gap-3 py-2 border-b border-slate-100">
              <div class="flex-1">
                <div class="font-medium text-sm">${esc(a.name || 'Unknown')}</div>
                <div class="text-xs text-slate-500">${esc(a.location || '')}</div>
              </div>
              <span class="badge badge-danger">${count} issues</span>
            </div>
          `;
        }).join('');
      }
    }

    const techIds = Object.keys(techUsers);
    if (techIds.length > 0) {
      const techPerfCard = document.getElementById('techPerfCard');
      if (techPerfCard) techPerfCard.style.display = 'block';

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const tbody = document.getElementById('techPerformance');
      if (tbody) {
        tbody.innerHTML = techIds.map(tid => {
          const tech = techUsers[tid];
          const myIssues = issues.filter(i => i.assignedTo === tid);
          const assigned = myIssues.filter(i => i.status === 'assigned').length;
          const inProgress = myIssues.filter(i => i.status === 'in_progress').length;
          const resolved = myIssues.filter(i => {
            if (i.status !== 'resolved' && i.status !== 'closed') return false;
            const d = i.resolvedAt?.toDate?.();
            return d && d >= thirtyDaysAgo;
          });

          let avgDays = '-';
          if (resolved.length > 0) {
            let total = 0;
            resolved.forEach(i => {
              const c = i.createdAt?.toMillis?.() || 0;
              const r = i.resolvedAt?.toMillis?.() || 0;
              if (c && r) total += (r - c) / (1000 * 60 * 60 * 24);
            });
            avgDays = (total / resolved.length).toFixed(1) + 'd';
          }

          return `<tr>
            <td class="font-medium">${esc(tech.name || tech.email)}</td>
            <td><span class="badge badge-info">${assigned}</span></td>
            <td><span class="badge badge-primary">${inProgress}</span></td>
            <td><span class="badge badge-success">${resolved.length}</span></td>
            <td>${avgDays}</td>
          </tr>`;
        }).join('');
      }
    }
  } catch (err) {
    console.error('[analytics] Error:', err);
    showToast('Error loading analytics: ' + err.message, 'error');
  }
});
