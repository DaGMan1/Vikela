# Century — Architecture Plan
**Prepared by:** Cogsworth
**Date:** 2026-03-24
**Status:** Approved by Garry — build from this

---

## The One-Line Pitch
Xobni meets security — your email concierge that also protects you from fraud.

## Core Mission
Protect non-technical email users from phishing with zero friction. Works inside whatever email client they already use. No separate app, no learning curve.

## What Makes It Different
- **Not standalone** — integrates directly into Gmail, Outlook, Apple Mail
- **Connects to contacts you already have** — Google, Microsoft, Apple, Android
- **Zero friction** — open email, see profile + security status instantly
- **Low tech barrier** — works for your mum, not just developers

---

## The Three Layers

### Layer 1 — Security (The New Bit)
Runs first, instantly, on every email:
- **Domain mismatch detection** — "From: PayPal" but sent from ocels-world.com → RED
- **IP address origin check** — does the sending server match the claimed company?
- **SPF/DKIM/DMARC validation** — did this genuinely come from their mail server?
- **Domain age check** — paypal-secure-login.com registered 3 days ago → RED
- **Disposable email detection** — temp-mail.org, guerrillamail etc → instant flag

### Layer 2 — Concierge (The Xobni Part)
The sidebar profile panel:
- **Identity:** photo, name, company, title, phone number
- **Social profiles:** LinkedIn, Twitter/X, GitHub — auto-discovered
- **Email history:** total count, first contact, last contact, response patterns
- **Attachment history:** every file they've ever sent you, clickable to open or locate
- **Notes:** add your own notes about this contact
- **Trust score:** visual indicator (green/amber/red) based on all signals

### Layer 3 — CRM Integration (Future)
- Sync to Google Contacts, Microsoft Contacts, Apple Contacts, Android
- Eventually connects to Century's own CRM module
- Two-way sync — update in Century, updates everywhere

---

## Attachment History Feature (Key Differentiator)
When you open any email, the sidebar shows:
- Every attachment this person has ever sent you
- File name, date sent, file type
- One click: opens the file, or takes you to where it's saved
- Works across email threads — aggregated by sender

This was Xobni's most loved feature. We bring it back, improved, for Gmail/Outlook.

---

## Competitor: Guardia
- Standalone app (high friction — separate login, separate interface)
- Doesn't connect to your existing contacts
- Security focused but no concierge layer
- **Our advantage:** integrated, zero friction, contact history + security combined

---

## Rollout Order
1. **Gmail Chrome Extension** (Phase 1 — biggest market, easiest to ship)
2. **Outlook Add-in** (Phase 2)
3. **Apple Mail Plugin** (Phase 3)
4. **Mobile — Android/iOS** (Phase 4)

---

## Revenue Model
- **Free:** Basic security layer (domain check, SPF/DKIM, disposable detection)
- **Paid (/month):** Full concierge — contact profiles, attachment history, social discovery, CRM sync
- **Team/Business:** Multi-user, shared contact intelligence, admin dashboard

---

## Technical Architecture

### Chrome Extension Components
- **Content Script:** Injected into Gmail — detects email opens, extracts sender
- **Background Service Worker:** Does security checks, manages local database
- **Side Panel:** The profile + security display
- **Popup:** Quick settings and summary

### Data Storage
- **Local first (IndexedDB):** Contact history, attachment index, trust scores — stays on device
- **Optional cloud sync:** For cross-device access (paid tier)

### Security Checks (No External API Needed for Core)
- SPF/DKIM/DMARC: Read from email headers (already in the email)
- Domain age: Whois lookup (free public APIs)
- IP verification: Reverse DNS lookup (free)
- Disposable detection: Local blocklist + public API fallback

### Contact Data Sources
- Email signature parsing (name, phone, title, company, social links)
- Google Contacts API (with OAuth — already have for Garry's account)
- Clearbit free tier (company info from domain)
- Hunter.io free tier (email verification)

---

## What's Already Built (Current State)
✅ Chrome extension structure
✅ Gmail content script (email detection)
✅ IndexedDB storage
✅ Basic trust scoring algorithm
✅ Sidebar UI (dark theme, professional)
✅ Visual halo system (green only — needs fixing)

## What Needs Building
❌ Fix halo — red/amber/green based on actual trust score
❌ Fix sidebar data population
❌ Domain mismatch detection (the PayPal example)
❌ SPF/DKIM header parsing
❌ Domain age lookup
❌ Attachment history indexing and display
❌ Social profile discovery
❌ Google Contacts sync
❌ Outlook add-in version

---

## Phase 1 Build Plan (Gmail Extension — MVP)
**Goal:** Working, submittable to Chrome Web Store

1. Fix halo colours (1 day)
2. Fix sidebar data flow (1 day)
3. Add domain mismatch + SPF/DKIM check (2 days)
4. Add attachment history (2 days)
5. Polish UX, fix edge cases (1 day)
6. Submit to Chrome Web Store (1 day)

**Total: ~8 days focused dev**

---
*Cogsworth, 2026-03-24*
