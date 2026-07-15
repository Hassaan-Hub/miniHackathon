import { auth, db } from '/js/firebase-config.js';
import { createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showToast } from '/js/utils.js';

function safeRedirect(url) {
  const now = Date.now();
  const last = parseInt(sessionStorage.getItem('_redirect_ts') || '0', 10);
  if (now - last < 2000) {
    console.error('[signup] Redirect loop blocked — last redirect', Math.round(now - last), 'ms ago. Target:', url);
    return;
  }
  sessionStorage.setItem('_redirect_ts', String(now));
  window.location.replace(url);
}

const form = document.getElementById('signupForm');
const btn = document.getElementById('signupBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = 'Creating account...';

  try {
    const orgName = document.getElementById('orgName').value.trim();
    const name = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone').value.trim();

    const cred = await createUserWithEmailAndPassword(auth, email, password);

    const orgRef = await addDoc(collection(db, 'organizations'), {
      name: orgName,
      plan: 'free',
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, 'users', cred.user.uid), {
      orgId: orgRef.id,
      name,
      email,
      phone,
      role: 'admin',
      emailVerified: false,
      createdAt: serverTimestamp()
    });

    await sendEmailVerification(cred.user);

    showToast('Account created! Verification email sent.', 'success');
    setTimeout(() => { safeRedirect('/dashboard.html'); }, 1500);
  } catch (err) {
    console.error(err);
    let msg = 'Signup failed. Please try again.';
    if (err.code === 'auth/email-already-in-use') msg = 'Email already in use.';
    if (err.code === 'auth/weak-password') msg = 'Password is too weak.';
    showToast(msg, 'error');
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});

