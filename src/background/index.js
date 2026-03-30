/**
 * Vikela — Background Service Worker
 * Central orchestrator for email intelligence
 * Bundled via esbuild to avoid ES module issues in Chrome MV3
 */

// ========== CONSTANTS ==========
const DB_NAME = 'VikelaDB';
const DB_VERSION = 2;

const STORES = {
  CONTACTS: 'contacts',
  EMAIL_HISTORY: 'email_history',
  BLACKLIST: 'blacklist',
  WHITELIST: 'whitelist',
  SETTINGS: 'settings',
  OSINT_CACHE: 'osint_cache'
};

const DISPOSABLE_DOMAINS = [
  'mailinator.com','yopmail.com','temp-mail.org','guerrillamail.com',
  '10minutemail.com','sharklasers.com','throwawaymail.com','getairmail.com',
  'tempinbox.com','mailnesia.com','tempail.com','tempmail.com',
  'fakeinbox.com','spam4.me','trashmail.com','emailondeck.com',
  'mailcatch.com','tempmailaddress.com','burnermail.io','tempmailo.com',
  'tmpmail.org','temp-mails.com','tempmailin.com','mailtemp.info',
  'temporarymail.com','tempmail.net','maildrop.cc','harakirimail.com',
  'guerrillamail.net','grr.la','guerrillamail.biz','guerrillamail.de',
  'guerrillamail.org','guerrillamailblock.com'
];

const TRUSTED_DOMAINS = [
  'google.com','gmail.com','apple.com','microsoft.com','amazon.com',
  'linkedin.com','github.com','facebook.com','twitter.com','x.com',
  'outlook.com','hotmail.com','yahoo.com','icloud.com','protonmail.com',
  'hey.com','fastmail.com','zoho.com','slack.com','discord.com',
  'stripe.com','shopify.com','salesforce.com','hubspot.com',
  'mailchimp.com','sendgrid.com','twilio.com','zoom.us',
  'dropbox.com','box.com','calendly.com'
];

// Known MX provider fingerprints
const MX_PROVIDERS = {
  'google.com': 'Google Workspace',
  'googlemail.com': 'Gmail',
  'outlook.com': 'Microsoft 365',
  'hotmail.com': 'Microsoft 365',
  'protection.outlook.com': 'Microsoft 365',
  'mailprotect.com': 'Mail Protect',
  'mxroute.com': 'MXroute',
  'pphosted.com': 'Proofpoint',
  'mimecast.com': 'Mimecast',
  'barracudanetworks.com': 'Barracuda',
  'mailgun.org': 'Mailgun',
  'sendgrid.net': 'SendGrid',
  'amazonses.com': 'Amazon SES',
  'zoho.com': 'Zoho Mail',
  'fastmail.com': 'Fastmail',
  'protonmail.ch': 'ProtonMail',
  'hey.com': 'Hey'
};

// ========== STORAGE MANAGER ==========
class StorageManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { this.db = request.result; resolve(this.db); };
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORES.CONTACTS)) {
          const cs = db.createObjectStore(STORES.CONTACTS, { keyPath: 'email' });
          cs.createIndex('name', 'name', { unique: false });
          cs.createIndex('trustScore', 'trustScore', { unique: false });
          cs.createIndex('lastSeen', 'lastSeen', { unique: false });
          cs.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        }
        if (!db.objectStoreNames.contains(STORES.EMAIL_HISTORY)) {
          const hs = db.createObjectStore(STORES.EMAIL_HISTORY, { keyPath: 'messageId' });
          hs.createIndex('email', 'email', { unique: false });
          hs.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.BLACKLIST))
          db.createObjectStore(STORES.BLACKLIST, { keyPath: 'email' });
        if (!db.objectStoreNames.contains(STORES.WHITELIST))
          db.createObjectStore(STORES.WHITELIST, { keyPath: 'email' });
        if (!db.objectStoreNames.contains(STORES.SETTINGS))
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(STORES.OSINT_CACHE))
          db.createObjectStore(STORES.OSINT_CACHE, { keyPath: 'domain' });
      };
    });
    return this.initPromise;
  }

  async get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const req = tx.objectStore(storeName).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Get all email history for a specific sender, sorted newest first
  async getEmailHistoryForSender(email) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.EMAIL_HISTORY], 'readonly');
      const store = tx.objectStore(STORES.EMAIL_HISTORY);
      const index = store.index('email');
      const req = index.getAll(IDBKeyRange.only(email.toLowerCase().trim()));
      req.onsuccess = () => {
        const results = req.result || [];
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getContact(email) { return this.get(STORES.CONTACTS, email.toLowerCase().trim()); }
  async saveContact(c) {
    c.email = c.email.toLowerCase().trim();
    c.lastUpdated = Date.now();
    return this.put(STORES.CONTACTS, c);
  }
  async getAllContacts() { return this.getAll(STORES.CONTACTS); }
  async searchContacts(query) {
    const contacts = await this.getAllContacts();
    const q = query.toLowerCase();
    return contacts.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.company && c.company.toLowerCase().includes(q))
    );
  }

  async addEmailHistory(email, msg) {
    const entry = {
      messageId: msg.messageId,
      email: email.toLowerCase().trim(),
      timestamp: msg.timestamp || Date.now(),
      subject: msg.subject || '(no subject)',
      snippet: msg.snippet || '',
      hasAttachments: msg.hasAttachments || false,
      attachmentNames: msg.attachmentNames || []
    };
    return this.put(STORES.EMAIL_HISTORY, entry);
  }

  async isBlacklisted(email) { return !!(await this.get(STORES.BLACKLIST, email.toLowerCase().trim())); }
  async isWhitelisted(email) { return !!(await this.get(STORES.WHITELIST, email.toLowerCase().trim())); }
  async blacklistEmail(email, reason = '') {
    return this.put(STORES.BLACKLIST, { email: email.toLowerCase().trim(), blacklistedAt: Date.now(), reason });
  }
  async whitelistEmail(email, reason = '') {
    return this.put(STORES.WHITELIST, { email: email.toLowerCase().trim(), whitelistedAt: Date.now(), reason });
  }

  // OSINT cache — keyed by domain, expires after 7 days
  async getOsintCache(domain) {
    const cached = await this.get(STORES.OSINT_CACHE, domain.toLowerCase());
    if (!cached) return null;
    const age = Date.now() - cached.cachedAt;
    if (age > 7 * 24 * 60 * 60 * 1000) return null; // expired
    return cached.data;
  }
  async setOsintCache(domain, data) {
    return this.put(STORES.OSINT_CACHE, { domain: domain.toLowerCase(), cachedAt: Date.now(), data });
  }

  async getStats() {
    const [contacts, blacklist, whitelist] = await Promise.all([
      this.getAllContacts(), this.getAll(STORES.BLACKLIST), this.getAll(STORES.WHITELIST)
    ]);
    return {
      totalContacts: contacts.length,
      highTrust: contacts.filter(c => (c.trustScore || 0) >= 70).length,
      mediumTrust: contacts.filter(c => { const s = c.trustScore || 0; return s >= 30 && s < 70; }).length,
      lowTrust: contacts.filter(c => (c.trustScore || 0) < 30).length,
      blacklisted: blacklist.length,
      whitelisted: whitelist.length
    };
  }

  async clearAllData() {
    await this.init();
    return new Promise((resolve, reject) => {
      const stores = [STORES.CONTACTS, STORES.EMAIL_HISTORY, STORES.BLACKLIST, STORES.WHITELIST, STORES.OSINT_CACHE];
      const tx = this.db.transaction(stores, 'readwrite');
      stores.forEach(s => tx.objectStore(s).clear());
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// ========== OSINT ENGINE ==========
// Free APIs only — no paid keys required
class OsintEngine {
  constructor() {
    this.DOH_URL = 'https://cloudflare-dns.com/dns-query';
  }

  async runAll(email) {
    const domain = email.split('@')[1];
    if (!domain) return this._emptyResult();

    // Check cache first
    const cached = await storageManager.getOsintCache(domain);
    if (cached) {
      console.log(`Vikela OSINT: Using cached result for ${domain}`);
      return cached;
    }

    console.log(`Vikela OSINT: Running checks for ${domain}`);

    // Run all checks in parallel (fail gracefully on each)
    const [domainAge, spf, dkim, dmarc, mxResult, isDisposable] = await Promise.all([
      this._getDomainAge(domain),
      this._checkSpf(domain),
      this._checkDkim(domain),
      this._checkDmarc(domain),
      this._getMxProvider(domain),
      Promise.resolve(this._checkDisposable(domain))
    ]);

    const result = {
      lastChecked: Date.now(),
      domain: {
        age: domainAge,
        spf,
        dkim,
        dmarc,
        mxProvider: mxResult,
        isDisposable,
        reputation: this._assessReputation(domainAge, spf, dkim, dmarc, isDisposable)
      },
      breaches: [], // HIBP requires paid API key — placeholder
      hunter: null, // Hunter.io requires key — will use Google Contacts instead
      googleContact: false // Filled in separately
    };

    // Cache it
    await storageManager.setOsintCache(domain, result);
    return result;
  }

  // Domain age via RDAP (free, no key)
  async _getDomainAge(domain) {
    try {
      const res = await fetch(`https://rdap.org/domain/${domain}`, {
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) return 'Unknown';
      const data = await res.json();
      const events = data.events || [];
      const registration = events.find(e => e.eventAction === 'registration');
      if (!registration) return 'Unknown';
      const regDate = new Date(registration.eventDate);
      const ageDays = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays < 30) return `${ageDays} days (NEW)`;
      if (ageDays < 365) return `${Math.floor(ageDays / 30)} months`;
      return `${Math.floor(ageDays / 365)} years`;
    } catch {
      return 'Unknown';
    }
  }

  // DNS-over-HTTPS via Cloudflare (free)
  async _dnsQuery(name, type) {
    try {
      const url = `${this.DOH_URL}?name=${encodeURIComponent(name)}&type=${type}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/dns-json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.Answer || [];
    } catch {
      return null;
    }
  }

  async _checkSpf(domain) {
    const records = await this._dnsQuery(domain, 'TXT');
    if (!records) return 'none';
    const spfRecord = records.find(r => r.data && r.data.includes('v=spf1'));
    if (!spfRecord) return 'none';
    return spfRecord.data.includes('~all') || spfRecord.data.includes('-all') ? 'pass' : 'fail';
  }

  async _checkDkim(domain) {
    // Check common DKIM selectors
    const selectors = ['default', 'google', 'mail', 'dkim', 'selector1', 'selector2'];
    for (const sel of selectors) {
      const records = await this._dnsQuery(`${sel}._domainkey.${domain}`, 'TXT');
      if (records && records.some(r => r.data && r.data.includes('v=DKIM1'))) {
        return 'pass';
      }
    }
    return 'none';
  }

  async _checkDmarc(domain) {
    const records = await this._dnsQuery(`_dmarc.${domain}`, 'TXT');
    if (!records || !records.length) return 'none';
    const dmarc = records.find(r => r.data && r.data.includes('v=DMARC1'));
    if (!dmarc) return 'none';
    if (dmarc.data.includes('p=reject')) return 'pass';
    if (dmarc.data.includes('p=quarantine')) return 'pass';
    if (dmarc.data.includes('p=none')) return 'fail';
    return 'pass';
  }

  async _getMxProvider(domain) {
    const records = await this._dnsQuery(domain, 'MX');
    if (!records || !records.length) return 'Unknown';
    // MX data format: "10 aspmx.l.google.com."
    const mx = records[0].data || '';
    const mxHost = mx.replace(/^\d+\s+/, '').toLowerCase().replace(/\.$/, '');
    for (const [pattern, name] of Object.entries(MX_PROVIDERS)) {
      if (mxHost.includes(pattern)) return name;
    }
    return mxHost || 'Unknown';
  }

  _checkDisposable(domain) {
    return DISPOSABLE_DOMAINS.includes(domain.toLowerCase());
  }

  _assessReputation(age, spf, dkim, dmarc, isDisposable) {
    if (isDisposable) return 'blacklisted';
    if (age && age.includes('NEW')) return 'suspicious';
    const goodSignals = [spf === 'pass', dkim === 'pass', dmarc === 'pass'].filter(Boolean).length;
    if (goodSignals >= 2) return 'clean';
    if (goodSignals === 0) return 'suspicious';
    return 'clean';
  }

  _emptyResult() {
    return {
      lastChecked: Date.now(),
      domain: { age: 'Unknown', spf: 'none', dkim: 'none', dmarc: 'none', mxProvider: 'Unknown', isDisposable: false, reputation: 'unknown' },
      breaches: [],
      hunter: null,
      googleContact: false
    };
  }
}

// ========== GOOGLE CONTACTS LOOKUP ==========
// Uses chrome.identity to check if sender is in user's Google Contacts
class ContactsLookup {
  async checkGoogleContacts(email) {
    try {
      const token = await this._getToken();
      if (!token) return false;
      const url = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=emailAddresses,names,phoneNumbers,organizations`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return false;
      const data = await res.json();
      const results = data.results || [];
      return results.some(r =>
        (r.person?.emailAddresses || []).some(e => e.value?.toLowerCase() === email.toLowerCase())
      );
    } catch {
      return false;
    }
  }

  async enrichFromContacts(email) {
    // Returns enrichment data if found in Google Contacts
    try {
      const token = await this._getToken();
      if (!token) return null;
      const url = `https://people.googleapis.com/v1/people:searchContacts?query=${encodeURIComponent(email)}&readMask=emailAddresses,names,phoneNumbers,organizations`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      const results = data.results || [];
      const match = results.find(r =>
        (r.person?.emailAddresses || []).some(e => e.value?.toLowerCase() === email.toLowerCase())
      );
      if (!match) return null;
      const person = match.person;
      return {
        name: person.names?.[0]?.displayName || '',
        phone: person.phoneNumbers?.[0]?.value || '',
        company: person.organizations?.[0]?.name || '',
        title: person.organizations?.[0]?.title || ''
      };
    } catch {
      return null;
    }
  }

  async _getToken() {
    return new Promise(resolve => {
      chrome.identity.getAuthToken({ interactive: false }, token => {
        if (chrome.runtime.lastError || !token) { resolve(null); return; }
        resolve(token);
      });
    });
  }
}

// ========== IDENTITY MANAGER ==========
class IdentityManager {
  constructor() { this.initialized = false; }

  async init() {
    if (this.initialized) return;
    await storageManager.init();
    this.initialized = true;
  }

  async getOrCreateContact(email, initialData = {}) {
    const normalizedEmail = email.toLowerCase().trim();
    let contact = await storageManager.getContact(normalizedEmail);
    if (!contact) contact = this._createEmptyProfile(normalizedEmail);

    // Enrich from Google Contacts if we have no name yet
    if (!contact.name && !contact._contactsChecked) {
      const enrichment = await contactsLookup.enrichFromContacts(normalizedEmail);
      if (enrichment) {
        if (enrichment.name) contact.name = enrichment.name;
        if (enrichment.phone) contact.phone = enrichment.phone;
        if (enrichment.company) contact.company = enrichment.company;
        if (enrichment.title) contact.title = enrichment.title;
        contact.fromGoogleContacts = true;
      }
      contact._contactsChecked = true;
    }

    if (initialData.name && !contact.name) contact.name = initialData.name;
    if (initialData.phone && !contact.phone) contact.phone = initialData.phone;
    if (initialData.company && !contact.company) contact.company = initialData.company;
    if (initialData.title && !contact.title) contact.title = initialData.title;

    contact.lastSeen = Date.now();
    if (!contact.firstSeen) contact.firstSeen = Date.now();
    contact.interactionCount = (contact.interactionCount || 0) + 1;

    contact.trustScore = await this._calculateTrustScore(contact);
    contact.safetyStatus = this._getSafetyStatus(contact.trustScore);

    await storageManager.saveContact(contact);
    return contact;
  }

  async updateContact(email, updates) {
    let contact = await storageManager.getContact(email.toLowerCase().trim());
    if (!contact) throw new Error(`Contact not found: ${email}`);
    Object.assign(contact, updates);
    contact.trustScore = await this._calculateTrustScore(contact);
    contact.safetyStatus = this._getSafetyStatus(contact.trustScore);
    await storageManager.saveContact(contact);
    return contact;
  }

  async addNote(email, noteText) {
    const contact = await storageManager.getContact(email.toLowerCase().trim());
    if (!contact) return null;
    if (!contact.notes) contact.notes = [];
    contact.notes.push({ text: noteText, timestamp: Date.now() });
    await storageManager.saveContact(contact);
    return contact;
  }

  async addTag(email, tag) {
    const contact = await storageManager.getContact(email.toLowerCase().trim());
    if (!contact) return null;
    if (!contact.tags) contact.tags = [];
    if (!contact.tags.includes(tag)) contact.tags.push(tag);
    await storageManager.saveContact(contact);
    return contact;
  }

  async blacklistSender(email, reason = '') {
    const normalizedEmail = email.toLowerCase().trim();
    await storageManager.blacklistEmail(normalizedEmail, reason);
    const contact = await storageManager.getContact(normalizedEmail);
    if (contact) {
      contact.isBlacklisted = true;
      contact.isWhitelisted = false;
      contact.trustScore = 0;
      contact.safetyStatus = 'danger';
      await storageManager.saveContact(contact);
    }
    return true;
  }

  async whitelistSender(email, reason = '') {
    const normalizedEmail = email.toLowerCase().trim();
    await storageManager.whitelistEmail(normalizedEmail, reason);
    const contact = await storageManager.getContact(normalizedEmail);
    if (contact) {
      contact.isWhitelisted = true;
      contact.isBlacklisted = false;
      contact.trustScore = 100;
      contact.safetyStatus = 'safe';
      await storageManager.saveContact(contact);
    }
    return true;
  }

  async _calculateTrustScore(contact) {
    if (await storageManager.isWhitelisted(contact.email)) return 100;
    if (await storageManager.isBlacklisted(contact.email)) return 0;

    const domain = contact.email.split('@')[1] || '';
    let score = 20; // baseline

    // Disposable = instant zero
    if (DISPOSABLE_DOMAINS.includes(domain.toLowerCase())) return 0;

    // Known trusted domain
    if (TRUSTED_DOMAINS.includes(domain)) score += 30;

    // OSINT signals (if available)
    const osint = contact.osint;
    if (osint && osint.domain) {
      const d = osint.domain;
      if (d.spf === 'pass') score += 10;
      if (d.dkim === 'pass') score += 10;
      if (d.dmarc === 'pass') score += 10;
      if (d.reputation === 'clean') score += 10;
      if (d.reputation === 'suspicious') score -= 20;
      if (d.reputation === 'blacklisted') return 0;
      if (d.age && d.age.includes('NEW')) score -= 15;
    }

    // Interaction history
    if ((contact.interactionCount || 0) > 5) score += 10;
    if ((contact.interactionCount || 0) > 20) score += 10;

    // Profile completeness
    if (contact.name) score += 5;
    if (contact.fromGoogleContacts) score += 15; // In your contacts = trusted

    // No breaches is neutral; breaches = penalty
    if (osint && osint.breaches && osint.breaches.length > 0) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  _getSafetyStatus(score) {
    if (score >= 65) return 'safe';
    if (score >= 35) return 'caution';
    return 'danger';
  }

  _createEmptyProfile(email) {
    return {
      email, name: '', phone: '', company: '', title: '',
      socials: {}, notes: [], tags: [],
      firstSeen: Date.now(), lastSeen: Date.now(), lastUpdated: Date.now(),
      interactionCount: 0,
      trustScore: 20, safetyStatus: 'caution',
      isBlacklisted: false, isWhitelisted: false,
      fromGoogleContacts: false,
      _contactsChecked: false,
      osint: null
    };
  }

  async getAllContacts() { return storageManager.getAllContacts(); }
  async searchContacts(query) { return storageManager.searchContacts(query); }
  async getStats() { return storageManager.getStats(); }
}

// ========== GMAIL AUTH MANAGER ==========
class GmailAuthManager {
  constructor() { this.accessToken = null; this.isAuthenticated = false; }

  async init() {
    try {
      const token = await this._getStoredToken();
      if (token) { this.accessToken = token; this.isAuthenticated = true; return true; }
    } catch {}
    return false;
  }

  async authenticate() {
    return new Promise((resolve, reject) => {
      const manifest = chrome.runtime.getManifest();
      const clientId = manifest.oauth2?.client_id;
      if (!clientId || clientId.includes('YOUR_CLIENT_ID')) {
        reject(new Error('OAuth Client ID not configured in manifest.json'));
        return;
      }
      chrome.identity.getAuthToken({ interactive: true, scopes: manifest.oauth2.scopes }, (token) => {
        if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
        this.accessToken = token;
        this.isAuthenticated = true;
        chrome.storage.local.set({ 'vikela_access_token': token });
        resolve(token);
      });
    });
  }

  async _getStoredToken() {
    return new Promise(resolve => {
      chrome.storage.local.get('vikela_access_token', r => resolve(r.vikela_access_token || null));
    });
  }

  async refreshToken() {
    if (this.accessToken) {
      await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token: this.accessToken }, resolve));
    }
    this.accessToken = null;
    this.isAuthenticated = false;
    chrome.storage.local.remove('vikela_access_token');
    return this.authenticate();
  }

  async makeApiRequest(endpoint, options = {}) {
    if (!this.isAuthenticated) await this.authenticate();
    const url = `https://gmail.googleapis.com/gmail/v1${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: { 'Authorization': `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', ...options.headers }
    });
    if (res.status === 401) { await this.refreshToken(); return this.makeApiRequest(endpoint, options); }
    if (!res.ok) { const err = await res.json(); throw new Error(err.error?.message || 'Gmail API error'); }
    return res.json();
  }

  async getEmailHistoryForSender(email, maxResults = 50) {
    const query = `from:${email}`;
    const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
    const listRes = await this.makeApiRequest(`/users/me/messages?${params}`);
    if (!listRes.messages) return [];

    const messages = [];
    // Fetch metadata for each (batched, 10 at a time to be gentle)
    const ids = listRes.messages.slice(0, 30);
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const fetched = await Promise.all(batch.map(m =>
        this.makeApiRequest(`/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)
          .catch(() => null)
      ));
      for (const msg of fetched) {
        if (!msg) continue;
        const headers = msg.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const date = headers.find(h => h.name === 'Date')?.value;
        const hasAttachments = !!(msg.payload?.parts || []).find(p => p.filename && p.filename.length > 0);
        const attachmentNames = (msg.payload?.parts || [])
          .filter(p => p.filename && p.filename.length > 0)
          .map(p => p.filename);

        const entry = {
          messageId: msg.id,
          email: email.toLowerCase(),
          timestamp: date ? new Date(date).getTime() : (parseInt(msg.internalDate) || Date.now()),
          subject,
          snippet: msg.snippet || '',
          hasAttachments,
          attachmentNames
        };
        messages.push(entry);
        // Also persist to local DB
        await storageManager.addEmailHistory(email, entry).catch(() => {});
      }
    }
    return messages;
  }

  parseEmailHeader(headerValue) {
    const match = headerValue.match(/(.*?)\s*<([^>]+)>/);
    if (match) return { name: match[1].trim().replace(/"/g, ''), email: match[2].trim() };
    return { name: '', email: headerValue.trim() };
  }
}

// ========== SINGLETONS ==========
const storageManager = new StorageManager();
const identityManager = new IdentityManager();
const gmailAuthManager = new GmailAuthManager();
const osintEngine = new OsintEngine();
const contactsLookup = new ContactsLookup();

// ========== MAIN SERVICE WORKER ==========
console.log('Vikela: Background service worker loaded');

// Per-tab sender cache
const activeSenders = new Map();
let mostRecentSender = null;

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Vikela: Installed/updated', details.reason);
  await storageManager.init();
  await identityManager.init();
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (e) { console.error('Vikela: Side panel config error', e); }
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/onboarding/index.html') });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // keep channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {

      case 'SENDER_FOUND':
        await handleSenderFound(message.data, sender);
        sendResponse({ success: true });
        break;

      case 'GET_CURRENT_SENDER': {
        const tabId = await getCurrentTabId();
        let current = activeSenders.get(tabId) || mostRecentSender || null;
        sendResponse(current);
        break;
      }

      case 'GET_EMAIL_HISTORY': {
        const { email } = message.data;
        // Try local DB first
        let history = await storageManager.getEmailHistoryForSender(email);
        // If empty and Gmail auth available, fetch from Gmail API
        if (history.length === 0) {
          const isAuth = await gmailAuthManager.init();
          if (isAuth) {
            try {
              history = await gmailAuthManager.getEmailHistoryForSender(email);
            } catch (e) {
              console.warn('Vikela: Gmail history fetch failed', e.message);
            }
          }
        }
        sendResponse({ success: true, history });
        break;
      }

      case 'TRIGGER_OSINT': {
        const { email } = message.data;
        try {
          const osintResult = await osintEngine.runAll(email);
          // Also check Google Contacts
          osintResult.googleContact = await contactsLookup.checkGoogleContacts(email);
          // Merge OSINT into contact and recalculate trust score
          const contact = await storageManager.getContact(email.toLowerCase().trim());
          if (contact) {
            contact.osint = osintResult;
            contact.trustScore = await identityManager._calculateTrustScore(contact);
            contact.safetyStatus = identityManager._getSafetyStatus(contact.trustScore);
            await storageManager.saveContact(contact);
            broadcastToSidePanel('PROFILE_UPDATED', contact);
          }
          sendResponse({ success: true, osint: osintResult });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        break;
      }

      case 'WHITELIST_SENDER':
        await identityManager.whitelistSender(message.data.email, message.data.reason);
        broadcastToSidePanel('CONTACT_UPDATED', { email: message.data.email });
        sendResponse({ success: true });
        break;

      case 'BLACKLIST_SENDER':
        await identityManager.blacklistSender(message.data.email, message.data.reason);
        broadcastToSidePanel('CONTACT_UPDATED', { email: message.data.email });
        sendResponse({ success: true });
        break;

      case 'ADD_NOTE': {
        const c = await identityManager.addNote(message.data.email, message.data.note);
        sendResponse({ success: true, contact: c });
        break;
      }

      case 'ADD_TAG': {
        const c = await identityManager.addTag(message.data.email, message.data.tag);
        sendResponse({ success: true, contact: c });
        break;
      }

      case 'SEARCH_CONTACTS': {
        const results = await identityManager.searchContacts(message.data.query);
        sendResponse({ success: true, results });
        break;
      }

      case 'GET_ALL_CONTACTS': {
        const contacts = await identityManager.getAllContacts();
        sendResponse({ success: true, contacts });
        break;
      }

      case 'GET_STATS': {
        const stats = await identityManager.getStats();
        sendResponse({ success: true, stats });
        break;
      }

      case 'AUTHENTICATE_GMAIL': {
        const token = await gmailAuthManager.authenticate();
        sendResponse({ success: true, token });
        break;
      }

      case 'CHECK_GMAIL_AUTH': {
        const isAuth = await gmailAuthManager.init();
        sendResponse({ success: true, isAuthenticated: isAuth });
        break;
      }

      case 'OPEN_SIDEPANEL':
        await openSidePanel();
        if (message.data) await broadcastToSidePanel('SENDER_SELECTED', message.data);
        sendResponse({ success: true });
        break;

      case 'CLEAR_ALL_DATA':
        await storageManager.clearAllData();
        sendResponse({ success: true });
        break;

      default:
        console.warn('Vikela: Unknown message type', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Vikela: Message handler error', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSenderFound(data, sender) {
  const { email, name } = data;
  if (!email) return;
  try {
    const contact = await identityManager.getOrCreateContact(email, { name, interactionType: 'view' });
    if (sender?.tab) activeSenders.set(sender.tab.id, contact);
    mostRecentSender = contact;
    await broadcastToSidePanel('PROFILE_UPDATED', contact);
    if (sender?.tab) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'UPDATE_HALO',
        data: { email: contact.email, status: contact.safetyStatus, trustScore: contact.trustScore }
      }).catch(() => {});
    }
    console.log(`Vikela: ${email} → score:${contact.trustScore} status:${contact.safetyStatus}`);
  } catch (e) {
    console.error('Vikela: handleSenderFound error', e);
  }
}

async function openSidePanel() {
  try {
    const win = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: win.id });
  } catch (e) { console.error('Vikela: openSidePanel error', e); }
}

async function broadcastToSidePanel(type, data) {
  try {
    await chrome.runtime.sendMessage({ type, data });
  } catch {
    // Side panel not open — suppress
  }
}

async function getCurrentTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

// Periodic scan alarm
chrome.alarms.create('periodicScan', { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'periodicScan') {
    console.log('Vikela: Periodic scan triggered');
    // Light scan — just refresh any stale OSINT cache entries
  }
});

// Clean up tab cache on close
chrome.tabs.onRemoved.addListener(tabId => activeSenders.delete(tabId));

console.log('Vikela: Background service worker ready');
