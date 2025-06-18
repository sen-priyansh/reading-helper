// popup.js
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Popup] DOMContentLoaded: Initializing popup script.');

    const selectedTextDiv = document.getElementById('selectedText');
    const meaningDiv = document.getElementById('meaning');
    const loadingSpinner = document.getElementById('loading');
    const contentDiv = document.getElementById('content');

    // Display loading spinner initially
    loadingSpinner.style.display = 'block';
    contentDiv.classList.add('hidden');
    console.log('[Popup] Displaying loading spinner, hiding content.');

    // Request the selected text and its meaning from the background script
    console.log('[Popup] Requesting meaning from background script...');
    chrome.runtime.sendMessage({ action: "getMeaning" }, (response) => {
        console.log('[Popup] Received response from background script:', response);

        // Hide loading spinner and show content
        loadingSpinner.style.display = 'none';
        contentDiv.classList.remove('hidden');
        console.log('[Popup] Hiding loading spinner, showing content.');

        if (response) {
            if (response.selectedText) {
                selectedTextDiv.textContent = response.selectedText;
                console.log(`[Popup] Displayed selected text: "${response.selectedText.substring(0, 50)}..."`);
            } else {
                selectedTextDiv.textContent = "No text selected.";
                console.warn('[Popup] No selected text received from background.');
            }

            if (response.meaning) {
                meaningDiv.textContent = response.meaning;
                console.log(`[Popup] Displayed meaning: "${response.meaning.substring(0, 50)}..."`);
            } else if (response.error) {
                meaningDiv.textContent = `Error: ${response.error}`;
                meaningDiv.style.color = 'red';
                console.error(`[Popup] Error received from background: ${response.error}`);
            } else {
                meaningDiv.textContent = "Click 'Get Meaning' from the context menu after selecting text.";
                console.log('[Popup] No meaning or error in response, displaying default message.');
            }
        } else {
            selectedTextDiv.textContent = "Could not retrieve information. Try again.";
            meaningDiv.textContent = "No response from background script.";
            console.error('[Popup] No response object received from background script.');
        }
    });
});
