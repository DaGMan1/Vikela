class ScraperBot {
    constructor() {
        this.lastUrl = location.href;
        this.observer = null;
        this.init();
    }

    init() {
        console.log('Scraper-Bot: Initializing...');

        // Listen for URL changes (SPA navigation)
        this.observeUrlChange();

        // Initial check in case we loaded directly into an email
        this.checkForEmail();

        // Observe DOM for dynamic content loading
        this.observeDOM();
    }

    observeUrlChange() {
        // Gmail uses hash changes or pushState.
        // A simple interval check is robust for Gmail's complex history management.
        setInterval(() => {
            const currentUrl = location.href;
            if (currentUrl !== this.lastUrl) {
                this.lastUrl = currentUrl;
                console.log('Scraper-Bot: URL changed to', currentUrl);
                this.checkForEmail();
            }
        }, 1000);
    }

    observeDOM() {
        const targetNode = document.body;
        const config = { childList: true, subtree: true };

        const callback = (mutationsList, observer) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    // We could check for specific nodes here, but robust email detection usually
                    // relies on finding the specific containers when they stabilize.
                    // For now, we rely on the periodic check or trigger checkForEmail sparingly.
                    // To avoid spamming, we might just throttle checks or wait for URL changes + a delay.
                    // But let's check if the sender element appeared if we are in an email view.
                    if (this.isEmailView()) {
                        this.extractSenderInfo();
                    }
                }
            }
        };

        this.observer = new MutationObserver(callback);
        this.observer.observe(targetNode, config);
    }

    isEmailView() {
        // Rough check if we are likely in a conversation
        // Gmail URLs for emails usually look like .../#inbox/FMfcgz...
        // But scraping DOM is better.
        // Look for the sender container.
        return document.querySelector('span.gD') !== null;
    }

    checkForEmail() {
        // Give Gmail a moment to render
        setTimeout(() => {
            if (this.isEmailView()) {
                this.extractSenderInfo();
            }
        }, 1500);
    }

    extractSenderInfo() {
        // 'gD' class is often used for the sender's email span
        const senderElement = document.querySelector('span.gD');
        if (senderElement) {
            const email = senderElement.getAttribute('email');
            const name = senderElement.textContent;

            if (email) {
                console.log('--------------------------------------------------');
                console.log('Scraper-Bot: Sender Identified');
                console.log(`Name: ${name}`);
                console.log(`Email: ${email}`);
                console.log('--------------------------------------------------');

                // TODO: Send to sidebar or background script
            }
        }
    }
}

// Attach to window so index.js can use it
window.ScraperBot = ScraperBot;
