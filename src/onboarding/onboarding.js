document.getElementById('open-gmail-btn').addEventListener('click', () => {
  chrome.tabs.query({ url: 'https://mail.google.com/*' }, (tabs) => {
    if (tabs && tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, { active: true });
      chrome.windows.update(tabs[0].windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: 'https://mail.google.com' });
    }
    window.close();
  });
});
