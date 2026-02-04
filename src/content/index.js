// Content script for Gmail DOM scraping
console.log('Sentry content script loaded');

if (window.ScraperBot) {
    new window.ScraperBot();
} else {
    console.error('ScraperBot class not found. Make sure scraper.js is loaded before index.js');
}
