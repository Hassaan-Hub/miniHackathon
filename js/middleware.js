import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Check auth state and redirect accordingly
export function requireAuth(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }
    // Get user profile from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      window.location.href = '/login.html';
      return;
    }
    const userData = userDoc.data();
    callback(user, userData);
  });
}

// Require specific roles
export function requireRole(roles, callback) {
  requireAuth((user, userData) => {
    if (!roles.includes(userData.role)) {
      window.location.href = '/dashboard.html';
      return;
    }
    callback(user, userData);
  });
}

// Setup sidebar navigation highlighting
export function setupNav(currentPage) {
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    if (a.dataset.page === currentPage) {
      a.classList.add('active');
    }
  });
}

// Populate user info in sidebar
export function populateUser(userData) {
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nameEl) nameEl.textContent = userData.name || userData.email;
  if (roleEl) roleEl.textContent = userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : '';
  if (avatarEl) avatarEl.textContent = (userData.name || userData.email || '?')[0].toUpperCase();
}

// Mobile menu toggle
export function setupMobileMenu() {
  const btn = document.querySelector('.mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if (btn && sidebar) {
    btn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
}

// Logout
export async function logout() {
  await auth.signOut();
  window.location.href = '/login.html';
}

// Make logout accessible globally for inline handlers
if (typeof window !== 'undefined') {
  window.appLogout = logout;
}

// Sidebar HTML template
export function getSidebar(activePage, role) {
  const navItems = [];

  if (role === 'admin' || role === 'manager') {
    navItems.push(
      { page: 'dashboard', label: 'Dashboard', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>', href: '/dashboard.html' },
      { page: 'assets', label: 'Assets', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>', href: '/assets.html' },
      { page: 'issues', label: 'Issues', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', href: '/issues.html' },
      { page: 'analytics', label: 'Analytics', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>', href: '/analytics.html' },
      { page: 'users', label: 'Users', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>', href: '/users.html' }
    );
  }

  if (role === 'technician') {
    navItems.push({ page: 'technician', label: 'My Tasks', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>', href: '/technician.html' });
  }

  const navHTML = navItems.map(item => `
    <a href="${item.href}" data-page="${item.page}">
      ${item.icon}
      ${item.label}
    </a>
  `).join('');

  return `
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      <h2>MaintainIQ</h2>
    </div>
    <nav>${navHTML}</nav>
    <div style="padding:0 1.5rem;margin-top:auto;border-top:1px solid rgba(255,255,255,0.1);padding-top:1rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
        <div id="sidebar-user-avatar" style="width:36px;height:36px;border-radius:50%;background:#2563eb;display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:0.875rem;">?</div>
        <div>
          <div id="sidebar-user-name" style="font-size:0.875rem;font-weight:500;">Loading...</div>
          <div id="sidebar-user-role" style="font-size:0.75rem;color:#94a3b8;"></div>
        </div>
      </div>
      <button onclick="window.appLogout()" class="btn btn-secondary btn-sm" style="width:100%;color:#94a3b8;border-color:rgba(255,255,255,0.1);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        Sign Out
      </button>
    </div>
  `;
}
