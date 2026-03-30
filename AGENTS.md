# Sentry - Agent Documentation

## Project Overview
Chrome extension for email security and contact management. Validates sender authenticity, detects fraud, manages contacts intelligently.

## Architecture

### Tech Stack
- Chrome Extension Manifest V3
- JavaScript (ES6+ modules)
- IndexedDB for storage
- OAuth 2.0 for Gmail API
- Gmail API for email scanning

### Key Components

#### Background Script (`src/background/`)
- `index.js` - Service worker, message routing, orchestration
- `identity_manager.js` - Contact CRUD, trust scoring
- `gmail_auth.js` - OAuth 2.0 authentication

#### Content Script (`src/content/`)
- `index.js` - Entry point
- `scraper.js` - Email extraction from Gmail DOM
- `visual_indicator.js` - Halo effect injection
- `halo.css` - Visual styles for indicators

#### Side Panel (`src/sidebar/`)
- `index.html` - UI markup
- `index.js` - Panel logic and interactions

#### Dashboard (`src/dashboard/`)
- `index.html` - Full-page CRM interface

#### Shared (`src/shared/`)
- `storage.js` - IndexedDB wrapper
- `constants.js` - Config, patterns, constants

#### Onboarding (`src/onboarding/`)
- `index.html` - First-time user setup

## Trust Score Algorithm
```javascript
Base: 0
+50 Trusted domain
+30 Domain age > 1 year  
-50 Disposable domain (instant 0)
+20 5+ interactions
+20 20+ interactions
+10 Has name
+5 Has phone
+5 Has company
+10 Has social profiles
±100 User whitelist/blacklist override
Max: 100, Min: 0
```

## Data Flow
1. Email detected in Gmail → Content Script extracts sender
2. Background validates → IdentityManager scores
3. Visual halo applied → Content Script updates DOM
4. Side panel notified → Shows detailed profile
5. Metadata extracted → Contact enriched
6. All data → IndexedDB storage

## Storage Schema

### Contacts Store
- Key: email (normalized)
- Fields: name, phone, company, title, address, socials, trustScore, safetyStatus, interactionCount, history, notes, tags, timestamps

### Email History Store
- Key: auto-increment
- Fields: email, timestamp, messageId, subject, snippet, hasAttachments

### Blacklist/Whitelist Stores
- Key: email
- Fields: email, reason, timestamp

## Message Types (chrome.runtime.sendMessage)

### From Content Script
- `SENDER_FOUND` - New sender detected
- `GET_SENDER_STATUS` - Request status for email

### From Side Panel
- `GET_CURRENT_SENDER` - Get cached sender for current tab
- `BLACKLIST_SENDER` - Add to blacklist
- `WHITELIST_SENDER` - Add to whitelist
- `ADD_NOTE` - Add note to contact
- `ADD_TAG` - Add tag to contact
- `SEARCH_CONTACTS` - Search contacts
- `GET_ALL_CONTACTS` - Get all contacts
- `GET_STATS` - Get statistics
- `AUTHENTICATE_GMAIL` - Trigger OAuth
- `CHECK_GMAIL_AUTH` - Check auth status
- `SCAN_GMAIL_MESSAGES` - Scan Gmail messages

### From Background
- `PROFILE_UPDATED` - Contact data updated
- `CONTACT_UPDATED` - Contact modified
- `SENDER_SELECTED` - Sender clicked

## Visual States

### Halo Colors
- **Green (#22c55e)**: Trust score >= 70
- **Amber (#f59e0b)**: Trust score 30-69
- **Red (#ef4444)**: Trust score < 30

### CSS Classes
- `.sentry-halo` - Base halo class
- `.sentry-safe` - Green state
- `.sentry-caution` - Amber state
- `.sentry-danger` - Red state

## OAuth Scopes
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/contacts.readonly
```

## Setup Requirements

1. Google Cloud Project with Gmail API enabled
2. OAuth 2.0 Client ID for Chrome Extension
3. Update manifest.json with Client ID
4. Extension ID from chrome://extensions/

## Testing Commands
- Load unpacked: chrome://extensions/ → Developer mode → Load unpacked
- Inspect background: Service worker link on extension card
- Inspect content script: F12 on Gmail tab → Console
- Inspect side panel: Right-click → Inspect

## Build
```bash
./build.sh
```
Creates `sentry-extension.zip` for distribution.

## File Structure
```
src/
├── background/
│   ├── index.js
│   ├── identity_manager.js
│   └── gmail_auth.js
├── content/
│   ├── index.js
│   ├── scraper.js
│   ├── visual_indicator.js
│   └── halo.css
├── sidebar/
│   ├── index.html
│   └── index.js
├── dashboard/
│   └── index.html
├── onboarding/
│   └── index.html
├── shared/
│   ├── storage.js
│   └── constants.js
└── assets/
    └── icon.png
```

## Known Limitations
- Gmail API requires OAuth consent screen
- Disposable domain list is hardcoded (update periodically)
- Social discovery limited to email signatures initially
- No server-side component (all local)

## Phase 2 Features
- OSINT web search for social profiles
- Google Contacts two-way sync
- Full dashboard with analytics
- Advanced fraud pattern detection

## Security Notes
- All data stored locally
- OAuth tokens in chrome.storage.local
- No external API calls by default
- User controls all data export/delete
