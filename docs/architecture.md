# Sentry Chrome Extension - Architecture

## Overview
Sentry is a real-time email guardian that validates sender authenticity, auto-builds rich contact profiles, and protects against fraud/scams with visual safety indicators.

## Core Features

### 1. Visual Safety System
- Traffic light halo effect behind sender names in Gmail
  - 🟢 Green (70-100): High trust, verified domains, established history
  - 🟡 Amber (30-69): Caution, common domains, limited history  
  - 🔴 Red (0-29): Unverified, disposable domains, suspicious patterns
- Side panel "Concierge" with detailed profile and security analysis

### 2. Email Validation
- Disposable email detection (mailinator, yopmail, temp-mail, etc.)
- Domain age verification
- SPF/DKIM/DMARC authentication checks
- Domain whitelist: google.com, gmail.com, apple.com, microsoft.com, amazon.com, linkedin.com

### 3. Contact Profile Auto-Building
- Extract from email metadata: phone, address, company, title
- Extract from email signatures: social media URLs
- Store: interaction history, trust score, first/last seen dates
- IndexedDB for scalable storage

### 4. OSINT Discovery
- Email-based web search to discover social profiles
- LinkedIn, Twitter, GitHub discovery via email lookup
- Domain reputation analysis

### 5. User Actions
- Block sender (blacklist)
- Whitelist sender (boosts trust score)
- Add notes to contacts
- Tag contacts (Client, Vendor, Personal, etc.)

### 6. Google Contacts Integration
- Two-way sync with Google Contacts
- Import existing contacts to seed database
- Export Sentry contacts to Google

## Technical Stack

### Storage: IndexedDB
- Scales beyond Chrome's 5MB localStorage limit
- Supports complex queries and indexing
- Stores: Contacts, email history, interaction logs, blacklists/whitelists

### Gmail Access: OAuth 2.0
- Content scripts: Real-time UI updates (halo effects, side panel)
- Gmail API via OAuth: Background full inbox scanning
- OAuth scope: `https://www.googleapis.com/auth/gmail.readonly`

### Architecture Pattern
- **Background Script**: Service worker for Gmail API calls, data processing
- **Content Script**: DOM manipulation, halo injection, real-time UI
- **Side Panel**: Rich contact view and security analysis
- **Dashboard**: Full-page CRM interface (Phase 2)

## Trust Score Algorithm (v1)

```
Base Score: 0

Domain Verification:
+50 if domain in whitelist
+30 if domain age > 1 year
-50 if disposable domain (instant RED)

Interaction History:
+20 if 5+ interactions
+20 if 20+ interactions
+10 if contact has name extracted

Authentication:
+20 if SPF/DKIM/DMARC pass
-30 if any fail

User Actions:
+100 if manually whitelisted
-100 if manually blacklisted

Max Score: 100
Min Score: 0
```

## Data Flow

1. **Email Detected** → Content Script extracts sender
2. **Background Check** → IdentityManager validates and scores
3. **Visual Feedback** → Halo effect applied to sender name
4. **Side Panel Update** → Detailed profile displayed
5. **Metadata Extraction** → Phone, address, company parsed from email
6. **OSINT Discovery** → Social profiles discovered via search
7. **Storage** → All data persisted to IndexedDB

## Security & Privacy

- All data stored locally in IndexedDB
- No external API calls for core functionality
- OAuth used only for Gmail access
- Clear onboarding explaining data usage
- Proactive scanning with user consent

## Phase Roadmap

### Phase 1: Foundation (Current)
- IndexedDB storage layer
- Visual halo system
- Trust scoring
- Basic contact extraction
- OAuth Gmail integration

### Phase 2: Intelligence
- OSINT social discovery
- Google Contacts sync
- Dashboard CRM
- Advanced fraud detection

### Phase 3: Advanced
- Multi-provider support (Outlook, Apple)
- Machine learning for fraud patterns
- Team/collaborative features
- API integrations (optional)
