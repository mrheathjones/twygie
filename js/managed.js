/* ═══ managed.js ════════════════════════════════════════════════════════════
 * Managed Accounts UI: creation wizard, account list, detail/edit modal.
 *
 * READS: people[], currentUser, currentUsername, managedAccounts[],
 *        getAgeFromDob, canUseEmailAuth, validateUsername, checkUsernameAvailable,
 *        claimUsername, createManagedAccount, loadManagedAccounts,
 *        updateManagedPermissions, pauseManagedAccount, resetManagedPin,
 *        deleteManagedAccount, triggerBlossom, DEFAULT_SEEDLING_PERMISSIONS,
 *        appAlert, appConfirm, fullName
 * WRITES: managedAccounts[]
 * ═══════════════════════════════════════════════════════════════════════════ */

// ─── STATE ───────────────────────────────────────────────────────────────────
let managedCreateState = {
  step: 1,
  selectedNodeId: null,
  selectedNode: null,
  authType: 'pin',
  emailAllowed: true
};

// ─── LIST RENDERING ──────────────────────────────────────────────────────────
function renderManagedList() {
  const list = document.getElementById('managed-list');
  if (!list) return;
  if (!managedAccounts.length) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = managedAccounts.map(a => {
    const tierLabel = { seedling: 'Seedling', sprouted: 'Sprouted', full: 'Full Bloom' }[a.tier] || a.tier;
    const tierClass = a.tier || 'seedling';
    const initial = (a.displayName || '?')[0].toUpperCase();
    const username = a.username ? '@' + a.username : (a.email || '');
    const paused = a.paused ? ' · Paused' : '';
    return `<div class="managed-card" data-id="${a.id}">
      <div class="managed-card-avatar">${initial}</div>
      <div class="managed-card-info">
        <div class="managed-card-name">${a.displayName || 'Unnamed'}</div>
        <div class="managed-card-meta">${username}${paused}</div>
      </div>
      <div class="managed-tier-badge ${tierClass}">${tierLabel}</div>
    </div>`;
  }).join('');

  // Click handlers
  list.querySelectorAll('.managed-card').forEach(card => {
    card.addEventListener('click', () => openManagedDetail(card.dataset.id));
  });
}

// ─── CREATION WIZARD ─────────────────────────────────────────────────────────
function openManagedCreate() {
  managedCreateState = { step: 1, selectedNodeId: null, selectedNode: null, authType: 'pin', emailAllowed: true };

  // Populate node picker with non-isYou nodes that don't already have managed accounts
  const picker = document.getElementById('managed-node-picker');
  const existingNodeIds = new Set(managedAccounts.map(a => a.childNodeId));
  const opts = people
    .filter(p => !p.isYou && !existingNodeIds.has(p.id))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  picker.innerHTML = '<option value="">Select a Twyg…</option>' +
    opts.map(p => `<option value="${p.id}">${fullName(p)}</option>`).join('');

  // Reset all steps
  showManagedStep(1);
  document.getElementById('managed-node-info').style.display = 'none';
  document.getElementById('managed-next-1').disabled = true;
  resetManagedCredFields();

  document.getElementById('managed-create-bg').classList.add('open');
}

function closeManagedCreate() {
  document.getElementById('managed-create-bg').classList.remove('open');
}

function showManagedStep(n) {
  managedCreateState.step = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('managed-step-' + i);
    if (el) el.style.display = i === n ? '' : 'none';
  }
}

function resetManagedCredFields() {
  ['managed-username', 'managed-pin', 'managed-pin-confirm', 'managed-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['managed-username-feedback', 'managed-pin-feedback', 'managed-email-feedback'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.className = 'username-feedback'; }
  });
  document.getElementById('managed-next-3').disabled = true;
}

// Step 1: Node selection
function populateDobDropdowns() {
  const months = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const mSel = document.getElementById('managed-dob-month');
  const dSel = document.getElementById('managed-dob-day');
  const ySel = document.getElementById('managed-dob-year');
  if (!mSel || mSel.options.length > 1) return; // already populated
  months.forEach((m, i) => { if (i > 0) { const o = document.createElement('option'); o.value = i; o.textContent = m; mSel.appendChild(o); }});
  for (let d = 1; d <= 31; d++) { const o = document.createElement('option'); o.value = d; o.textContent = d; dSel.appendChild(o); }
  const curYear = new Date().getFullYear();
  for (let y = curYear; y >= curYear - 120; y--) { const o = document.createElement('option'); o.value = y; o.textContent = y; ySel.appendChild(o); }
}

function onManagedNodeSelect() {
  const picker = document.getElementById('managed-node-picker');
  const nodeId = picker.value;
  const info = document.getElementById('managed-node-info');
  const nextBtn = document.getElementById('managed-next-1');
  const dobEntry = document.getElementById('managed-dob-entry');

  if (!nodeId) {
    info.style.display = 'none';
    dobEntry.style.display = 'none';
    document.getElementById('managed-name-entry').style.display = 'none';
    nextBtn.disabled = true;
    managedCreateState.selectedNodeId = null;
    managedCreateState.selectedNode = null;
    return;
  }

  const node = people.find(p => p.id === nodeId);
  managedCreateState.selectedNodeId = nodeId;
  managedCreateState.selectedNode = node;

  const hasDob = node.dob && node.dob.year;
  const age = hasDob ? getAgeFromDob(node.dob) : null;
  const ageStr = age !== null ? `Age: ${age}` : 'No birthdate set';
  info.innerHTML = `<strong>${fullName(node)}</strong> · ${ageStr}`;
  info.style.display = '';

  if (!hasDob) {
    // Show inline DOB entry
    populateDobDropdowns();
    document.getElementById('managed-dob-month').value = '';
    document.getElementById('managed-dob-day').value = '';
    document.getElementById('managed-dob-year').value = '';
    dobEntry.style.display = '';
    nextBtn.disabled = true;
  } else {
    dobEntry.style.display = 'none';
    nextBtn.disabled = false;
  }

  // Show editable display name, pre-filled from node
  const nameEntry = document.getElementById('managed-name-entry');
  const nameInput = document.getElementById('managed-display-name');
  if (nameEntry && nameInput) {
    nameInput.value = fullName(node);
    nameEntry.style.display = '';
  }
}

function onManagedDobChange() {
  const m = document.getElementById('managed-dob-month').value;
  const d = document.getElementById('managed-dob-day').value;
  const y = document.getElementById('managed-dob-year').value;
  const nextBtn = document.getElementById('managed-next-1');
  const info = document.getElementById('managed-node-info');
  const node = managedCreateState.selectedNode;
  if (!node) return;

  if (m && d && y) {
    // Preview age
    const age = getAgeFromDob({ month: m, day: d, year: y });
    info.innerHTML = `<strong>${fullName(node)}</strong> · Age: ${age}`;
    nextBtn.disabled = false;
  } else {
    info.innerHTML = `<strong>${fullName(node)}</strong> · No birthdate set`;
    nextBtn.disabled = true;
  }
}

function saveManagedInlineDob() {
  const node = managedCreateState.selectedNode;
  if (!node) return;
  const hasDob = node.dob && node.dob.year;
  if (hasDob) return; // already has DOB

  const m = document.getElementById('managed-dob-month').value;
  const d = document.getElementById('managed-dob-day').value;
  const y = document.getElementById('managed-dob-year').value;
  if (!m || !d || !y) return;

  // Update the node's DOB in-memory and save
  node.dob = { month: m, day: d, year: y };
  managedCreateState.selectedNode = node;
  if (typeof scheduleSave === 'function') scheduleSave();
}

// Step 2: Auth method
function onManagedStep2() {
  saveManagedInlineDob(); // persist inline DOB if entered
  const node = managedCreateState.selectedNode;
  const emailAllowed = canUseEmailAuth(node.dob);
  managedCreateState.emailAllowed = emailAllowed;

  const emailOpt = document.getElementById('managed-auth-email-opt');
  const pinOpt = document.getElementById('managed-auth-pin-opt');
  const coppaNote = document.getElementById('managed-coppa-note');

  if (!emailAllowed) {
    // Under 13: force PIN, hide email option
    emailOpt.style.display = 'none';
    coppaNote.style.display = '';
    managedCreateState.authType = 'pin';
    emailOpt.classList.remove('active');
    pinOpt.classList.add('active');
  } else {
    emailOpt.style.display = '';
    coppaNote.style.display = 'none';
  }

  showManagedStep(2);
}

function setManagedAuthType(type) {
  managedCreateState.authType = type;
  document.getElementById('managed-auth-email-opt').classList.toggle('active', type === 'email');
  document.getElementById('managed-auth-pin-opt').classList.toggle('active', type === 'pin');
}

// Step 3: Credentials
function onManagedStep3() {
  const type = managedCreateState.authType;
  document.getElementById('managed-pin-fields').style.display = type === 'pin' ? '' : 'none';
  document.getElementById('managed-email-fields').style.display = type === 'email' ? '' : 'none';
  document.getElementById('managed-cred-label').textContent =
    type === 'pin' ? 'Create their login credentials' : 'Enter their email address';
  resetManagedCredFields();

  // Pre-suggest username from node name
  if (type === 'pin') {
    const node = managedCreateState.selectedNode;
    const suggested = (node.firstName || node.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    document.getElementById('managed-username').value = suggested;
    if (suggested) validateManagedUsername();
  }

  showManagedStep(3);
}

let managedUsernameTimer = null;

function validateManagedUsername() {
  const input = document.getElementById('managed-username');
  const feedback = document.getElementById('managed-username-feedback');
  const val = input.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
  input.value = val;

  const err = validateUsername(val);
  if (err) {
    feedback.textContent = err;
    feedback.className = 'username-feedback error';
    checkManagedStep3Valid();
    return;
  }

  feedback.textContent = 'Checking…';
  feedback.className = 'username-feedback checking';
  clearTimeout(managedUsernameTimer);
  managedUsernameTimer = setTimeout(async () => {
    try {
      const avail = await checkUsernameAvailable(val);
      if (input.value !== val) return;
      if (avail) {
        feedback.textContent = '✓ Available';
        feedback.className = 'username-feedback available';
      } else {
        feedback.textContent = 'Already taken';
        feedback.className = 'username-feedback error';
      }
    } catch (e) {
      feedback.textContent = 'Error checking';
      feedback.className = 'username-feedback error';
    }
    checkManagedStep3Valid();
  }, 400);
}

function validateManagedPin() {
  const pin = document.getElementById('managed-pin').value;
  const confirm = document.getElementById('managed-pin-confirm').value;
  const feedback = document.getElementById('managed-pin-feedback');

  if (!pin) { feedback.textContent = ''; feedback.className = 'username-feedback'; }
  else if (pin.length < 4) { feedback.textContent = 'PIN must be 4–8 digits'; feedback.className = 'username-feedback error'; }
  else if (!/^\d+$/.test(pin)) { feedback.textContent = 'PIN must be numbers only'; feedback.className = 'username-feedback error'; }
  else if (confirm && pin !== confirm) { feedback.textContent = 'PINs don\'t match'; feedback.className = 'username-feedback error'; }
  else if (confirm && pin === confirm) { feedback.textContent = '✓ PINs match'; feedback.className = 'username-feedback available'; }
  else { feedback.textContent = ''; feedback.className = 'username-feedback'; }

  checkManagedStep3Valid();
}

function validateManagedEmail() {
  const email = document.getElementById('managed-email').value.trim();
  const feedback = document.getElementById('managed-email-feedback');

  if (!email) { feedback.textContent = ''; feedback.className = 'username-feedback'; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { feedback.textContent = 'Enter a valid email'; feedback.className = 'username-feedback error'; }
  else { feedback.textContent = '✓ Valid'; feedback.className = 'username-feedback available'; }

  checkManagedStep3Valid();
}

function checkManagedStep3Valid() {
  const btn = document.getElementById('managed-next-3');
  const type = managedCreateState.authType;

  if (type === 'pin') {
    const usernameFb = document.getElementById('managed-username-feedback');
    const pinFb = document.getElementById('managed-pin-feedback');
    btn.disabled = !(usernameFb.classList.contains('available') && pinFb.classList.contains('available'));
  } else {
    const emailFb = document.getElementById('managed-email-feedback');
    btn.disabled = !emailFb.classList.contains('available');
  }
}

// Step 4: Permissions — just shown, defaults pre-checked in HTML

// Step 5: Create
async function submitManagedAccount() {
  const btn = document.getElementById('managed-create-btn');
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    const node = managedCreateState.selectedNode;
    const type = managedCreateState.authType;

    // Gather permissions
    const perms = {};
    ['viewPhotos','viewStories','viewTimeline','viewLinkedTrees','exportTree',
     'editOwnNode','addRemoveTwygs','deleteTwygs','linkTrees','shareTrees'].forEach(key => {
      perms[key] = !!document.getElementById('mp-' + key)?.checked;
    });

    const opts = {
      authType: type,
      childNodeId: managedCreateState.selectedNodeId,
      childDob: node.dob,
      displayName: document.getElementById('managed-display-name')?.value.trim() || fullName(node),
      permissions: perms
    };

    if (type === 'pin') {
      opts.username = document.getElementById('managed-username').value;
      opts.pin = document.getElementById('managed-pin').value;

      // Claim username in the universal system (with a placeholder UID for now)
      await db.collection('usernames').doc(opts.username).set({
        uid: currentUser.uid, // parent claims on behalf — will be transferred on first login
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      opts.email = document.getElementById('managed-email').value.trim();
    }

    const accountId = await createManagedAccount(opts);
    await loadManagedAccounts();
    renderManagedList();
    render(); // redraw tree — show rings on new managed node

    // Show confirmation
    const confirmInfo = document.getElementById('managed-confirm-info');
    if (type === 'pin') {
      confirmInfo.innerHTML = `<strong>${opts.displayName}</strong> can now sign in with:<br><br>` +
        `Username: <strong>@${opts.username}</strong><br>` +
        `PIN: <strong>${opts.pin}</strong><br><br>` +
        `<span style="font-size:.72rem;color:#e8a87c">Save these credentials — the PIN cannot be viewed again.</span>`;
    } else {
      confirmInfo.innerHTML = `<strong>${opts.displayName}</strong> can sign in with:<br><br>` +
        `Email: <strong>${opts.email}</strong><br><br>` +
        `They'll use the normal Twygie login page.`;
    }
    showManagedStep(5);

  } catch (e) {
    console.error('Failed to create managed account:', e);
    await appAlert('Failed to create account. Please try again.');
  }

  btn.disabled = false;
  btn.textContent = 'Create Account';
}

// ─── DETAIL / EDIT MODAL ─────────────────────────────────────────────────────
function openManagedDetail(accountId) {
  const acct = managedAccounts.find(a => a.id === accountId);
  if (!acct) return;

  const modal = document.getElementById('managed-detail-modal');
  document.getElementById('managed-detail-title').textContent = acct.displayName || 'Managed Account';

  const tierLabel = { seedling: '🌱 Seedling', sprouted: '🌿 Sprouted', full: '🌳 Full Bloom' }[acct.tier] || acct.tier;
  const username = acct.username ? '@' + acct.username : '—';
  const email = acct.email || '—';
  const authLabel = acct.authType === 'pin' ? 'Username & PIN' : 'Email';
  const lastActive = acct.lastActiveAt ? new Date(acct.lastActiveAt.seconds * 1000).toLocaleDateString() : 'Never';
  const created = acct.createdAt ? new Date(acct.createdAt.seconds * 1000).toLocaleDateString() : '—';
  const pausedChecked = acct.paused ? 'checked' : '';

  const perms = acct.permissions || {};
  const isFullBloom = acct.tier === 'full';
  const isSprouted = acct.tier === 'sprouted';
  const lockedPerms = ['viewPhotos', 'viewStories', 'viewTimeline', 'exportTree', 'editOwnNode'];

  let permsHtml = '';
  ['viewPhotos','viewStories','viewTimeline','viewLinkedTrees','exportTree',
   'editOwnNode','addRemoveTwygs','deleteTwygs','linkTrees','shareTrees'].forEach(key => {
    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    const checked = perms[key] ? 'checked' : '';
    const locked = (isSprouted && lockedPerms.includes(key)) || isFullBloom;
    const disabled = locked ? 'disabled' : '';
    const lockIcon = locked ? ' 🔒' : '';
    permsHtml += `<label class="managed-perm-row"><input type="checkbox" ${checked} ${disabled} data-perm="${key}" class="md-perm-cb" /><span>${label}${lockIcon}</span></label>`;
  });

  const body = document.getElementById('managed-detail-body');
  body.innerHTML = `
    <div class="managed-detail-section">
      <div class="managed-detail-section-title">Account Info</div>
      <div class="managed-detail-row"><span class="label">Tier</span><span class="value">${tierLabel}</span></div>
      <div class="managed-detail-row"><span class="label">Sign-in method</span><span class="value">${authLabel}</span></div>
      <div class="managed-detail-row"><span class="label">Username</span><span class="value">${username}</span></div>
      <div class="managed-detail-row"><span class="label">Email</span><span class="value">${email}</span></div>
      <div class="managed-detail-row"><span class="label">Last active</span><span class="value">${lastActive}</span></div>
      <div class="managed-detail-row"><span class="label">Created</span><span class="value">${created}</span></div>
    </div>

    ${!isFullBloom ? `
    <div class="managed-detail-section">
      <div class="managed-detail-section-title">Status</div>
      <label class="managed-perm-row"><input type="checkbox" id="md-paused" ${pausedChecked} /><span>Paused (blocks login)</span></label>
    </div>` : ''}

    <div class="managed-detail-section">
      <div class="managed-detail-section-title">Permissions</div>
      <div id="md-perms-list">${permsHtml}</div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      ${!isFullBloom ? `<button class="managed-btn primary" id="md-save-btn">Save Changes</button>` : ''}
      ${acct.tier === 'seedling' ? `<button class="managed-btn secondary" id="md-blossom-btn">🌿 Trigger Blossom</button>` : ''}
      ${acct.authType === 'pin' && !isFullBloom ? `<button class="managed-btn secondary" id="md-reset-pin-btn">Reset PIN</button>` : ''}
      <button class="managed-btn danger" id="md-delete-btn">Delete Account</button>
    </div>
  `;

  // Event listeners
  const saveBtn = body.querySelector('#md-save-btn');
  if (saveBtn) saveBtn.addEventListener('click', () => saveManagedDetail(accountId));

  const blossomBtn = body.querySelector('#md-blossom-btn');
  if (blossomBtn) blossomBtn.addEventListener('click', () => blossomManagedAccount(accountId));

  const resetPinBtn = body.querySelector('#md-reset-pin-btn');
  if (resetPinBtn) resetPinBtn.addEventListener('click', () => resetManagedPinPrompt(accountId));

  const deleteBtn = body.querySelector('#md-delete-btn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => deleteManagedPrompt(accountId));

  document.getElementById('managed-detail-bg').classList.add('open');
}

function closeManagedDetail() {
  document.getElementById('managed-detail-bg').classList.remove('open');
}

async function saveManagedDetail(accountId) {
  const perms = {};
  document.querySelectorAll('.md-perm-cb:not(:disabled)').forEach(cb => {
    perms[cb.dataset.perm] = cb.checked;
  });
  // Include locked perms as true
  const acct = managedAccounts.find(a => a.id === accountId);
  if (acct && acct.tier === 'sprouted') {
    ['viewPhotos', 'viewStories', 'viewTimeline', 'exportTree', 'editOwnNode'].forEach(k => perms[k] = true);
  }

  const paused = document.getElementById('md-paused')?.checked || false;

  try {
    await updateManagedPermissions(accountId, perms);
    await pauseManagedAccount(accountId, paused);
    renderManagedList();
    render(); // redraw tree
    closeManagedDetail();
    await appAlert('Changes saved.');
  } catch (e) {
    await appAlert('Failed to save changes.');
  }
}

async function blossomManagedAccount(accountId) {
  const acct = managedAccounts.find(a => a.id === accountId);
  if (!acct) return;

  // Check if child has logged in at least once
  const childUid = acct.childUid;
  if (!childUid) {
    await appAlert(`${acct.displayName} hasn't logged in yet.<br><br>They need to sign in at least once before their account can blossom.`);
    return;
  }

  const ok = await appConfirm(
    `🌿 Blossom ${acct.displayName}'s account?<br><br>This will create their own copy of your tree and promote them to Sprouted tier. This cannot be undone.`,
    'Blossom', 'Cancel'
  );
  if (!ok) return;

  try {
    await triggerBlossom(accountId);
    await loadManagedAccounts();
    renderManagedList();
    render(); // redraw tree — update rings
    closeManagedDetail();
    await appAlert(`${acct.displayName}'s account has blossomed! 🌿`);
  } catch (e) {
    console.error('Blossom failed:', e);
    await appAlert('Blossom failed: ' + (e.message || 'Unknown error'));
  }
}

async function resetManagedPinPrompt(accountId) {
  const ok = await appConfirm('Reset PIN for this account?<br><br>A new random PIN will be generated.', 'Reset PIN', 'Cancel');
  if (!ok) return;
  const newPin = String(Math.floor(1000 + Math.random() * 9000));
  try {
    await resetManagedPin(accountId, newPin);
    await appAlert(`PIN has been reset.<br><br>New PIN: <strong>${newPin}</strong><br><br><span style="font-size:.72rem;color:#e8a87c">Save this — it cannot be viewed again.</span>`);
  } catch (e) {
    console.error('Reset PIN failed:', e);
    await appAlert('Failed to reset PIN: ' + (e.message || 'Unknown error'));
  }
}

async function deleteManagedPrompt(accountId) {
  const acct = managedAccounts.find(a => a.id === accountId);
  if (!acct) return;
  const ok = await appConfirm(
    `Delete ${acct.displayName}'s managed account?<br><br>This will permanently remove their access. This cannot be undone.`,
    'Delete', 'Cancel'
  );
  if (!ok) return;

  try {
    await deleteManagedAccount(accountId);
    renderManagedList();
    render(); // redraw tree — remove rings
    closeManagedDetail();
    await appAlert('Account deleted.');
  } catch (e) {
    await appAlert('Failed to delete account.');
  }
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────
function initManagedUI() {
  // Create button
  document.getElementById('btn-create-managed')?.addEventListener('click', openManagedCreate);

  // Create modal close
  document.getElementById('managed-create-close')?.addEventListener('click', closeManagedCreate);

  // Detail modal close
  document.getElementById('managed-detail-close')?.addEventListener('click', closeManagedDetail);

  // Step 1: node picker + inline DOB
  document.getElementById('managed-node-picker')?.addEventListener('change', onManagedNodeSelect);
  document.getElementById('managed-dob-month')?.addEventListener('change', onManagedDobChange);
  document.getElementById('managed-dob-day')?.addEventListener('change', onManagedDobChange);
  document.getElementById('managed-dob-year')?.addEventListener('change', onManagedDobChange);
  document.getElementById('managed-next-1')?.addEventListener('click', onManagedStep2);

  // Step 2: auth type
  document.getElementById('managed-auth-email-opt')?.addEventListener('click', () => setManagedAuthType('email'));
  document.getElementById('managed-auth-pin-opt')?.addEventListener('click', () => setManagedAuthType('pin'));
  document.getElementById('managed-back-2')?.addEventListener('click', () => showManagedStep(1));
  document.getElementById('managed-next-2')?.addEventListener('click', onManagedStep3);

  // Step 3: credentials
  document.getElementById('managed-username')?.addEventListener('input', validateManagedUsername);
  document.getElementById('managed-pin')?.addEventListener('input', validateManagedPin);
  document.getElementById('managed-pin-confirm')?.addEventListener('input', validateManagedPin);
  document.getElementById('managed-email')?.addEventListener('input', validateManagedEmail);
  document.getElementById('managed-back-3')?.addEventListener('click', () => showManagedStep(2));
  document.getElementById('managed-next-3')?.addEventListener('click', () => { resetManagedPermDefaults(); showManagedStep(4); });

  // Step 4: permissions
  document.getElementById('managed-back-4')?.addEventListener('click', () => showManagedStep(3));
  document.getElementById('managed-create-btn')?.addEventListener('click', submitManagedAccount);

  // Step 5: done
  document.getElementById('managed-done-btn')?.addEventListener('click', closeManagedCreate);

  // Backdrop clicks
  document.getElementById('managed-create-bg')?.addEventListener('click', e => {
    if (e.target.id === 'managed-create-bg') closeManagedCreate();
  });
  document.getElementById('managed-detail-bg')?.addEventListener('click', e => {
    if (e.target.id === 'managed-detail-bg') closeManagedDetail();
  });
}

function resetManagedPermDefaults() {
  const defaults = DEFAULT_SEEDLING_PERMISSIONS;
  Object.entries(defaults).forEach(([key, val]) => {
    const cb = document.getElementById('mp-' + key);
    if (cb) cb.checked = val;
  });
}

// Load managed accounts when settings opens
function loadAndRenderManaged() {
  loadManagedAccounts().then(() => renderManagedList());
}

// Init
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initManagedUI);
else initManagedUI();
