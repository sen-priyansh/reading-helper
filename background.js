// background.js
// This is the service worker for the Chrome extension.

console.log('[Background] Service worker started.');

// Store the last selected text. This will be updated by content.js
// whenever text is selected on a page.
let lastSelectedText = '';
// New variable to store the most recently fetched meaning.
let currentMeaning = '';

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
// The popup.js logic is no longer relevant as meaning is shown on-page.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Background] Message received from:', sender.tab ? `content script (${sender.tab.url})` : 'unknown sender', 'Request:', request);

    if (request.action === "selection") {
        // Update the last selected text from the content script.
        lastSelectedText = request.text;
        // Clear previous meaning if the selection changes to ensure a fresh fetch for new text.
        currentMeaning = '';
        console.log(`[Background] Stored new selected text from content script: "${lastSelectedText.substring(0, 50)}..."`);
    }
    // No response needed for "selection" action.
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
async function fetchMeaning(text) {
    console.log(`[Background] Calling fetchMeaning for text: "${text.substring(0, 50)}..."`);
    const apiKey = "YOUR_API_KEY"; // IMPORTANT: Replace with your actual Gemini API Key here
    if (!apiKey) {
        console.error('[Background] API Key is missing!');
        throw new Error("Gemini API Key is not set in background.js");
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
