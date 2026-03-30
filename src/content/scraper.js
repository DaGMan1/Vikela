/**
 * Vikela Content Script — Gmail Sender Detection via InboxSDK
 * Uses InboxSDK for reliable, DOM-hack-free sender detection.
 * InboxSDK is maintained by Streak and handles Gmail's constantly changing DOM.
 */

import * as InboxSDK from '@inboxsdk/core';

const APP_ID = 'sdk_Vikela_be8aaebf94';

InboxSDK.load(2, APP_ID).then((sdk) => {
  console.log('Vikela: InboxSDK loaded');

  // Fires every time a message is opened/expanded
  sdk.Conversations.registerMessageViewHandler((messageView) => {
    const sender = messageView.getSender();
    if (!sender || !sender.emailAddress) return;

    const email = sender.emailAddress.toLowerCase().trim();
    const name = sender.name || '';

    console.log('Vikela: Sender —', name, '<' + email + '>');

    // Send to background service worker
    chrome.runtime.sendMessage({
      type: 'SENDER_FOUND',
      data: { email, name }
    }).catch(() => {
      console.log('Vikela: Background not ready');
    });
  });

}).catch((err) => {
  console.error('Vikela: InboxSDK failed to load', err);
});
