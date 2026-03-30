# Vikela — Product Hub
**Name:** Vikela
**Meaning:** Zulu — to protect/guard
**Pronunciation:** vi-KEH-la
**Logo:** ✓ (checkmark = V shape = shield point = verified)
**Status:** Architecture complete, renaming from Sentry, ready to build

---

## The One-Line Pitch
Your email concierge that protects you — knows who sent it, proves it's real.

## Inspired By
Xobni (inbox backwards) — the email sidebar that showed you everything about who emailed you. Vikela is Xobni + security layer, rebuilt for Gmail/Outlook in 2026.

## Logo & Brand System
- **Mark:** ✓ checkmark in rounded square
- **Monogram:** V (same shape as checkmark)
- **Green ✓** — sender verified, safe
- **Amber ⚠** — proceed with caution
- **Red ✗** — suspicious, likely fraud
- Background changes colour to indicate status
- Works as favicon, app icon, extension icon, monogram

## What It Does

### Layer 1 — Security
- Domain mismatch: "From: PayPal" but sent from ocels-world.com → RED instantly
- SPF/DKIM/DMARC validation from email headers
- Domain age check (new domain = red flag)
- IP address origin verification
- Disposable email detection

### Layer 2 — Concierge
- Full sender profile: name, photo, company, title, phone
- Social profiles auto-discovered (LinkedIn, Twitter, GitHub)
- Email history: count, first contact, last contact
- Attachment history: every file they've ever sent, clickable
- Notes per contact
- Trust score with visual indicator

### Layer 3 — CRM Integration (Future)
- Sync to Google Contacts, Microsoft Contacts, Apple, Android
- Connect to Vikela's own CRM module when built

## Rollout
1. Gmail Chrome Extension (Phase 1)
2. Outlook Add-in
3. Apple Mail
4. Mobile

## Revenue
- Free: security layer (domain check, SPF/DKIM, disposable)
- Paid (/month): full concierge + attachment history + social discovery + CRM sync
- Business: multi-user, shared contact intelligence

## Domains to Register
- vikela.io ✅ available — PRIMARY
- vikela.app ✅ available — secondary
- vikela.com ❌ taken (MarkMonitor/large brand)
- vikela.com.au — check availability

## Code Location
Mac 2: ~/Documents/App Dev/Vikela/
Previously: ~/Documents/App Dev/Sentry/

## Silo
- New Google account needed: vikela@gmail.com or hello@vikela.io
- Own GitHub account
- Own Cloudflare zone

## Build Status
✅ Chrome extension structure
✅ Gmail content script
✅ IndexedDB storage
✅ Trust scoring algorithm
✅ Sidebar UI (dark theme)
✅ Visual halo system (green only — fix needed)
❌ Fix halo red/amber colours
❌ Fix sidebar data population
❌ Domain mismatch detection
❌ Attachment history
❌ Social profile discovery
❌ Google Contacts sync

## Phase 1 Build Plan (~8 days)
1. Fix halo colours (1 day)
2. Fix sidebar data flow (1 day)
3. Domain mismatch + SPF/DKIM (2 days)
4. Attachment history (2 days)
5. Polish + edge cases (1 day)
6. Chrome Web Store submission (1 day)

---
*Cogsworth, 2026-03-24*
