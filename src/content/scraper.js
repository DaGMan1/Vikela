/**
 * Simplified ScraperBot
 * Extracts sender email from Gmail
 */

(function() {
    'use strict';
    
    console.log('Vikela: Starting...');
    
    let lastSender = null;
    let lastUrl = location.href;
    
    // Main function to extract sender
    function extractSender() {
        // Only run in email view (has .h7 header)
        const header = document.querySelector('.h7');
        if (!header) {
            console.log('Vikela: No email header');
            return;
        }
        
        // Find sender span with email attribute
        const senderSpan = header.querySelector('span.gD[email]');
        if (!senderSpan) {
            console.log('Vikela: No sender span found');
            return;
        }
        
        const email = senderSpan.getAttribute('email');
        const name = senderSpan.textContent?.trim();
        
        if (!email || !email.includes('@')) {
            console.log('Vikela: Invalid email');
            return;
        }
        
        // Don't process same sender twice
        if (lastSender === email) {
            return;
        }
        
        // Don't process if this looks like a "to" field
        const parent = senderSpan.closest('.ha, .gF, [role="listitem"]');
        if (parent) {
            const text = parent.textContent?.toLowerCase() || '';
            if (text.includes('to:') || text.includes('cc:')) {
                console.log('Vikela: Skipping recipient field');
                return;
            }
        }
        
        lastSender = email;
        console.log('Vikela: FOUND SENDER:', name, '<' + email + '>');
        
        // Send to background
        chrome.runtime.sendMessage({
            type: 'SENDER_FOUND',
            data: { email, name }
        }).catch(err => {
            console.log('Vikela: Background not ready');
        });
        
        // Apply visual indicator
        applyVisualIndicator(senderSpan, email);
    }
    
    // Apply halo effect
    function applyVisualIndicator(element, email) {
        // Check if styles exist
        if (!document.getElementById('vikela-styles')) {
            const style = document.createElement('style');
            style.id = 'vikela-styles';
            style.textContent = `
                .vikela-halo {
                    background: rgba(34, 197, 94, 0.2) !important;
                    border: 2px solid #22c55e !important;
                    border-radius: 6px !important;
                    padding: 2px 6px !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Get status from background
        chrome.runtime.sendMessage({
            type: 'GET_SENDER_STATUS',
            data: { email }
        }).then(response => {
            if (response && response.status) {
                element.classList.add('vikela-halo');
                element.setAttribute('title', `Trust: ${response.contactData?.trustScore || 0}%`);
            }
        }).catch(() => {});
    }
    
    // Check on URL change
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            lastSender = null;
            setTimeout(extractSender, 1000);
        }
    }, 1000);
    
    // Check on DOM changes
    const observer = new MutationObserver(() => {
        extractSender();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial check
    setTimeout(extractSender, 1500);
    
})();
