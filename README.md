# Vikela

> Email intelligence and sender profiling for Gmail  
> *Vikela — Zulu for "warrior protector"*

A Chrome extension that sits inside Gmail and tells you everything about who's emailing you — instantly, privately, and free.

---

## What It Does

When you open an email in Gmail, Vikela shows you a sidebar with:

- **Profile** — name, company, title, phone, social profiles, notes, tags
- **History** — every email this person has ever sent you, grouped by month
- **Intel** — domain age, SPF/DKIM/DMARC, MX provider, disposable check, reputation

A colour-coded trust badge tells you at a glance: ✓ Known / ⚠ Caution / ✕ Suspicious.

---

## Architecture

```
src/
├── background/
│   └── index.js          ← Service worker (bundled via esbuild → build/background.bundle.js)
│       ├── StorageManager     IndexedDB wrapper (contacts, history, OSINT cache, whitelist/blacklist)
│       ├── OsintEngine        Free DNS checks: RDAP domain age, SPF/DKIM/DMARC via Cloudflare DoH, MX provider
│       ├── ContactsLookup     Google People API — enriches profiles from Google Contacts
│       ├── IdentityManager    Contact lifecycle, trust scoring, notes, tags
│       └── GmailAuthManager   Gmail API auth + email history fetching
├── content/
│   ├── scraper.js        ← Extracts sender email from Gmail DOM, fires SENDER_FOUND
│   ├── halo.css          ← Trust indicator halo injected around sender avatar
│   └── visual_indicator.js
├── sidebar/
│   ├── index.html        ← 3-tab sidebar UI (Profile | History | Intel)
│   └── index.js          ← Tab controller, message bus, all UI interactions
├── shared/
│   ├── constants.js
│   └── storage.js
├── dashboard/index.html
└── onboarding/index.html
build/
└── background.bundle.js  ← esbuild output (~34kb)
```

---

## Message Bus

| Direction | Message | Payload |
|-----------|---------|---------|
| Content → Background | `SENDER_FOUND` | `{ email, name }` |
| Sidebar → Background | `GET_CURRENT_SENDER` | — |
| Sidebar → Background | `GET_EMAIL_HISTORY` | `{ email }` |
| Sidebar → Background | `TRIGGER_OSINT` | `{ email }` |
| Sidebar → Background | `WHITELIST_SENDER` | `{ email }` |
| Sidebar → Background | `BLACKLIST_SENDER` | `{ email }` |
| Sidebar → Background | `ADD_NOTE` | `{ email, note }` |
| Sidebar → Background | `ADD_TAG` | `{ email, tag }` |
| Background → Sidebar | `PROFILE_UPDATED` | contact object |
| Background → Sidebar | `SENDER_SELECTED` | contact object |
| Background → Sidebar | `CONTACT_UPDATED` | `{ email }` |

---

## Trust Scoring

Score 0–100 calculated from:
- Whitelist/blacklist (overrides all)
- Known trusted domain (+30)
- Disposable domain (→ 0)
- SPF pass (+10), DKIM pass (+10), DMARC pass (+10)
- Domain reputation clean (+10) / suspicious (−20) / blacklisted (→ 0)
- Domain age < 30 days (−15)
- In Google Contacts (+15)
- Interaction count > 5 (+10), > 20 (+10)
- Data breaches (−10 per breach)

| Score | Status | Badge |
|-------|--------|-------|
| 65–100 | safe | ✓ Known |
| 35–64 | caution | ⚠ Caution |
| 0–34 | danger | ✕ Suspicious |

---

## OSINT Engine (free APIs only)

| Check | API | Cost |
|-------|-----|------|
| Domain age | rdap.org | Free |
| SPF / DKIM / DMARC | cloudflare-dns.com/dns-query | Free |
| MX provider | Cloudflare DoH | Free |
| Disposable email | Local list | Free |
| Google Contacts match | Google People API | Free (OAuth) |

Results cached in IndexedDB for 7 days.

---

## Setup

### Prerequisites
- Node.js (via nvm)
- Chrome / Chromium

### Build
```bash
npm install
npm run build        # one-shot
npm run watch        # watch mode
```

### Load in Chrome
1. `chrome://extensions` → Enable Developer mode
2. Load unpacked → select this folder
3. Open Gmail → click Vikela icon

### Google OAuth (required for Gmail history + Contacts)
1. Create project in Google Cloud Console
2. Enable: Gmail API, Google People API
3. Create OAuth 2.0 Client ID (Chrome Extension)
4. Add extension ID to authorised origins
5. Paste client ID into `manifest.json` → `oauth2.client_id`

---

## GitHub

Repo: `DaGMan1/Vikela` (formerly DaGMan1/Sentry)  
SSH config: `github.com-vikela` host alias on Mac 2  
Deploy key: TBD (set up when GitHub repo renamed)

---

## Status

| Component | Status |
|-----------|--------|
| Build system (esbuild) | ✅ Working |
| Manifest v3 | ✅ Updated |
| Sidebar HTML (3 tabs) | ✅ Deployed |
| Sidebar controller | ✅ Written (845 lines) |
| Background service worker | ✅ Rebuilt (941 lines) |
| StorageManager (IndexedDB) | ✅ Working |
| Gmail email history | ✅ Wired up |
| OSINT engine | ✅ Working (free APIs) |
| Google Contacts lookup | ✅ Wired up |
| Trust scoring | ✅ Rebuilt |
| Google OAuth Client ID | ⏳ Needs setup |
| GitHub repo rename | ⏳ Garry doing today |
| Domain (vikela.com.au) | ⏳ Garry buying today |
| Icon / logo | ⏳ Green tick — Garry to locate |

