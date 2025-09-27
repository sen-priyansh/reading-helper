// background.js
// This is the service worker for the Chrome extension.

console.log('[Background] Service worker started.');

// Store the last selected text. This will be updated by content.js
// whenever text is selected on a page.
let lastSelectedText = '';
// New variable to store the most recently fetched meaning.
let currentMeaning = '';

// Storage for highlights across all pages
let highlightsStorage = {};

// Create a context menu item that appears when text is selected.
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "getMeaning",
        title: "Get Meaning with Reading Helper",
        contexts: ["selection"] // Show this menu item when text is selected
    });
    console.log('[Background] Context menu item "Get Meaning with Reading Helper" created on installation.');
});

// Listener for messages from content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Message received from:', sender.tab ? `content script (${sender.tab.url})` : 'unknown sender', 'Request:', request);

    if (request.action === "selection") {
        // Update the last selected text from the content script.
        lastSelectedText = request.text;
        // Clear previous meaning if the selection changes to ensure a fresh fetch for new text.
        currentMeaning = '';
        console.log(`[Background] Stored new selected text from content script: "${lastSelectedText.substring(0, 50)}..."`);
    } else if (request.action === "openTab") {
        // Open new tab for web search
        chrome.tabs.create({ url: request.url });
    } else if (request.action === "getMeaningDirect") {
        // Direct meaning request from hover card
        if (!request.text || !request.text.trim()) return;
        if (sender.tab && sender.tab.id) {
            fetchMeaning(request.text)
                .then(meaning => {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        action: "displayMeaning",
                        selectedText: request.text,
                        meaning: meaning
                    });
                })
                .catch(error => {
                    chrome.tabs.sendMessage(sender.tab.id, {
                        action: "displayMeaning",
                        selectedText: request.text,
                        meaning: `Error: ${error.message}`,
                        isError: true
                    });
                });
        } else {
            console.warn('[Background] getMeaningDirect without sender.tab');
        }
    } else if (request.action === "saveHighlights") {
        // Save highlights for a specific URL
        highlightsStorage[request.url] = request.highlights;
        // Also save to chrome.storage for persistence using full and base URL keys
        try {
            const u = new URL(request.url);
            const base = `${u.origin}${u.pathname}`;
            const payload = {
                [`highlights_${request.url}`]: request.highlights,
                [`highlights_${base}`]: request.highlights
            };
            chrome.storage.local.set(payload);
        } catch {
            chrome.storage.local.set({ [`highlights_${request.url}`]: request.highlights });
        }
    } else if (request.action === "getHighlights") {
        // Get highlights for a specific URL
        const highlights = highlightsStorage[request.url] || [];
        if (sender.tab) {
            chrome.tabs.sendMessage(sender.tab.id, {
                action: "highlightsLoaded",
                highlights: highlights
            });
        }
        // Also try to load from chrome.storage
        const exactKey = `highlights_${request.url}`;
        let baseKey = null;
        try {
            const u = new URL(request.url);
            baseKey = `highlights_${u.origin}${u.pathname}`;
        } catch {}

        chrome.storage.local.get(baseKey ? [exactKey, baseKey] : [exactKey]).then(result => {
            const storedHighlights = result[exactKey] || (baseKey ? result[baseKey] : []) || [];
            if (storedHighlights.length > 0 && sender.tab) {
                highlightsStorage[request.url] = storedHighlights;
                chrome.tabs.sendMessage(sender.tab.id, {
                    action: "highlightsLoaded",
                    highlights: storedHighlights
                });
            }
        });
    }
    // No response needed for most actions.
});

// Listener for context menu clicks.
chrome.contextMenus.onClicked.addListener((info, tab) => {
    console.log('[Background] Context menu clicked. Info:', info, 'Tab:', tab);
    if (info.menuItemId === "getMeaning") {
        // Ensure content.js is injected and ready before sending message
        // This is crucial to prevent "Could not establish connection. Receiving end does not exist." error.
        console.log(`[Background] Programmatically injecting content.js into tab ID: ${tab.id}`);
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('[Background] Error injecting content.js:', chrome.runtime.lastError.message);
                // If injection fails (e.g., on a chrome:// or forbidden page), handle it.
                // We might still try to send a message to provide feedback to the user,
                // but the content script won't receive it.
                // For now, we'll just log the error.
                return;
            }
            console.log('[Background] content.js injected. Proceeding to fetch and display meaning.');

            if (info.selectionText) {
                lastSelectedText = info.selectionText; // Update with the exact text from context menu
                currentMeaning = ''; // Clear current meaning for a fresh fetch
                console.log(`[Background] Context menu selection: "${lastSelectedText.substring(0, 50)}..."`);

                // Fetch meaning and then send it back to the content script for display.
                fetchMeaning(lastSelectedText)
                    .then(meaning => {
                        currentMeaning = meaning; // Store the fetched meaning here
                        console.log('[Background] Meaning fetched. Sending to content script for display.');
                        // Send the meaning directly to the content script in the active tab
                        chrome.tabs.sendMessage(tab.id, {
                            action: "displayMeaning",
                            selectedText: lastSelectedText,
                            meaning: currentMeaning
                        }).then(() => {
                            console.log('[Background] Message sent to content script successfully.');
                        }).catch(error => {
                            console.error('[Background] Error sending message to content script after injection:', error);
                        });
                    })
                    .catch(error => {
                        currentMeaning = `Error: ${error.message}`; // Store error message
                        console.error('[Background] Error fetching meaning from API via context menu:', error);
                        // Also send error to content script for display
                        chrome.tabs.sendMessage(tab.id, {
                            action: "displayMeaning",
                            selectedText: lastSelectedText,
                            meaning: currentMeaning,
                            isError: true
                        }).then(() => {
                            console.log('[Background] Error message sent to content script successfully.');
                        }).catch(error => {
                            console.error('[Background] Error sending error message to content script after injection:', error);
                        });
                    });
            } else {
                console.warn('[Background] Context menu clicked, but no selectionText available.');
                // Send a message to content script to inform no text was selected via context menu.
                if (tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "displayMeaning",
                        selectedText: "",
                        meaning: "No text was selected. Please select text before using 'Get Meaning'."
                    }).then(() => {
                        console.log('[Background] "No text selected" message sent to content script.');
                    }).catch(error => {
                        console.error('[Background] Error sending "no text selected" message to content script:', error);
                    });
                }
            }
        });
    }
});

/**
 * Fetches the meaning of the given text using the Gemini API.
 * @param {string} text The text to get the meaning for.
 * @returns {Promise<string>} A promise that resolves with the meaning.
 */
async function getApiKey() {
    // 1) Try to load from bundled local secrets.json (ignored by git)
    try {
        const url = chrome.runtime.getURL('secrets.json');
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data.GEMINI_API_KEY === 'string' && data.GEMINI_API_KEY.trim()) {
                return data.GEMINI_API_KEY.trim();
            }
        }
    } catch {}
    // 2) Try chrome.storage.local
    try {
        const stored = await chrome.storage.local.get('GEMINI_API_KEY');
        if (stored && typeof stored.GEMINI_API_KEY === 'string' && stored.GEMINI_API_KEY.trim()) {
            return stored.GEMINI_API_KEY.trim();
        }
    } catch {}
    return '';
}

async function fetchMeaning(text) {
    console.log(`[Background] Calling fetchMeaning for text: "${text.substring(0, 50)}..."`);
    const apiKey = await getApiKey();
    if (!apiKey) {
        console.error('[Background] API Key is missing!');
        throw new Error("Gemini API Key is not configured. Add it to secrets.json or set in chrome.storage.local under GEMINI_API_KEY.");
    }

    const prompt = `Provide a concise meaning, definition, or explanation for the following text. If it's a word, give its definition. If it's a sentence or paragraph, explain its core meaning or summarize it briefly. Do not include any conversational filler, just the direct meaning. Text: "${text}"`;

    const chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });

    const payload = { contents: chatHistory };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        console.log('[Background] Sending request to Gemini API...');
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('[Background] API Response Error:', response.status, response.statusText, errorData);
            throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log('[Background] Gemini API Response Received:', result);

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const meaning = result.candidates[0].content.parts[0].text;
            console.log(`[Background] Meaning extracted from API response: "${meaning.substring(0, 50)}..."`);
            return meaning;
        } else {
            console.warn('[Background] No valid meaning found in API response structure.');
            throw new Error("No meaning found in API response.");
        }
    } catch (error) {
        console.error("[Background] Error calling Gemini API in fetchMeaning:", error);
        throw new Error(`Failed to get meaning: ${error.message}`);
    }
}
