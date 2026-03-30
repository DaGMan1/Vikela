/**
 * Enhanced Identity Manager
 * Handles contact profiles, trust scoring, and domain validation
 * Uses IndexedDB for persistent storage
 */

import storageManager from '../shared/storage.js';

// Disposable email domains
const DISPOSABLE_DOMAINS = [
    'mailinator.com', 'yopmail.com', 'temp-mail.org', 'guerrillamail.com',
    '10minutemail.com', 'sharklasers.com', 'throwawaymail.com', 'getairmail.com',
    'tempinbox.com', 'mailnesia.com', 'tempail.com', 'tempmail.com',
    'fakeinbox.com', 'sharklasers.com', 'spam4.me', 'trashmail.com',
    'emailondeck.com', 'mailcatch.com', 'tempmailaddress.com',
    'burnermail.io', 'tempmailo.com', 'tmpmail.org', 'temp-mails.com',
    'tempmailin.com', 'mailtemp.info', 'temporarymail.com', 'tempmail.net'
];

// Trusted domains whitelist
const TRUSTED_DOMAINS = [
    'google.com', 'gmail.com', 'apple.com', 'microsoft.com', 'amazon.com',
    'linkedin.com', 'github.com', 'facebook.com', 'twitter.com', 'x.com',
    'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'protonmail.com',
    'hey.com', 'fastmail.com', 'zoho.com', 'slack.com', 'discord.com',
    'stripe.com', 'square.com', 'shopify.com', 'salesforce.com', 'hubspot.com'
];

class IdentityManager {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        // Initialize storage
        await storageManager.init();
        this.initialized = true;
        console.log('IdentityManager: Initialized');
    }

    /**
     * Get or create contact by email
     */
    async getOrCreateContact(email, initialData = {}) {
        const normalizedEmail = email.toLowerCase().trim();
        let contact = await storageManager.getContact(normalizedEmail);

        if (!contact) {
            contact = this._createEmptyProfile(normalizedEmail);
            console.log(`IdentityManager: Created new contact for ${normalizedEmail}`);
        }

        // Merge initial data
        if (initialData.name) contact.name = initialData.name;
        if (initialData.phone) contact.phone = initialData.phone;
        if (initialData.company) contact.company = initialData.company;
        if (initialData.title) contact.title = initialData.title;

        // Update timestamps and stats
        contact.lastSeen = Date.now();
        if (!contact.firstSeen) contact.firstSeen = Date.now();
        
        // Increment interaction count
        contact.interactionCount = (contact.interactionCount || 0) + 1;

        // Add to history (keep last 50)
        if (!contact.interactionHistory) contact.interactionHistory = [];
        contact.interactionHistory.push({
            timestamp: Date.now(),
            type: initialData.interactionType || 'view'
        });
        if (contact.interactionHistory.length > 50) {
            contact.interactionHistory.shift();
        }

        // Recalculate trust score
        contact.trustScore = await this._calculateTrustScore(contact);

        // Determine safety status
        contact.safetyStatus = this._getSafetyStatus(contact.trustScore);

        // Save contact
        await storageManager.saveContact(contact);

        return contact;
    }

    /**
     * Update existing contact with new data
     */
    async updateContact(email, updates) {
        const contact = await storageManager.getContact(email.toLowerCase().trim());
        if (!contact) {
            throw new Error(`Contact not found: ${email}`);
        }

        // Merge updates
        Object.assign(contact, updates);
        contact.lastUpdated = Date.now();

        // Recalculate trust score
        contact.trustScore = await this._calculateTrustScore(contact);
        contact.safetyStatus = this._getSafetyStatus(contact.trustScore);

        await storageManager.saveContact(contact);
        return contact;
    }

    /**
     * Add note to contact
     */
    async addNote(email, noteText) {
        const contact = await storageManager.getContact(email.toLowerCase().trim());
        if (!contact) return null;

        if (!contact.notes) contact.notes = [];
        contact.notes.push({
            text: noteText,
            timestamp: Date.now()
        });

        await storageManager.saveContact(contact);
        return contact;
    }

    /**
     * Add tag to contact
     */
    async addTag(email, tag) {
        const contact = await storageManager.getContact(email.toLowerCase().trim());
        if (!contact) return null;

        if (!contact.tags) contact.tags = [];
        if (!contact.tags.includes(tag)) {
            contact.tags.push(tag);
        }

        await storageManager.saveContact(contact);
        return contact;
    }

    /**
     * Remove tag from contact
     */
    async removeTag(email, tag) {
        const contact = await storageManager.getContact(email.toLowerCase().trim());
        if (!contact || !contact.tags) return null;

        contact.tags = contact.tags.filter(t => t !== tag);
        await storageManager.saveContact(contact);
        return contact;
    }

    /**
     * Blacklist a sender
     */
    async blacklistSender(email, reason = '') {
        const normalizedEmail = email.toLowerCase().trim();
        
        // Add to blacklist
        await storageManager.blacklistEmail(normalizedEmail, reason);
        
        // Update contact if exists
        const contact = await storageManager.getContact(normalizedEmail);
        if (contact) {
            contact.isBlacklisted = true;
            contact.blacklistReason = reason;
            contact.trustScore = 0;
            contact.safetyStatus = 'danger';
            await storageManager.saveContact(contact);
        }

        // Remove from whitelist if present
        await storageManager.removeFromWhitelist(normalizedEmail);

        console.log(`IdentityManager: Blacklisted ${normalizedEmail}`);
        return true;
    }

    /**
     * Whitelist a sender
     */
    async whitelistSender(email, reason = '') {
        const normalizedEmail = email.toLowerCase().trim();
        
        // Add to whitelist
        await storageManager.whitelistEmail(normalizedEmail, reason);
        
        // Update contact if exists
        const contact = await storageManager.getContact(normalizedEmail);
        if (contact) {
            contact.isWhitelisted = true;
            contact.whitelistReason = reason;
            contact.trustScore = 100;
            contact.safetyStatus = 'safe';
            await storageManager.saveContact(contact);
        }

        // Remove from blacklist if present
        await storageManager.removeFromBlacklist(normalizedEmail);

        console.log(`IdentityManager: Whitelisted ${normalizedEmail}`);
        return true;
    }

    /**
     * Extract contact info from email content
     */
    async extractFromEmailContent(email, emailContent) {
        const contact = await storageManager.getContact(email.toLowerCase().trim());
        if (!contact) return null;

        // Extract phone numbers
        const phoneRegex = /(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g;
        const phones = emailContent.match(phoneRegex);
        if (phones && !contact.phone) {
            contact.phone = phones[0];
        }

        // Extract addresses (simplified)
        const addressRegex = /(\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|plaza|plz|suite|ste)\s*,?\s*[\w\s]+,\s*[a-zA-Z]{2}\s*\d{5})/gi;
        const addresses = emailContent.match(addressRegex);
        if (addresses && !contact.address) {
            contact.address = addresses[0];
        }

        // Extract social media URLs from signature
        const socialPatterns = {
            linkedin: /linkedin\.com\/in\/[\w-]+/i,
            twitter: /twitter\.com\/[\w_]+/i,
            github: /github\.com\/[\w-]+/i,
            facebook: /facebook\.com\/[\w.]+/i,
            instagram: /instagram\.com\/[\w.]+/i
        };

        if (!contact.socials) contact.socials = {};

        for (const [platform, pattern] of Object.entries(socialPatterns)) {
            const match = emailContent.match(pattern);
            if (match && !contact.socials[platform]) {
                contact.socials[platform] = `https://${match[0]}`;
            }
        }

        // Extract company name (simple heuristic)
        if (!contact.company) {
            const companyRegex = /(?:at|with)\s+([A-Z][\w\s&]+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation|Company|Co\.?))/i;
            const companyMatch = emailContent.match(companyRegex);
            if (companyMatch) {
                contact.company = companyMatch[1].trim();
            }
        }

        await storageManager.saveContact(contact);
        return contact;
    }

    /**
     * Calculate trust score
     */
    async _calculateTrustScore(contact) {
        let score = 0;
        const domain = contact.email.split('@')[1];

        // Check whitelist/blacklist first
        if (await storageManager.isWhitelisted(contact.email)) {
            return 100;
        }
        if (await storageManager.isBlacklisted(contact.email)) {
            return 0;
        }

        // Domain verification
        if (TRUSTED_DOMAINS.includes(domain)) {
            score += 50;
        }

        // Disposable domain check
        if (this._isDisposable(domain)) {
            return 0;
        }

        // Domain age (placeholder - would need API)
        // score += 30 if domainAge > 1 year

        // Interaction history
        if (contact.interactionCount > 5) score += 20;
        if (contact.interactionCount > 20) score += 20;

        // Profile completeness
        if (contact.name) score += 10;
        if (contact.phone) score += 5;
        if (contact.company) score += 5;
        if (contact.socials && Object.keys(contact.socials).length > 0) score += 10;

        // Cap at 100
        return Math.min(score, 100);
    }

    /**
     * Get safety status from score
     */
    _getSafetyStatus(score) {
        if (score >= 70) return 'safe';
        if (score >= 30) return 'caution';
        return 'danger';
    }

    /**
     * Check if domain is disposable
     */
    _isDisposable(domain) {
        return DISPOSABLE_DOMAINS.includes(domain.toLowerCase());
    }

    /**
     * Create empty profile
     */
    _createEmptyProfile(email) {
        return {
            email: email,
            name: '',
            phone: '',
            company: '',
            title: '',
            address: '',
            socials: {},
            notes: [],
            tags: [],
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            lastUpdated: Date.now(),
            interactionCount: 0,
            interactionHistory: [],
            trustScore: 0,
            safetyStatus: 'danger',
            isBlacklisted: false,
            isWhitelisted: false
        };
    }

    /**
     * Get all contacts
     */
    async getAllContacts() {
        return storageManager.getAllContacts();
    }

    /**
     * Search contacts
     */
    async searchContacts(query) {
        return storageManager.searchContacts(query);
    }

    /**
     * Get contacts by tag
     */
    async getContactsByTag(tag) {
        return storageManager.getContactsByTag(tag);
    }

    /**
     * Get statistics
     */
    async getStats() {
        return storageManager.getStats();
    }

    /**
     * Delete contact
     */
    async deleteContact(email) {
        await storageManager.delete('contacts', email.toLowerCase().trim());
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        await storageManager.clearAllData();
    }
}

// Export singleton
const identityManager = new IdentityManager();
export default identityManager;
