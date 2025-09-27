// popup.js - Reading Helper Toolbox
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Popup] Reading Helper Toolbox initializing...');

    // Get DOM elements
    const focusModeBtn = document.getElementById('focusMode');
    const focusText = document.getElementById('focusText');
    const clearSelectionBtn = document.getElementById('clearSelection');
    const highlightAllBtn = document.getElementById('highlightAll');
    const exportHighlightsBtn = document.getElementById('exportHighlights');
    const clearAllHighlightsBtn = document.getElementById('clearAllHighlights');
    const highlightsList = document.getElementById('highlightsList');
    const highlightCount = document.getElementById('highlightCount');
    const statusDiv = document.getElementById('status');

    let focusModeActive = false;
    let currentTabId = null;
    let currentUrl = null;

    // Get current tab information
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            currentTabId = tabs[0].id;
            currentUrl = tabs[0].url;
            loadHighlights();
        }
    });

    // Focus Mode Toggle
    focusModeBtn.addEventListener('click', () => {
        focusModeActive = !focusModeActive;
        
        if (focusModeActive) {
            focusModeBtn.classList.add('active');
            focusText.textContent = 'Disable Focus Mode';
            chrome.tabs.sendMessage(currentTabId, {
                action: 'focusMode',
                enable: true
            });
            showStatus('Focus mode enabled', 'success');
        } else {
            focusModeBtn.classList.remove('active');
            focusText.textContent = 'Enable Focus Mode';
            chrome.tabs.sendMessage(currentTabId, {
                action: 'focusMode',
                enable: false
            });
            showStatus('Focus mode disabled', 'success');
        }
    });

    // Clear Selection
    clearSelectionBtn.addEventListener('click', () => {
        chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: () => {
                window.getSelection().removeAllRanges();
            }
        });
        showStatus('Selection cleared', 'success');
    });

    // Highlight All (make all highlights visible/flash)
    highlightAllBtn.addEventListener('click', () => {
        chrome.scripting.executeScript({
            target: { tabId: currentTabId },
            func: () => {
                const highlights = document.querySelectorAll('.reading-helper-highlight');
                highlights.forEach(highlight => {
                    const originalBg = highlight.style.backgroundColor;
                    highlight.style.backgroundColor = '#f59e0b';
                    setTimeout(() => {
                        highlight.style.backgroundColor = originalBg;
                    }, 1000);
                });
            }
        });
        showStatus(`Flashed ${document.querySelectorAll('.highlight-item').length} highlights`, 'success');
    });

    // Export Highlights
    exportHighlightsBtn.addEventListener('click', () => {
        exportHighlights();
    });

    // Clear All Highlights
    clearAllHighlightsBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to remove all highlights from this page?')) {
            chrome.scripting.executeScript({
                target: { tabId: currentTabId },
                func: () => {
                    const highlights = document.querySelectorAll('.reading-helper-highlight');
                    highlights.forEach(highlight => {
                        const parent = highlight.parentNode;
                        while (highlight.firstChild) {
                            parent.insertBefore(highlight.firstChild, highlight);
                        }
                        parent.removeChild(highlight);
                    });
                }
            });
            
            // Clear from storage
            chrome.runtime.sendMessage({
                action: 'saveHighlights',
                highlights: [],
                url: currentUrl
            });
            
            loadHighlights();
            showStatus('All highlights removed', 'success');
        }
    });

    // Load highlights for current page
    function loadHighlights() {
        if (!currentUrl) return;
        const exactKey = `highlights_${currentUrl}`;
        const urlObj = new URL(currentUrl);
        const baseUrl = `${urlObj.origin}${urlObj.pathname}`; // strip query/hash
        const baseKey = `highlights_${baseUrl}`;

        chrome.storage.local.get([exactKey, baseKey]).then(result => {
            let highlights = result[exactKey] || result[baseKey] || [];
            // As a final fallback, scan all keys for this base URL prefix
            if ((!highlights || highlights.length === 0)) {
                chrome.storage.local.get(null).then(all => {
                    let merged = [];
                    for (const [k, v] of Object.entries(all)) {
                        if (k.startsWith('highlights_')) {
                            try {
                                const kUrl = k.replace('highlights_', '');
                                const u = new URL(kUrl);
                                const uBase = `${u.origin}${u.pathname}`;
                                if (uBase === baseUrl && Array.isArray(v)) merged = merged.concat(v);
                            } catch {}
                        }
                    }
                    displayHighlights(merged);
                });
            } else {
                displayHighlights(highlights);
            }
        });
    }

    // Display highlights in the list
    function displayHighlights(highlights) {
        highlightCount.textContent = highlights.length;

        if (highlights.length === 0) {
            highlightsList.innerHTML = '<div class="no-highlights">No highlights found on this page.</div>';
            return;
        }

        highlightsList.innerHTML = highlights.map(highlight => `
            <div class="highlight-item" data-highlight-id="${highlight.id}">
                <div class="highlight-text">${highlight.text}</div>
                <div class="highlight-url">${new Date(highlight.timestamp).toLocaleString()}</div>
            </div>
        `).join('');

        // Add click handlers for jumping to highlights
        document.querySelectorAll('.highlight-item').forEach(item => {
            item.addEventListener('click', () => {
                const highlightId = item.getAttribute('data-highlight-id');
                chrome.tabs.sendMessage(currentTabId, {
                    action: 'jumpToHighlight',
                    highlightId: highlightId
                });
                showStatus('Jumped to highlight', 'success');
            });
        });
    }

    // Export highlights to text file
    function exportHighlights() {
        chrome.storage.local.get(null).then(items => {
            const allHighlights = [];
            
            for (const [key, value] of Object.entries(items)) {
                if (key.startsWith('highlights_')) {
                    const url = key.replace('highlights_', '');
                    if (Array.isArray(value)) {
                        value.forEach(highlight => {
                            allHighlights.push({
                                ...highlight,
                                url: url
                            });
                        });
                    }
                }
            }

            if (allHighlights.length === 0) {
                showStatus('No highlights to export', 'error');
                return;
            }

            // Sort by timestamp
            allHighlights.sort((a, b) => b.timestamp - a.timestamp);

            // Create export content
            let exportText = 'Reading Helper - Exported Highlights\\n';
            exportText += '='.repeat(50) + '\\n\\n';

            let currentUrl = '';
            allHighlights.forEach(highlight => {
                if (highlight.url !== currentUrl) {
                    currentUrl = highlight.url;
                    exportText += `\\n📄 ${currentUrl}\\n`;
                    exportText += '-'.repeat(50) + '\\n';
                }
                
                exportText += `🎨 ${highlight.text}\\n`;
                exportText += `   📅 ${new Date(highlight.timestamp).toLocaleString()}\\n\\n`;
            });

            // Download as text file
            const blob = new Blob([exportText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            chrome.downloads.download({
                url: url,
                filename: `reading-helper-highlights-${new Date().toISOString().split('T')[0]}.txt`
            });

            showStatus(`Exported ${allHighlights.length} highlights`, 'success');
        });
    }

    // Show status message
    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 3000);
    }

    // Auto-refresh when storage changes for this page
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !currentUrl) return;
        const exactKey = `highlights_${currentUrl}`;
        const urlObj = new URL(currentUrl);
        const baseKey = `highlights_${urlObj.origin}${urlObj.pathname}`;
        if (changes[exactKey] || changes[baseKey]) {
            loadHighlights();
        }
    });
});
