/**
 * Gmail OAuth Manager
 * Handles OAuth 2.0 authentication with Google for Gmail API access
 */

class GmailAuthManager {
    constructor() {
        this.accessToken = null;
        this.isAuthenticated = false;
    }

    async init() {
        // Check if we already have a token
        try {
            const token = await this.getStoredToken();
            if (token) {
                this.accessToken = token;
                this.isAuthenticated = true;
                console.log('GmailAuthManager: Already authenticated');
                return true;
            }
        } catch (error) {
            console.log('GmailAuthManager: No stored token');
        }
        return false;
    }

    async authenticate() {
        return new Promise((resolve, reject) => {
            const clientId = chrome.runtime.getManifest().oauth2.client_id;
            const scopes = chrome.runtime.getManifest().oauth2.scopes;

            if (clientId === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
                reject(new Error('Please update manifest.json with your Google OAuth Client ID'));
                return;
            }

            chrome.identity.getAuthToken({ 
                interactive: true,
                scopes: scopes
            }, (token) => {
                if (chrome.runtime.lastError) {
                    console.error('GmailAuthManager: Auth error', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                    return;
                }

                this.accessToken = token;
                this.isAuthenticated = true;
                
                // Store token
                chrome.storage.local.set({ 'gmail_access_token': token }, () => {
                    console.log('GmailAuthManager: Authentication successful');
                    resolve(token);
                });
            });
        });
    }

    async getStoredToken() {
        return new Promise((resolve) => {
            chrome.storage.local.get('gmail_access_token', (result) => {
                resolve(result.gmail_access_token || null);
            });
        });
    }

    async refreshToken() {
        // Remove old token and re-authenticate
        await this.removeToken();
        return this.authenticate();
    }

    async removeToken() {
        return new Promise((resolve) => {
            chrome.identity.removeCachedAuthToken({ token: this.accessToken }, () => {
                chrome.storage.local.remove('gmail_access_token', () => {
                    this.accessToken = null;
                    this.isAuthenticated = false;
                    resolve();
                });
            });
        });
    }

    async revokeAccess() {
        if (!this.accessToken) return;

        try {
            // Revoke on Google's side
            await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${this.accessToken}`);
        } catch (error) {
            console.error('GmailAuthManager: Error revoking token', error);
        }

        // Remove from our storage
        await this.removeToken();
    }

    getAccessToken() {
        return this.accessToken;
    }

    async makeApiRequest(endpoint, options = {}) {
        if (!this.isAuthenticated) {
            await this.authenticate();
        }

        const url = `https://gmail.googleapis.com/gmail/v1${endpoint}`;
        
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (response.status === 401) {
                // Token expired, refresh and retry
                await this.refreshToken();
                return this.makeApiRequest(endpoint, options);
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Gmail API error');
            }

            return response.json();
        } catch (error) {
            console.error('GmailAuthManager: API request failed', error);
            throw error;
        }
    }

    // Gmail API Methods
    async getProfile() {
        return this.makeApiRequest('/users/me/profile');
    }

    async listMessages(query = '', maxResults = 100) {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (maxResults) params.append('maxResults', maxResults.toString());

        return this.makeApiRequest(`/users/me/messages?${params.toString()}`);
    }

    async getMessage(messageId, format = 'metadata') {
        const params = new URLSearchParams();
        params.append('format', format);
        
        return this.makeApiRequest(`/users/me/messages/${messageId}?${params.toString()}`);
    }

    async getMessageFull(messageId) {
        return this.getMessage(messageId, 'full');
    }

    async getHistory(startHistoryId) {
        return this.makeApiRequest(`/users/me/history?startHistoryId=${startHistoryId}`);
    }
}

// Export singleton
const gmailAuthManager = new GmailAuthManager();
export default gmailAuthManager;
