/**
 * Vikela Sidebar Controller — index.js
 * =====================================
 * Manages all UI behaviour for the Gmail intelligence sidebar.
 * Communicates with the extension background via chrome.runtime.sendMessage
 * and chrome.runtime.onMessage for live push updates.
 *
 * Architecture:
 *  - On load → attempt GET_CURRENT_SENDER with retry
 *  - On success → populate all panels, set up event listeners
 *  - Live updates → listen for PROFILE_UPDATED / SENDER_SELECTED / CONTACT_UPDATED
 */

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {Object|null} The current contact object being displayed */
let currentContact = null;

/** Tracks which lazy-load tabs have already been activated */
const tabLoaded = {
  history: false,
  osint: false,
};

// ─── Utility helpers ─────────────────────────────────────────────────────────

/**
 * Send a message to the extension background script.
 * @param {Object} msg
 * @returns {Promise<any>}
 */
function sendMsg(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a Unix timestamp (ms) to a human-readable relative date or short date.
 * @param {number} ts - milliseconds since epoch
 * @returns {string}
 */
function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format a Unix timestamp (ms) to "Month YYYY" label for grouping.
 * @param {number} ts
 * @returns {string}
 */
function monthLabel(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Generate an avatar URL from ui-avatars.com.
 * Falls back to first character of email if no name.
 * @param {string} name
 * @param {string} email
 * @returns {string}
 */
function avatarUrl(name, email) {
  const displayName = (name && name.trim()) ? name.trim() : (email ? email[0].toUpperCase() : '?');
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff&size=80&bold=true`;
}

// ─── Show / hide loading ──────────────────────────────────────────────────────

function showLoading() {
  document.getElementById('loading-state').classList.remove('hidden');
  document.getElementById('main-content').classList.add('hidden');
}

function showContent() {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('main-content').classList.remove('hidden');
  const es = document.getElementById('empty-state'); if (es) es.style.display='none';
}
function showEmptyState() {
  document.getElementById('loading-state').classList.add('hidden');
  document.getElementById('main-content').classList.add('hidden');
  let el = document.getElementById('empty-state');
  if (!el) {
    el = document.createElement('div');
    el.id = 'empty-state';
    el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#64748b;text-align:center;padding:32px;gap:16px;';
    el.innerHTML = '<div style="font-size:40px">✉️</div><div style="font-size:15px;font-weight:600;color:#94a3b8">Open an email</div><div style="font-size:13px;line-height:1.6">Click any email in Gmail and Vikela will show the sender profile here automatically.</div>';
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
}


// ─── Tab switching ────────────────────────────────────────────────────────────

/**
 * Activate a tab by its data-tab value.
 * Triggers lazy-loads for history and osint on first activation.
 * @param {string} tabName
 */
function activateTab(tabName) {
  // Update tab button styles
  document.querySelectorAll('.tab').forEach((el) => {
    el.classList.toggle('active', el.dataset.tab === tabName);
  });

  // Update panel visibility
  document.querySelectorAll('.panel').forEach((el) => {
    el.classList.remove('active');
  });
  const panel = document.getElementById(`panel-${tabName}`);
  if (panel) panel.classList.add('active');

  // Lazy-load history on first activation
  if (tabName === 'history' && !tabLoaded.history && currentContact) {
    tabLoaded.history = true;
    loadHistory(currentContact.email);
  }

  // Lazy-load OSINT on first activation — trigger if not yet cached
  if (tabName === 'osint' && !tabLoaded.osint && currentContact) {
    tabLoaded.osint = true;
    const osint = currentContact.osint;
    if (!osint || !osint.lastChecked) {
      // No cached data — trigger a fresh check
      triggerOsint(currentContact.email);
    } else {
      // Already have data — just render it
      renderOsint(osint);
    }
  }
}

// ─── Populate sender strip ────────────────────────────────────────────────────

/**
 * Render avatar, name, email and trust badge from contact.
 * @param {Object} contact
 */
function renderSenderStrip(contact) {
  const avatar = document.getElementById('avatar');
  avatar.src = avatarUrl(contact.name, contact.email);
  avatar.alt = contact.name || contact.email;

  document.getElementById('sender-name').textContent = contact.name || contact.email;
  document.getElementById('sender-email').textContent = contact.email;

  // Trust badge
  const badge = document.getElementById('trust-badge');
  badge.className = 'trust-badge'; // reset

  const status = contact.safetyStatus;
  if (status === 'safe') {
    badge.classList.add('safe');
    badge.textContent = '✓ Known';
  } else if (status === 'caution') {
    badge.classList.add('caution');
    badge.textContent = '⚠ Caution';
  } else if (status === 'danger') {
    badge.classList.add('danger');
    badge.textContent = '✕ Suspicious';
  } else {
    badge.classList.add('unknown');
    badge.textContent = 'Unknown';
  }
}

// ─── Profile panel ────────────────────────────────────────────────────────────

/**
 * Set a field value element. Clears 'empty' class if value is present.
 * @param {string} id
 * @param {string|null} value
 * @param {string} [fallback]
 */
function setField(id, value, fallback = 'Not found') {
  const el = document.getElementById(id);
  if (!el) return;
  if (value) {
    el.textContent = value;
    el.classList.remove('empty');
  } else {
    el.textContent = fallback;
    el.classList.add('empty');
  }
}

/**
 * Same as setField but renders an anchor link.
 * @param {string} id
 * @param {string|null} url
 * @param {string} [displayText]
 */
function setLinkField(id, url, displayText) {
  const el = document.getElementById(id);
  if (!el) return;
  if (url) {
    el.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">${displayText || url}</a>`;
    el.classList.remove('empty');
  } else {
    el.textContent = 'Not found';
    el.classList.add('empty');
  }
}

/**
 * Render the full profile panel from a contact object.
 * @param {Object} contact
 */
function renderProfile(contact) {
  setField('field-phone', contact.phone);
  setField('field-company', contact.company);
  setField('field-title', contact.title);

  const socials = contact.socials || {};
  setLinkField('field-linkedin', socials.linkedin, 'View profile');
  setLinkField('field-twitter', socials.twitter, socials.twitter);

  renderTags(contact.tags || []);
  renderNotes(contact.notes || []);
  renderActionButtons(contact);
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

/**
 * Render tags as spans inside #tags-container.
 * @param {string[]} tags
 */
function renderTags(tags) {
  const container = document.getElementById('tags-container');
  // Clear existing tags (but preserve the "Add tag" button)
  container.innerHTML = '';

  tags.forEach((tag) => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.textContent = tag;
    span.title = 'Click to remove'; // future enhancement hint
    container.appendChild(span);
  });

  // Always append the "Add tag" button at the end
  const addBtn = document.createElement('span');
  addBtn.className = 'tag-add';
  addBtn.id = 'btn-add-tag';
  addBtn.textContent = '+ Add tag';
  addBtn.addEventListener('click', handleAddTag);
  container.appendChild(addBtn);
}

// ─── Notes ────────────────────────────────────────────────────────────────────

/**
 * Render notes list (newest first).
 * @param {Array<{text: string, timestamp: number}>} notes
 */
function renderNotes(notes) {
  const list = document.getElementById('notes-list');
  list.innerHTML = '';

  if (!notes || notes.length === 0) {
    list.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:4px 0 8px;">No notes yet.</div>';
    return;
  }

  // Sort newest first
  const sorted = [...notes].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  sorted.forEach((note) => {
    const div = document.createElement('div');
    div.className = 'note-item';
    div.innerHTML = `
      <div class="note-text">${escapeHtml(note.text)}</div>
      <div class="note-date">${formatDate(note.timestamp)}</div>
    `;
    list.appendChild(div);
  });
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Trust / Block buttons ────────────────────────────────────────────────────

/**
 * Render Trust and Block buttons, reflecting current whitelisted/blacklisted state.
 * @param {Object} contact
 */
function renderActionButtons(contact) {
  const trustBtn = document.getElementById('btn-trust');
  const blockBtn = document.getElementById('btn-block');

  if (contact.isWhitelisted) {
    trustBtn.textContent = '✓ Trusted';
    trustBtn.className = 'btn btn-neutral';
    trustBtn.title = 'Already whitelisted — click to remove';
  } else {
    trustBtn.textContent = '✓ Trust';
    trustBtn.className = 'btn btn-safe';
    trustBtn.title = 'Add to whitelist';
  }

  if (contact.isBlacklisted) {
    blockBtn.textContent = '✕ Blocked';
    blockBtn.className = 'btn btn-neutral';
    blockBtn.title = 'Already blacklisted — click to remove';
  } else {
    blockBtn.textContent = '✕ Block';
    blockBtn.className = 'btn btn-danger';
    blockBtn.title = 'Add to blacklist';
  }
}

// ─── History panel ────────────────────────────────────────────────────────────

/**
 * Request email history from background and render it.
 * @param {string} email
 */
async function loadHistory(email) {
  const list = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');

  list.innerHTML = '<div class="osint-loading">Loading history…</div>';
  countEl.textContent = 'Loading…';

  try {
    const response = await sendMsg({ type: 'GET_EMAIL_HISTORY', email });
    const history = (response && response.history) ? response.history : [];
    renderHistory(history);
  } catch (err) {
    list.innerHTML = '<div class="no-history"><div class="icon">⚠️</div><div>Failed to load history</div></div>';
    countEl.textContent = 'Error';
    console.error('[Vikela] loadHistory error:', err);
  }
}

/**
 * Render email history grouped by month.
 * @param {Array<{messageId, subject, timestamp, hasAttachments, snippet}>} history
 */
function renderHistory(history) {
  const list = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');

  list.innerHTML = '';
  countEl.textContent = `${history.length} email${history.length !== 1 ? 's' : ''}`;

  if (!history || history.length === 0) {
    list.innerHTML = `
      <div class="no-history">
        <div class="icon">📭</div>
        <div>No history found</div>
        <div style="font-size:11px; margin-top: 4px;">Emails will appear here as you open them</div>
      </div>`;
    return;
  }

  // Sort newest first
  const sorted = [...history].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Group by "Month YYYY"
  const groups = {};
  sorted.forEach((item) => {
    const label = monthLabel(item.timestamp);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  });

  Object.entries(groups).forEach(([label, items]) => {
    // Month divider
    const divider = document.createElement('div');
    divider.className = 'month-divider';
    divider.textContent = label;
    list.appendChild(divider);

    items.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'email-item';
      el.innerHTML = `
        <div class="email-subject">${escapeHtml(item.subject || '(No subject)')}</div>
        <div class="email-meta">
          <span class="email-date">${formatDate(item.timestamp)}</span>
          ${item.hasAttachments ? '<span class="email-attachments">📎</span>' : ''}
        </div>
        ${item.snippet ? `<div style="font-size:11px;color:var(--text3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.snippet)}</div>` : ''}
      `;

      // Click → open in Gmail
      el.addEventListener('click', () => {
        if (item.messageId) {
          // Gmail URL scheme for opening a specific message
          const url = `https://mail.google.com/mail/u/0/#inbox/${item.messageId}`;
          chrome.tabs.create({ url });
        }
      });

      list.appendChild(el);
    });
  });
}

// ─── OSINT panel ─────────────────────────────────────────────────────────────

/**
 * Trigger OSINT data collection from background, then wait for a CONTACT_UPDATED push.
 * While waiting, show a loading state.
 * @param {string} email
 */
async function triggerOsint(email) {
  // Show loading indicators on all OSINT fields
  const loadingIds = [
    'osint-domain-age', 'osint-spf', 'osint-dkim', 'osint-dmarc', 'osint-mx',
    'osint-hunter', 'osint-gcontacts', 'osint-disposable', 'osint-breaches', 'osint-reputation',
  ];
  loadingIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = 'Checking…';
      el.className = 'osint-value unknown';
    }
  });
  document.getElementById('osint-last-checked').textContent = 'Running intelligence checks…';

  try {
    await sendMsg({ type: 'TRIGGER_OSINT', email });
    // Results will arrive via the CONTACT_UPDATED message listener
  } catch (err) {
    document.getElementById('osint-last-checked').textContent = 'Failed to start OSINT check';
    console.error('[Vikela] triggerOsint error:', err);
  }
}

/**
 * Set an OSINT field with a value and a pass/fail/warn/unknown class.
 * @param {string} id
 * @param {string} text
 * @param {'pass'|'fail'|'warn'|'unknown'} cls
 */
function setOsintField(id, text, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `osint-value ${cls}`;
}

/**
 * Render all OSINT data into the panel.
 * @param {Object} osint - contact.osint object
 */
function renderOsint(osint) {
  if (!osint) return;

  const domain = osint.domain || {};

  // Domain age — pass if > 1 year, warn if < 1 year, fail if very new
  if (domain.age) {
    const years = parseFloat(domain.age);
    if (years >= 2) setOsintField('osint-domain-age', `${domain.age}`, 'pass');
    else if (years >= 0.5) setOsintField('osint-domain-age', `${domain.age} — young`, 'warn');
    else setOsintField('osint-domain-age', `${domain.age} — very new`, 'fail');
  } else {
    setOsintField('osint-domain-age', '—', 'unknown');
  }

  // SPF
  if (domain.spf === true) setOsintField('osint-spf', 'Pass', 'pass');
  else if (domain.spf === false) setOsintField('osint-spf', 'Fail', 'fail');
  else setOsintField('osint-spf', '—', 'unknown');

  // DKIM
  if (domain.dkim === true) setOsintField('osint-dkim', 'Pass', 'pass');
  else if (domain.dkim === false) setOsintField('osint-dkim', 'Fail', 'fail');
  else setOsintField('osint-dkim', '—', 'unknown');

  // DMARC
  if (domain.dmarc === true) setOsintField('osint-dmarc', 'Pass', 'pass');
  else if (domain.dmarc === false) setOsintField('osint-dmarc', 'Fail', 'fail');
  else setOsintField('osint-dmarc', '—', 'unknown');

  // MX provider
  setOsintField('osint-mx', domain.mxProvider || '—', domain.mxProvider ? 'pass' : 'unknown');

  // Hunter.io
  const hunter = osint.hunter;
  if (hunter && hunter.confidence) {
    const name = [hunter.firstName, hunter.lastName].filter(Boolean).join(' ');
    const label = name ? `${name} (${hunter.confidence}% confidence)` : `Match (${hunter.confidence}%)`;
    const cls = hunter.confidence >= 70 ? 'pass' : 'warn';
    setOsintField('osint-hunter', label, cls);
  } else if (hunter && Object.keys(hunter).length > 0) {
    setOsintField('osint-hunter', 'Found (low confidence)', 'warn');
  } else {
    setOsintField('osint-hunter', 'No match', 'unknown');
  }

  // Google Contacts
  if (osint.googleContact === true) setOsintField('osint-gcontacts', 'In your contacts', 'pass');
  else if (osint.googleContact === false) setOsintField('osint-gcontacts', 'Not in contacts', 'unknown');
  else setOsintField('osint-gcontacts', '—', 'unknown');

  // Disposable email
  if (domain.isDisposable === true) setOsintField('osint-disposable', 'Yes — suspicious', 'fail');
  else if (domain.isDisposable === false) setOsintField('osint-disposable', 'No', 'pass');
  else setOsintField('osint-disposable', '—', 'unknown');

  // Data breaches
  const breaches = osint.breaches || [];
  if (breaches.length > 0) {
    setOsintField('osint-breaches', `${breaches.length} breach${breaches.length !== 1 ? 'es' : ''} found`, 'fail');
  } else if (osint.lastChecked) {
    setOsintField('osint-breaches', 'No breaches found', 'pass');
  } else {
    setOsintField('osint-breaches', '—', 'unknown');
  }

  // Spam reputation
  const rep = domain.reputation;
  if (rep === 'good' || rep === 'clean') setOsintField('osint-reputation', 'Clean', 'pass');
  else if (rep === 'spam' || rep === 'bad') setOsintField('osint-reputation', 'Spam listed', 'fail');
  else if (rep === 'neutral' || rep === 'unknown') setOsintField('osint-reputation', 'Neutral', 'warn');
  else if (rep) setOsintField('osint-reputation', rep, 'warn');
  else setOsintField('osint-reputation', '—', 'unknown');

  // Last checked timestamp
  if (osint.lastChecked) {
    document.getElementById('osint-last-checked').textContent =
      `Last checked: ${formatDate(osint.lastChecked)}`;
  } else {
    document.getElementById('osint-last-checked').textContent = 'Intelligence not yet loaded';
  }
}

// ─── Full render from contact ─────────────────────────────────────────────────

/**
 * Full population of all panels from a contact object.
 * Resets lazy-load flags if the contact has changed.
 * @param {Object} contact
 */
function renderContact(contact) {
  const isNewContact = !currentContact || currentContact.email !== contact.email;
  currentContact = contact;

  renderSenderStrip(contact);
  renderProfile(contact);

  // Reset lazy flags on contact change so tabs re-load for new sender
  if (isNewContact) {
    tabLoaded.history = false;
    tabLoaded.osint = false;
    // Clear history and OSINT panels
    document.getElementById('history-list').innerHTML =
      '<div class="no-history"><div class="icon">📭</div><div>No history yet</div></div>';
    document.getElementById('history-count').textContent = '';
    resetOsintPanel();
  }

  showContent();

  // If the OSINT tab is currently visible and needs re-loading for new contact
  const osintPanel = document.getElementById('panel-osint');
  if (osintPanel.classList.contains('active') && !tabLoaded.osint) {
    tabLoaded.osint = true;
    if (!contact.osint || !contact.osint.lastChecked) {
      triggerOsint(contact.email);
    } else {
      renderOsint(contact.osint);
    }
  }

  // If history tab is active and needs re-loading
  const historyPanel = document.getElementById('panel-history');
  if (historyPanel.classList.contains('active') && !tabLoaded.history) {
    tabLoaded.history = true;
    loadHistory(contact.email);
  }
}

/**
 * Reset all OSINT fields to their default "—" / unknown state.
 */
function resetOsintPanel() {
  const ids = [
    'osint-domain-age', 'osint-spf', 'osint-dkim', 'osint-dmarc', 'osint-mx',
    'osint-hunter', 'osint-gcontacts', 'osint-disposable', 'osint-breaches', 'osint-reputation',
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = '—';
      el.className = 'osint-value unknown';
    }
  });
  document.getElementById('osint-last-checked').textContent = 'Intelligence not yet loaded';
}

// ─── Initial load with retry ──────────────────────────────────────────────────

/**
 * Attempt GET_CURRENT_SENDER up to maxAttempts times, 1 second apart.
 * Shows loading state until a sender is found or attempts are exhausted.
 */
async function loadCurrentSender() {
  const MAX_ATTEMPTS = 10;
  const INTERVAL_MS = 1000;

  showLoading();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const contact = await sendMsg({ type: 'GET_CURRENT_SENDER' });
      if (contact && contact.email) {
        renderContact(contact);
        return; // success
      }
    } catch (err) {
      console.warn(`[Vikela] GET_CURRENT_SENDER attempt ${attempt} failed:`, err);
    }

    if (attempt < MAX_ATTEMPTS) {
      await sleep(INTERVAL_MS);
    }
  }

  // All attempts exhausted — stay in loading/empty state
  console.info('[Vikela] No sender found — showing empty state.'); showEmptyState();
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * Handle "Add tag" button click — prompt user for tag text.
 */
async function handleAddTag() {
  if (!currentContact) return;

  const tag = window.prompt('Enter tag:');
  if (!tag || !tag.trim()) return;

  try {
    await sendMsg({ type: 'ADD_TAG', email: currentContact.email, tag: tag.trim() });
    // Optimistically add to local state while we wait for CONTACT_UPDATED
    const tags = [...(currentContact.tags || []), tag.trim()];
    currentContact = { ...currentContact, tags };
    renderTags(tags);
  } catch (err) {
    console.error('[Vikela] ADD_TAG error:', err);
  }
}

/**
 * Save the current note input.
 */
async function handleSaveNote() {
  if (!currentContact) return;

  const input = document.getElementById('note-input');
  const text = input.value.trim();
  if (!text) return;

  try {
    await sendMsg({ type: 'ADD_NOTE', email: currentContact.email, note: text });
    input.value = '';

    // Optimistically add note to display
    const newNote = { text, timestamp: Date.now() };
    const notes = [newNote, ...(currentContact.notes || [])];
    currentContact = { ...currentContact, notes };
    renderNotes(notes);
  } catch (err) {
    console.error('[Vikela] ADD_NOTE error:', err);
  }
}

/**
 * Toggle whitelist status for current sender.
 */
async function handleTrust() {
  if (!currentContact) return;

  try {
    // If already whitelisted, this sends WHITELIST_SENDER again — background should toggle
    await sendMsg({ type: 'WHITELIST_SENDER', email: currentContact.email });
    // Optimistically flip state
    currentContact = { ...currentContact, isWhitelisted: !currentContact.isWhitelisted };
    renderActionButtons(currentContact);
  } catch (err) {
    console.error('[Vikela] WHITELIST_SENDER error:', err);
  }
}

/**
 * Toggle blacklist status for current sender.
 */
async function handleBlock() {
  if (!currentContact) return;

  try {
    await sendMsg({ type: 'BLACKLIST_SENDER', email: currentContact.email });
    // Optimistically flip state
    currentContact = { ...currentContact, isBlacklisted: !currentContact.isBlacklisted };
    renderActionButtons(currentContact);
  } catch (err) {
    console.error('[Vikela] BLACKLIST_SENDER error:', err);
  }
}

/**
 * Refresh: re-fetch the current sender from background.
 */
async function handleRefresh() {
  if (!currentContact) {
    await loadCurrentSender();
    return;
  }

  try {
    const contact = await sendMsg({ type: 'GET_CURRENT_SENDER' });
    if (contact && contact.email) {
      renderContact(contact);
    }
  } catch (err) {
    console.error('[Vikela] Refresh error:', err);
  }
}

/**
 * Force-refresh OSINT data.
 */
function handleRefreshOsint() {
  if (!currentContact) return;
  tabLoaded.osint = false; // allow re-trigger
  triggerOsint(currentContact.email);
}

// ─── Live message listener ────────────────────────────────────────────────────

/**
 * Handle incoming messages from the background script.
 * - PROFILE_UPDATED: full contact update
 * - SENDER_SELECTED: new sender selected (full contact)
 * - CONTACT_UPDATED: partial update — re-fetch from background
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'PROFILE_UPDATED':
    case 'SENDER_SELECTED':
      // msg.contact should be the full contact object
      if (msg.data) {
        renderContact(msg.data);
      }
      break;

    case 'CONTACT_UPDATED': {
      // Background signals that the contact has changed — re-fetch full profile
      const email = msg.data?.email;
      if (currentContact && email === currentContact.email) {
        sendMsg({ type: 'GET_CURRENT_SENDER' })
          .then((contact) => {
            if (contact && contact.email) {
              // Update current contact data without full panel reset
              currentContact = contact;
              renderSenderStrip(contact);
              renderProfile(contact);
              // Re-render OSINT if tab is visible
              if (document.getElementById('panel-osint').classList.contains('active')) {
                renderOsint(contact.osint);
              }
            }
          })
          .catch((err) => console.error('[Vikela] CONTACT_UPDATED re-fetch error:', err));
      }
      break;
    }

    default:
      break;
  }

  // Return false — no async sendResponse needed for these push messages
  return false;
});

// ─── Wire up event listeners ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Tab switching
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });

  // Note input: Ctrl+Enter to save
  document.getElementById('note-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveNote();
    }
  });

  // Button handlers
  document.getElementById('btn-save-note').addEventListener('click', handleSaveNote);
  document.getElementById('btn-trust').addEventListener('click', handleTrust);
  document.getElementById('btn-block').addEventListener('click', handleBlock);
  document.getElementById('btn-refresh').addEventListener('click', handleRefresh);
  document.getElementById('btn-refresh-osint').addEventListener('click', handleRefreshOsint);
  document.getElementById('btn-settings').addEventListener('click', () => {
    // Open the extension options page if available
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    }
  });

  // Delegate "Add tag" — the button gets re-created on renderTags, so use initial attach
  // (re-attached in renderTags each time, but as a safety net bind the container too)
  document.getElementById('tags-container').addEventListener('click', (e) => {
    if (e.target.id === 'btn-add-tag' || e.target.classList.contains('tag-add')) {
      handleAddTag();
    }
  });

  // Start loading
  loadCurrentSender();
});
