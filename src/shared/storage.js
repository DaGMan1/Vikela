/**
 * Storage Manager
 * IndexedDB wrapper for Sentry data persistence
 * Handles contacts, email history, blacklists, and user preferences
 */

const DB_NAME = 'SentryDB';
const DB_VERSION = 1;

const STORES = {
    CONTACTS: 'contacts',
    EMAIL_HISTORY: 'email_history',
    BLACKLIST: 'blacklist',
    WHITELIST: 'whitelist',
    SETTINGS: 'settings'
};

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
            request.onsuccess = () => {
                this.db = request.result;
                console.log('StorageManager: Database initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Contacts store
                if (!db.objectStoreNames.contains(STORES.CONTACTS)) {
                    const contactsStore = db.createObjectStore(STORES.CONTACTS, { keyPath: 'email' });
                    contactsStore.createIndex('name', 'name', { unique: false });
                    contactsStore.createIndex('trustScore', 'trustScore', { unique: false });
                    contactsStore.createIndex('lastSeen', 'lastSeen', { unique: false });
                    contactsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                }

                // Email history store
                if (!db.objectStoreNames.contains(STORES.EMAIL_HISTORY)) {
                    const historyStore = db.createObjectStore(STORES.EMAIL_HISTORY, { 
                        keyPath: 'id', 
                        autoIncrement: true 
                    });
                    historyStore.createIndex('email', 'email', { unique: false });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Blacklist store
                if (!db.objectStoreNames.contains(STORES.BLACKLIST)) {
                    db.createObjectStore(STORES.BLACKLIST, { keyPath: 'email' });
                }

                // Whitelist store
                if (!db.objectStoreNames.contains(STORES.WHITELIST)) {
                    db.createObjectStore(STORES.WHITELIST, { keyPath: 'email' });
                }

                // Settings store
                if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
                    db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
                }

                console.log('StorageManager: Database schema created');
            };
        });

        return this.initPromise;
    }

    // Generic CRUD operations
    async get(storeName, key) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Contact-specific operations
    async getContact(email) {
        return this.get(STORES.CONTACTS, email.toLowerCase().trim());
    }

    async saveContact(contact) {
        contact.email = contact.email.toLowerCase().trim();
        contact.lastUpdated = Date.now();
        return this.put(STORES.CONTACTS, contact);
    }

    async getAllContacts() {
        return this.getAll(STORES.CONTACTS);
    }

    async searchContacts(query) {
        const contacts = await this.getAllContacts();
        const lowerQuery = query.toLowerCase();
        return contacts.filter(contact => 
            (contact.name && contact.name.toLowerCase().includes(lowerQuery)) ||
            (contact.email && contact.email.toLowerCase().includes(lowerQuery)) ||
            (contact.company && contact.company.toLowerCase().includes(lowerQuery))
        );
    }

    async getContactsByTag(tag) {
        const contacts = await this.getAllContacts();
        return contacts.filter(contact => 
            contact.tags && contact.tags.includes(tag)
        );
    }

    // Email history operations
    async addEmailHistory(email, messageData) {
        const historyEntry = {
            email: email.toLowerCase().trim(),
            timestamp: Date.now(),
            messageId: messageData.messageId,
            subject: messageData.subject,
            snippet: messageData.snippet,
            hasAttachments: messageData.hasAttachments || false
        };
        return this.put(STORES.EMAIL_HISTORY, historyEntry);
    }

    async getEmailHistory(email, limit = 50) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORES.EMAIL_HISTORY], 'readonly');
            const store = transaction.objectStore(STORES.EMAIL_HISTORY);
            const index = store.index('email');
            const request = index.getAll(email.toLowerCase().trim());

            request.onsuccess = () => {
                const results = request.result
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, limit);
                resolve(results);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Blacklist/Whitelist operations
    async isBlacklisted(email) {
        const entry = await this.get(STORES.BLACKLIST, email.toLowerCase().trim());
        return !!entry;
    }

    async isWhitelisted(email) {
        const entry = await this.get(STORES.WHITELIST, email.toLowerCase().trim());
        return !!entry;
    }

    async blacklistEmail(email, reason = '') {
        await this.put(STORES.BLACKLIST, {
            email: email.toLowerCase().trim(),
            blacklistedAt: Date.now(),
            reason: reason
        });
    }

    async whitelistEmail(email, reason = '') {
        await this.put(STORES.WHITELIST, {
            email: email.toLowerCase().trim(),
            whitelistedAt: Date.now(),
            reason: reason
        });
    }

    async removeFromBlacklist(email) {
        await this.delete(STORES.BLACKLIST, email.toLowerCase().trim());
    }

    async removeFromWhitelist(email) {
        await this.delete(STORES.WHITELIST, email.toLowerCase().trim());
    }

    // Settings operations
    async getSetting(key, defaultValue = null) {
        const entry = await this.get(STORES.SETTINGS, key);
        return entry ? entry.value : defaultValue;
    }

    async setSetting(key, value) {
        await this.put(STORES.SETTINGS, { key, value });
    }

    // Statistics
    async getStats() {
        const [contacts, blacklist, whitelist] = await Promise.all([
            this.getAllContacts(),
            this.getAll(STORES.BLACKLIST),
            this.getAll(STORES.WHITELIST)
        ]);

        return {
            totalContacts: contacts.length,
            highTrust: contacts.filter(c => (c.trustScore || 0) >= 70).length,
            mediumTrust: contacts.filter(c => {
                const score = c.trustScore || 0;
                return score >= 30 && score < 70;
            }).length,
            lowTrust: contacts.filter(c => (c.trustScore || 0) < 30).length,
            blacklisted: blacklist.length,
            whitelisted: whitelist.length
        };
    }

    // Cleanup
    async clearAllData() {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                [STORES.CONTACTS, STORES.EMAIL_HISTORY, STORES.BLACKLIST, STORES.WHITELIST], 
                'readwrite'
            );
            
            let completed = 0;
            const stores = [STORES.CONTACTS, STORES.EMAIL_HISTORY, STORES.BLACKLIST, STORES.WHITELIST];
            
            stores.forEach(storeName => {
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => {
                    completed++;
                    if (completed === stores.length) resolve();
                };
            });

            transaction.onerror = () => reject(transaction.error);
        });
    }
}

// Export singleton
const storageManager = new StorageManager();
export default storageManager;
export { STORES };
