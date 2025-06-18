// content.js
// This script runs on all web pages.

console.log('[Content] Script loaded and running on the page.');

// Function to create and display the meaning box on the page
function displayMeaningBox(selectedText, meaning, isError = false) {
    console.log('[Content] displayMeaningBox called.');

    // Remove any existing meaning box to avoid duplicates
    let existingBox = document.getElementById('reading-helper-meaning-box');
    if (existingBox) {
        existingBox.remove();
        console.log('[Content] Removed existing meaning box.');
    }

    const meaningBox = document.createElement('div');
    meaningBox.id = 'reading-helper-meaning-box';

    // Basic styling for the floating box (Tailwind-like classes applied via style for simplicity)
    meaningBox.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        max-height: 80vh;
        overflow-y: auto;
        background-color: ${isError ? '#fee2e2' : '#ffffff'}; /* red-100 for error, white otherwise */
        border: 1px solid ${isError ? '#ef4444' : '#e2e8f0'}; /* red-500 for error, slate-200 otherwise */
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        padding: 16px;
        z-index: 99999;
        font-family: 'Inter', sans-serif;
        color: #334155; /* slate-700 */
        word-wrap: break-word;
        box-sizing: border-box; /* Include padding in width/height */
    `;

    // Add selected text and meaning
    meaningBox.innerHTML = `
        <div style="font-size: 1rem; font-weight: 600; margin-bottom: 8px; color: ${isError ? '#ef4444' : '#1e293b'};">Reading Helper</div>
        <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px; color: #475569;">Selected Text:</div>
        <div style="font-size: 0.875rem; background-color: #f1f5f9; border-radius: 4px; padding: 8px; margin-bottom: 12px; max-height: 80px; overflow-y: auto;">${selectedText || 'No text selected.'}</div>
        <div style="font-size: 0.875rem; font-weight: 600; margin-bottom: 4px; color: #475569;">Meaning:</div>
        <div style="font-size: 0.875rem;">${meaning || 'No meaning available.'}</div>
        <button id="reading-helper-close-button" style="
            position: absolute;
            top: 8px;
            right: 8px;
            background: none;
            border: none;
            font-size: 1.2rem;
            cursor: pointer;
            color: #64748b; /* slate-500 */
            line-height: 1;
            padding: 4px;
            border-radius: 4px;
        ">&times;</button>
    `;

    document.body.appendChild(meaningBox);
    console.log('[Content] Meaning box appended to body.');

    // Add event listener to the close button
    const closeButton = document.getElementById('reading-helper-close-button');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            meaningBox.remove();
            console.log('[Content] Meaning box closed by user.');
        });
    }

    // Optional: Auto-hide after a few seconds if it's not an error message
    if (!isError) {
        setTimeout(() => {
            if (document.getElementById('reading-helper-meaning-box')) {
                document.getElementById('reading-helper-meaning-box').remove();
                console.log('[Content] Meaning box auto-hidden after timeout.');
            }
        }, 15000); // Hide after 15 seconds
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Content] Message received from background script:', request);
    if (request.action === "displayMeaning") {
        displayMeaningBox(request.selectedText, request.meaning, request.isError);
        console.log('[Content] Called displayMeaningBox to show meaning on page.');
    }
    // No need to return true as sendResponse is not used here.
});

// Listens for 'mouseup' events to capture selected text.
// This is still useful for background to know the latest selection, even if not directly used for display here.
document.addEventListener('mouseup', () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText.length > 0) {
        console.log(`[Content] Text selected: "${selectedText.substring(0, 50)}..."`);
        // Send the selected text to the background script.
        chrome.runtime.sendMessage({ action: "selection", text: selectedText })
            .then(() => {
                console.log('[Content] Selected text sent to background script.');
            })
            .catch(error => {
                console.error('[Content] Error sending selected text to background:', error);
            });
    } else {
        console.log('[Content] No text selected on mouseup.');
    }
});
