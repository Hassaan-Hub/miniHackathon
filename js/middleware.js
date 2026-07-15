import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener('pageshow', (e) => {
  if (e.persisted) sessionStorage.removeItem('_redirect_ts');
});

function safeRedirect(url) {
  const now = Date.now();
  const last = parseInt(sessionStorage.getItem('_redirect_ts') || '0', 10);
  if (now - last < 2000) {
    console.error('[auth] Redirect loop blocked — last redirect', Math.round(now - last), 'ms ago. Target:', url);
    return;
  }
  sessionStorage.setItem('_redirect_ts', String(now));
  window.location.replace(url);
}

export function requireAuth(callback) {
  auth.authStateReady().then(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        console.warn('[auth] No user signed in — redirecting to login');
        safeRedirect('/login.html');
        return;
      }

      console.log('[auth] User signed in:', user.uid, user.email);

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
          console.error('[auth] No profile at users/' + user.uid + ' — signing out');
          await auth.signOut();
          sessionStorage.setItem('_auth_error', 'Account profile not found. Please sign up again.');
          safeRedirect('/login.html');
          return;
        }

        const userData = userDoc.data();

        const roleDoc = await getDoc(doc(db, 'userRoles', user.uid));
        if (roleDoc.exists()) {
          userData.role = roleDoc.data().role;
        }

        if (!userData.role || !userData.orgId) {
          console.error('[auth] User profile incomplete — missing role or orgId', userData);
          await auth.signOut();
          sessionStorage.setItem('_auth_error', 'Account profile is incomplete. Please contact support.');
          safeRedirect('/login.html');
          return;
        }

        console.log('[auth] Profile loaded — role:', userData.role, 'orgId:', userData.orgId);
        callback(user, userData);
      } catch (err) {
        console.error('[auth] Firestore error for uid ' + user.uid + ':', err.code, err.message);

        if (err.code === 'permission-denied') {
          sessionStorage.setItem('_auth_error', 'Permission denied. Firestore rules may not be deployed. Run: firebase deploy --only firestore:rules');
        } else {
          sessionStorage.setItem('_auth_error', 'Failed to load user profile. Please try again.');
        }
        safeRedirect('/login.html');
      }
    });
  });
}

export function requireRole(roles, callback) {
  requireAuth((user, userData) => {
    const rawRole = userData.role;
    const normalized = String(rawRole || '').toLowerCase().trim();
    const allowed = roles.map(r => r.toLowerCase());

    if (!allowed.includes(normalized)) {
      console.warn('[auth] Role mismatch — user:', rawRole, '| required:', roles);
      if (normalized === 'technician') {
        safeRedirect('/technician.html');
      } else {
        safeRedirect('/dashboard.html');
      }
      return;
    }

    callback(user, userData);
  });
}

export function setupNav(currentPage) {
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    if (a.dataset.page === currentPage) {
      a.classList.add('active');
    }
  });
}

export function populateUser(userData) {
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nameEl) nameEl.textContent = userData.name || userData.email;
  if (roleEl) roleEl.textContent = userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : '';
  if (avatarEl) avatarEl.textContent = (userData.name || userData.email || '?')[0].toUpperCase();
}

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

  const logoutBtn = document.getElementById('sidebarLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logout());
  }
}

export async function logout() {
  await auth.signOut();
  sessionStorage.removeItem('_redirect_ts');
  safeRedirect('/login.html');
}

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
    <div class="px-6 mt-auto border-t border-white/10 pt-4">
      <div class="flex items-center gap-3 mb-4">
        <div id="sidebar-user-avatar" class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">?</div>
        <div>
          <div id="sidebar-user-name" class="text-sm font-medium">Loading...</div>
          <div id="sidebar-user-role" class="text-xs text-slate-400"></div>
        </div>
      </div>
      <button id="sidebarLogoutBtn" class="btn btn-secondary btn-sm w-full text-slate-400 border-white/10">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        Sign Out
      </button>
    </div>
  `;
}
