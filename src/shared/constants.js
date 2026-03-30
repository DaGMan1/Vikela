/**
 * Sentry Constants
 * Shared configuration and constants
 */

// Disposable email domains
export const DISPOSABLE_DOMAINS = [
    'mailinator.com', 'yopmail.com', 'temp-mail.org', 'guerrillamail.com',
    '10minutemail.com', 'sharklasers.com', 'throwawaymail.com', 'getairmail.com',
    'tempinbox.com', 'mailnesia.com', 'tempail.com', 'tempmail.com',
    'fakeinbox.com', 'spam4.me', 'trashmail.com',
    'emailondeck.com', 'mailcatch.com', 'tempmailaddress.com',
    'burnermail.io', 'tempmailo.com', 'tmpmail.org', 'temp-mails.com',
    'tempmailin.com', 'mailtemp.info', 'temporarymail.com', 'tempmail.net',
    'maildrop.cc', 'harakirimail.com', 'sharklasers.com', 'guerrillamail.net',
    'grr.la', 'guerrillamail.biz', 'guerrillamail.com', 'guerrillamail.de',
    'guerrillamail.org', 'guerrillamailblock.com', 'spam4.me', 'trashmail.io'
];

// Trusted domains whitelist
export const TRUSTED_DOMAINS = [
    'google.com', 'gmail.com', 'apple.com', 'microsoft.com', 'amazon.com',
    'linkedin.com', 'github.com', 'facebook.com', 'twitter.com', 'x.com',
    'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com', 'protonmail.com',
    'hey.com', 'fastmail.com', 'zoho.com', 'slack.com', 'discord.com',
    'stripe.com', 'square.com', 'shopify.com', 'salesforce.com', 'hubspot.com',
    'mailchimp.com', 'convertkit.com', 'sendgrid.com', 'twilio.com',
    'zoom.us', 'webex.com', 'gotomeeting.com',
    'dropbox.com', 'box.com', 'drive.google.com',
    'calendly.com', 'doodle.com', 'when2meet.com'
];

// Trust score thresholds
export const TRUST_THRESHOLDS = {
    SAFE: 70,
    CAUTION: 30
};

// Trust score calculation weights
export const TRUST_WEIGHTS = {
    TRUSTED_DOMAIN: 50,
    DOMAIN_AGE: 30,
    DISPOSABLE_PENALTY: -50,
    INTERACTIONS_5: 20,
    INTERACTIONS_20: 20,
    HAS_NAME: 10,
    HAS_PHONE: 5,
    HAS_COMPANY: 5,
    HAS_SOCIALS: 10,
    AUTH_PASS: 20,
    AUTH_FAIL: -30,
    WHITELIST_OVERRIDE: 100,
    BLACKLIST_OVERRIDE: -100
};

// Storage keys
export const STORAGE_KEYS = {
    CONTACTS: 'contacts',
    EMAIL_HISTORY: 'email_history',
    BLACKLIST: 'blacklist',
    WHITELIST: 'whitelist',
    SETTINGS: 'settings',
    GMAIL_TOKEN: 'gmail_access_token'
};

// Default settings
export const DEFAULT_SETTINGS = {
    autoScan: true,
    showHalos: true,
    scanOnOpen: true,
    notifyOnDanger: true,
    maxHistoryEntries: 50,
    dataRetentionDays: 365
};

// Social media platforms
export const SOCIAL_PLATFORMS = {
    LINKEDIN: {
        name: 'LinkedIn',
        icon: '💼',
        pattern: /linkedin\.com\/in\/[\w-]+/i,
        baseUrl: 'https://linkedin.com/in/'
    },
    TWITTER: {
        name: 'Twitter',
        icon: '🐦',
        pattern: /twitter\.com\/[\w_]+/i,
        baseUrl: 'https://twitter.com/'
    },
    GITHUB: {
        name: 'GitHub',
        icon: '💻',
        pattern: /github\.com\/[\w-]+/i,
        baseUrl: 'https://github.com/'
    },
    FACEBOOK: {
        name: 'Facebook',
        icon: '📘',
        pattern: /facebook\.com\/[\w.]+/i,
        baseUrl: 'https://facebook.com/'
    },
    INSTAGRAM: {
        name: 'Instagram',
        icon: '📷',
        pattern: /instagram\.com\/[\w.]+/i,
        baseUrl: 'https://instagram.com/'
    }
};

// Contact tags
export const DEFAULT_TAGS = [
    'Client',
    'Vendor',
    'Partner',
    'Prospect',
    'Personal',
    'Internal',
    'Important',
    'Newsletter'
];

// Gmail API endpoints
export const GMAIL_API = {
    BASE_URL: 'https://gmail.googleapis.com/gmail/v1',
    SCOPES: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/contacts.readonly'
    ]
};

// UI Colors
export const COLORS = {
    SAFE: '#22c55e',
    CAUTION: '#f59e0b',
    DANGER: '#ef4444',
    PRIMARY: '#667eea',
    SECONDARY: '#764ba2'
};

// Regex patterns
export const PATTERNS = {
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    PHONE: /(\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/g,
    URL: /(https?:\/\/[^\s]+)/g,
    ADDRESS: /(\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|plaza|plz|suite|ste)\s*,?\s*[\w\s]+,\s*[a-zA-Z]{2}\s*\d{5})/gi
};
