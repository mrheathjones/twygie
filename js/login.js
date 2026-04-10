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
auth.onAuthStateChanged(user => {
  if (user) goToApp();
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
  const email = document.getElementById('email').value.trim();
  const pass  = document.getElementById('pass').value;

  if (!email) { showErr('Please enter your email address.'); return; }
  if (!pass)  { showErr('Please enter your password.'); return; }

  setLoading('email-btn', true);
  setSocialLoading(true);

  try {
    if (mode === 'in') {
      await auth.signInWithEmailAndPassword(email, pass);
    } else {
      await auth.createUserWithEmailAndPassword(email, pass);
    }
    goToApp();
  } catch(err) {
    const msg = friendlyError(err);
    if (msg) showErr(msg);
    setLoading('email-btn', false);
    setSocialLoading(false);
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

// ─── FAMILY USERNAME LOGIN ──────────────────────────────────────────────────
function toggleFamilyLogin() {
  const view = document.getElementById('family-view');
  const btn = document.getElementById('family-toggle');
  const isOpen = view.style.display !== 'none';
  view.style.display = isOpen ? 'none' : '';
  btn.classList.toggle('open', !isOpen);
  // Change + to × when open
  btn.querySelector('svg').innerHTML = isOpen
    ? '<path d="M12 5v14"/><path d="M5 12h14"/>'
    : '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>';
}

async function hashPinLogin(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

async function submitFamily() {
  clearErr('family-err');
  const username = document.getElementById('family-user').value.trim().toLowerCase();
  const pin = document.getElementById('family-pin').value;

  if (!username) { showErr('Enter your username.', 'family-err'); return; }
  if (!pin) { showErr('Enter your PIN.', 'family-err'); return; }

  const btn = document.getElementById('family-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    // 1. Look up managed account by username
    const snap = await db.collection('managedAccounts')
      .where('username', '==', username)
      .where('authType', '==', 'pin')
      .limit(1)
      .get();

    if (snap.empty) {
      showErr('Username not found.', 'family-err');
      btn.classList.remove('loading');
      btn.disabled = false;
      return;
    }

    const acct = snap.docs[0].data();
    const acctId = snap.docs[0].id;

    // 2. Check if paused
    if (acct.paused) {
      showErr('This account has been paused. Contact your parent or guardian.', 'family-err');
      btn.classList.remove('loading');
      btn.disabled = false;
      return;
    }

    // 3. Verify PIN
    const hash = await hashPinLogin(pin, acct.pinSalt);
    if (hash !== acct.pinHash) {
      showErr('Incorrect PIN.', 'family-err');
      btn.classList.remove('loading');
      btn.disabled = false;
      return;
    }

    // 4. Sign in anonymously
    let userCred;
    if (acct.anonUid) {
      // Returning user — try to sign in. If the anonymous account was cleaned up,
      // create a new one and update the doc
      try {
        // Anonymous accounts can't "sign back in" — they're device-bound.
        // If we have an anonUid but no active session, create new anonymous and update.
        userCred = await auth.signInAnonymously();
        if (userCred.user.uid !== acct.anonUid) {
          // New anonymous UID — update the managed account doc
          await db.collection('managedAccounts').doc(acctId).update({
            anonUid: userCred.user.uid
          });
          // Update allowedReaders: remove old, add new
          if (acct.parentUid) {
            const treeRef = db.collection('familyTrees').doc(acct.parentUid);
            await treeRef.update({
              allowedReaders: firebase.firestore.FieldValue.arrayRemove(acct.anonUid)
            }).catch(() => {});
            await treeRef.update({
              allowedReaders: firebase.firestore.FieldValue.arrayUnion(userCred.user.uid)
            }).catch(() => {});
          }
        }
      } catch (e) {
        userCred = await auth.signInAnonymously();
        await db.collection('managedAccounts').doc(acctId).update({
          anonUid: userCred.user.uid
        });
      }
    } else {
      // First login — create anonymous account
      userCred = await auth.signInAnonymously();
      await db.collection('managedAccounts').doc(acctId).update({
        anonUid: userCred.user.uid
      });
      // Add to parent's allowedReaders
      if (acct.parentUid && acct.tier === 'seedling') {
        await db.collection('familyTrees').doc(acct.parentUid).update({
          allowedReaders: firebase.firestore.FieldValue.arrayUnion(userCred.user.uid)
        }).catch(() => {});
      }
    }

    // 5. Go to app
    goToApp();

  } catch (e) {
    console.error('Family login error:', e);
    showErr('Something went wrong. Please try again.', 'family-err');
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// Event listeners
document.getElementById('family-toggle')?.addEventListener('click', toggleFamilyLogin);
document.getElementById('family-btn')?.addEventListener('click', submitFamily);
document.getElementById('family-pin')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitFamily();
});
