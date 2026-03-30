/**
 * Vikela Content Script — Gmail Sender Extractor
 * Uses multiple fallback strategies — Gmail changes its DOM constantly.
 */
(function () {
  'use strict';

  let lastSender = null;
  let lastUrl = location.href;
  let debounceTimer = null;

  // ── Strategy 1: Classic span.gD[email] inside known header containers
  function tryClassicSelector() {
    const containers = document.querySelectorAll('.h7, .ha, .gE.iv.gt, [data-message-id]');
    for (const container of containers) {
      const span = container.querySelector('span[email]');
      if (span) {
        const email = span.getAttribute('email');
        if (email && email.includes('@')) return { email, name: span.textContent.trim() };
      }
    }
    return null;
  }

  // ── Strategy 2: Any span with [email] attr near a "from" label
  function tryEmailAttrNearFrom() {
    // Look for any element with an email attribute on the page
    const spans = document.querySelectorAll('span[email]');
    for (const span of spans) {
      const email = span.getAttribute('email');
      if (!email || !email.includes('@')) continue;
      // Make sure it's not inside a To/CC field
      const row = span.closest('tr, [role="row"], .adn');
      if (row) {
        const rowText = row.textContent.toLowerCase();
        if (rowText.startsWith('to') || rowText.startsWith('cc') || rowText.startsWith('bcc')) continue;
      }
      return { email, name: span.textContent.trim() };
    }
    return null;
  }

  // ── Strategy 3: data-hovercard-id attribute (newer Gmail)
  function tryHovercardId() {
    const els = document.querySelectorAll('[data-hovercard-id]');
    for (const el of els) {
      const val = el.getAttribute('data-hovercard-id');
      if (val && val.includes('@')) {
        // Skip if inside a recipients area
        const parent = el.closest('[data-tooltip]');
        if (parent) {
          const tip = (parent.getAttribute('data-tooltip') || '').toLowerCase();
          if (tip.includes('to ') || tip.includes('cc ')) continue;
        }
        return { email: val, name: el.textContent.trim() };
      }
    }
    return null;
  }

  // ── Strategy 4: Look for mailto: links in the email header area
  function tryMailtoLinks() {
    // Gmail sometimes renders the from address as a mailto link
    const links = document.querySelectorAll('a[href^="mailto:"]');
    for (const link of links) {
      const href = link.getAttribute('href');
      const email = href.replace('mailto:', '').split('?')[0].trim();
      if (!email || !email.includes('@')) continue;
      // Make sure we're in an email view, not compose
      if (link.closest('[role="dialog"]')) continue;
      return { email, name: link.textContent.trim() };
    }
    return null;
  }

  // ── Strategy 5: Parse from the page title / URL
  // Gmail URL when reading an email: /mail/u/0/#inbox/messageId
  function tryUrlStrategy() {
    // Can't get email from URL alone, but we can confirm we're in an email view
    return null;
  }

  // ── Run all strategies in order
  function extractSender() {
    // Only run if we look like we're viewing an email (not inbox list)
    const inEmailView = !!(
      document.querySelector('.h7, .ha, [data-message-id], .adn.ads') ||
      document.querySelector('[role="main"] [data-legacy-message-id]')
    );
    if (!inEmailView) return;

    const result =
      tryClassicSelector() ||
      tryEmailAttrNearFrom() ||
      tryHovercardId() ||
      tryMailtoLinks();

    if (!result) return;

    const { email, name } = result;

    // Deduplicate
    if (lastSender === email) return;
    lastSender = email;

    console.log('Vikela: Sender detected —', name, '<' + email + '>');

    chrome.runtime.sendMessage({
      type: 'SENDER_FOUND',
      data: { email, name }
    }).catch(() => {
      console.log('Vikela: Background not ready yet');
    });

    // Apply halo
    applyHalo(email);
  }

  function applyHalo(email) {
    if (!document.getElementById('vikela-styles')) {
      const style = document.createElement('style');
      style.id = 'vikela-styles';
      style.textContent = `
        .vikela-halo-safe    { outline: 2px solid #22c55e !important; border-radius: 4px; }
        .vikela-halo-caution { outline: 2px solid #f59e0b !important; border-radius: 4px; }
        .vikela-halo-danger  { outline: 2px solid #ef4444 !important; border-radius: 4px; }
      `;
      document.head.appendChild(style);
    }
  }

  // ── Debounced extractor (MutationObserver fires constantly)
  function scheduleExtract() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(extractSender, 300);
  }

  // ── Watch for URL changes (Gmail is a SPA)
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      lastSender = null;
      setTimeout(extractSender, 800);
    }
  }, 500);

  // ── Watch for DOM changes
  const observer = new MutationObserver(scheduleExtract);
  observer.observe(document.body, { childList: true, subtree: true });

  // ── Initial attempts with backoff (Gmail loads slowly)
  setTimeout(extractSender, 800);
  setTimeout(extractSender, 1500);
  setTimeout(extractSender, 3000);

  console.log('Vikela: Content script loaded');
})();
