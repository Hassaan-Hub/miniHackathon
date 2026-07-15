import { auth } from '/js/firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showToast } from '/js/utils.js';

function safeRedirect(url) {
  const now = Date.now();
  const last = parseInt(sessionStorage.getItem('_redirect_ts') || '0', 10);
  if (now - last < 2000) {
    console.error('[login] Redirect loop blocked — last redirect', Math.round(now - last), 'ms ago. Target:', url);
    return;
  }
  sessionStorage.setItem('_redirect_ts', String(now));
  window.location.replace(url);
}

auth.authStateReady().then(() => {
  const pendingError = sessionStorage.getItem('_auth_error');
  if (pendingError) {
    sessionStorage.removeItem('_auth_error');
    showToast(pendingError, 'error');
  }

  const unsub = onAuthStateChanged(auth, (user) => {
    unsub();
    if (user) {
      console.log('[login] Already signed in as', user.email);
      const banner = document.getElementById('alreadySignedIn');
      const emailEl = document.getElementById('loggedInEmail');
      const form = document.getElementById('loginForm');
      if (banner) banner.classList.remove('hidden');
      if (emailEl) emailEl.textContent = user.email;
      if (form) form.classList.add('hidden');
    }
  });
});

const form = document.getElementById('loginForm');
const btn = document.getElementById('loginBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    await signInWithEmailAndPassword(auth, email, password);
    console.log('[login] Sign-in successful — redirecting to dashboard');
    safeRedirect('/dashboard.html');
  } catch (err) {
    console.error('[login] Sign-in error:', err.code, err.message);
    const messages = {
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/user-disabled': 'This account has been disabled.'
    };
    showToast(messages[err.code] || 'Login failed. Check your credentials.', 'error');
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
});
