/* ═══ login.js ═══════════════════════════════════════════════════════════════
 * Login page: Firebase Auth (email/password, Google, Apple), password reset.
 * Self-contained — has its own Firebase init.
 *
 * KEY FUNCTIONS:
 *   submitEmail()    — email/password sign-in or account creation
 *   signInGoogle()   — Google OAuth popup
 *   signInApple()    — Apple OAuth popup
 *   sendReset()      — password reset email
 * ═══════════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════════════
//  FIREBASE CONFIG
//  1. Go to https://console.firebase.google.com and create a project
//  2. Add a Web App (</> icon on project overview)
//  3. Copy your config object here
//  4. In Authentication > Sign-in method, enable: Email/Password, Google, Apple
// ══════════════════════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey: "AIzaSyBwtDMGEIphvwvq319MZIr62C32fvSSe-4",
  authDomain: "twygie.firebaseapp.com",
  projectId: "twygie",
  storageBucket: "twygie.firebasestorage.app",
  messagingSenderId: "654053569477",
  appId: "1:654053569477:web:9296f441c285686d7c11ac"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// If already signed in, go straight to the app
let pinVerifying = false; // gate: don't redirect during PIN check
auth.onAuthStateChanged(user => {
  if (user && !pinVerifying) goToApp();
});

// ── Mode (sign-in vs sign-up) ────────────────────────────────────────────────
let mode = 'in'; // 'in' | 'up'

function setMode(m) {
  mode = m;
  document.getElementById('tab-in').classList.toggle('active', m === 'in');
  document.getElementById('tab-up').classList.toggle('active', m === 'up');
  document.getElementById('cta-label').textContent = m === 'in' ? 'Sign in' : 'Create account';
  document.getElementById('forgot-link').style.display = m === 'in' ? 'block' : 'none';
  document.getElementById('pass').autocomplete = m === 'in' ? 'current-password' : 'new-password';
  clearErr();
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function goToApp() { window.location.href = '/app'; }

function showErr(msg, target='err-msg') {
  const el = document.getElementById(target);
  el.textContent = msg; el.classList.add('show');
}
function clearErr(target='err-msg') {
  document.getElementById(target).classList.remove('show');
}

function setLoading(btnId, on) {
  const btn = document.getElementById(btnId);
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}
function setSocialLoading(on) {
  document.getElementById('google-btn').disabled = on;
  document.getElementById('apple-btn').disabled  = on;
  document.getElementById('email-btn').disabled  = on;
}

function friendlyError(err) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password. Try again.',
    'auth/invalid-credential':   'Incorrect email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password must be at least 6 characters.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/too-many-requests':    'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': null, // silent
    'auth/cancelled-popup-request': null,
  };
  return map[err.code] || err.message || 'Something went wrong. Please try again.';
}

// ── Email auth ───────────────────────────────────────────────────────────────
async function submitEmail() {
  clearErr();
  const rawInput = document.getElementById('email').value.trim();
  const pass = document.getElementById('pass').value;

  if (!rawInput) { showErr('Please enter your email or username.'); return; }
  if (!pass) { showErr('Please enter your password or PIN.'); return; }

  setLoading('email-btn', true);
  setSocialLoading(true);

  // Detect: email has @domain.something, everything else is username
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawInput);

  if (!isEmail && mode === 'in') {
    // USERNAME + PIN PATH
    const username = rawInput.replace(/^@/, '').toLowerCase();
    try {
      // Must authenticate first — Firestore rules require auth to read managedAccounts
      pinVerifying = true;
      const userCred = await auth.signInAnonymously();

      const snap = await db.collection('managedAccounts')
        .where('username', '==', username)
        .where('authType', '==', 'pin')
        .limit(1)
        .get();

      if (snap.empty) {
        pinVerifying = false;
        await auth.currentUser.delete().catch(() => {});
        await auth.signOut().catch(() => {});
        showErr('Username not found.');
        setLoading('email-btn', false);
        setSocialLoading(false);
        return;
      }

      const acct = snap.docs[0].data();
      const acctId = snap.docs[0].id;

      if (acct.paused) {
        pinVerifying = false;
        await auth.currentUser.delete().catch(() => {});
        await auth.signOut().catch(() => {});
        showErr('This account has been paused. Contact your parent or guardian.');
        setLoading('email-btn', false);
        setSocialLoading(false);
        return;
      }

      const pinData = new TextEncoder().encode(acct.pinSalt + ':' + pass);
      const pinBuf = await crypto.subtle.digest('SHA-256', pinData);
      const pinHash = Array.from(new Uint8Array(pinBuf), b => b.toString(16).padStart(2, '0')).join('');
      if (pinHash !== acct.pinHash) {
        pinVerifying = false;
        await auth.currentUser.delete().catch(() => {});
        await auth.signOut().catch(() => {});
        showErr('Incorrect PIN.');
        setLoading('email-btn', false);
        setSocialLoading(false);
        return;
      }

      // PIN verified — keep this anonymous session
      if (userCred.user.uid !== acct.anonUid) {
        if (acct.anonUid && acct.parentUid) {
          await db.collection('familyTrees').doc(acct.parentUid).update({
            allowedReaders: firebase.firestore.FieldValue.arrayRemove(acct.anonUid)
          }).catch(() => {});
        }
        await db.collection('managedAccounts').doc(acctId).update({
          anonUid: userCred.user.uid
        });
        if (acct.parentUid && acct.tier === 'seedling') {
          await db.collection('familyTrees').doc(acct.parentUid).update({
            allowedReaders: firebase.firestore.FieldValue.arrayUnion(userCred.user.uid)
          }).catch(() => {});
        }
      }
      pinVerifying = false;
      goToApp();
    } catch (e) {
      console.error('Username login error:', e);
      pinVerifying = false;
      await auth.signOut().catch(() => {});
      showErr('Something went wrong. Please try again.');
      setLoading('email-btn', false);
      setSocialLoading(false);
    }
  } else {
    // EMAIL + PASSWORD PATH
    try {
      if (mode === 'in') {
        await auth.signInWithEmailAndPassword(rawInput, pass);
      } else {
        await auth.createUserWithEmailAndPassword(rawInput, pass);
      }
      goToApp();
    } catch(err) {
      const msg = friendlyError(err);
      if (msg) showErr(msg);
      setLoading('email-btn', false);
      setSocialLoading(false);
    }
  }
}

// allow Enter key to submit
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('main-view').style.display !== 'none') {
    submitEmail();
  }
});

// ── Google ───────────────────────────────────────────────────────────────────
async function signInGoogle() {
  clearErr();
  setSocialLoading(true);
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
    goToApp();
  } catch(err) {
    const msg = friendlyError(err);
    if (msg) showErr(msg);
    setSocialLoading(false);
  }
}

// ── Apple ────────────────────────────────────────────────────────────────────
async function signInApple() {
  clearErr();
  setSocialLoading(true);
  try {
    const provider = new firebase.auth.OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    await auth.signInWithPopup(provider);
    goToApp();
  } catch(err) {
    const msg = friendlyError(err);
    if (msg) showErr(msg);
    setSocialLoading(false);
  }
}

// ── Password reset ───────────────────────────────────────────────────────────
function showReset() {
  document.getElementById('main-view').classList.add('hide');
  document.getElementById('reset-view').classList.add('show');
  const e = document.getElementById('email').value;
  if (e) document.getElementById('reset-email').value = e;
}
function showMain() {
  document.getElementById('reset-view').classList.remove('show');
  document.getElementById('main-view').classList.remove('hide');
}

async function sendReset() {
  clearErr('reset-err');
  const email = document.getElementById('reset-email').value.trim();
  if (!email) { showErr('Please enter your email address.', 'reset-err'); return; }

  setLoading('reset-btn', true);
  try {
    await auth.sendPasswordResetEmail(email);
    document.getElementById('reset-form').style.display = 'none';
    document.getElementById('reset-sent').style.display = 'block';
  } catch(err) {
    const msg = friendlyError(err);
    if (msg) showErr(msg, 'reset-err');
  }
  setLoading('reset-btn', false);
}


// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────
document.getElementById('tab-in')?.addEventListener('click', () => setMode('in'));
document.getElementById('tab-up')?.addEventListener('click', () => setMode('up'));
document.getElementById('forgot-link')?.addEventListener('click', showReset);
document.getElementById('email-btn')?.addEventListener('click', submitEmail);
document.getElementById('google-btn')?.addEventListener('click', signInGoogle);
document.getElementById('apple-btn')?.addEventListener('click', signInApple);
document.getElementById('btn-back-main')?.addEventListener('click', showMain);
document.getElementById('reset-btn')?.addEventListener('click', sendReset);

