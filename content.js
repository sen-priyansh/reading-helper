/* content.js (rewritten)
   Reading Helper content script: selection-driven hover card, effects, persistence, meaning box, and focus mode.
*/

(() => {
    'use strict';

    // ---------- State ----------
    let hoverCard = null;
    let selectionRange = null;
    let currentSelectionText = '';
    let selectionRects = [];
    let hideHoverTimer = null;

    // ---------- Utilities ----------
    const log = (...a) => console.log('[ReadingHelper]', ...a);
    const warn = (...a) => console.warn('[ReadingHelper]', ...a);
    const err = (...a) => console.error('[ReadingHelper]', ...a);

    const isConnected = (node) => {
        try { return !!(node && (node.isConnected || (node.ownerDocument && node.ownerDocument.contains(node)))); }
        catch { return false; }
    };

    const buildIcon = (svg) => {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = svg.trim();
        return wrapper.firstElementChild;
    };

    const icons = {
        highlight: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 21h6l10-10a2 2 0 0 0-2.8-2.8L6.2 18.2 3 21z"/>
                <path d="M12 7l5 5"/>
            </svg>
        `,
        search: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7"/>
                <path d="M20 20l-3.5-3.5"/>
            </svg>
        `,
        meaning: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3.5 6.5a2 2 0 0 1 2-2H12v15H5.5a2 2 0 0 1-2-2v-11z"/>
                <path d="M12 19.5V4.5h6.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H12z"/>
            </svg>
        `,
        bold: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M7 5h5a3.5 3.5 0 0 1 0 7H7z"/>
                <path d="M7 12h6a3.5 3.5 0 0 1 0 7H7z"/>
            </svg>
        `,
        contrast: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="8"/>
                <path d="M12 4a8 8 0 0 1 0 16V4z"/>
            </svg>
        `,
        remove: `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 7h16"/>
                <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/>
                <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                <path d="M10 11v6M14 11v6"/>
            </svg>
        `
    };

    // ---------- Effects helpers ----------
    const wrapRangeOrTextNodes = (range, makeWrapper) => {
        // Try simple surround first
        try {
            const wrapper = makeWrapper();
            range.surroundContents(wrapper);
            return [wrapper];
        } catch {
            // Fallback: wrap intersecting text nodes
            const wrapped = [];
            const common = range.commonAncestorContainer;
            const root = common.nodeType === Node.ELEMENT_NODE ? common : common.parentNode;
            if (!root) return wrapped;
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                        const r = document.createRange();
                        r.selectNodeContents(node);
                        const intersects = (range.compareBoundaryPoints(Range.END_TO_START, r) < 0 &&
                                            range.compareBoundaryPoints(Range.START_TO_END, r) > 0);
                        return intersects ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                    }
                }
            );
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach((textNode, idx) => {
                try {
                    let start = 0, end = textNode.length;
                    if (textNode === range.startContainer) start = range.startOffset;
                    if (textNode === range.endContainer) end = range.endOffset;
                    if (start >= end) return;
                    const sub = document.createRange();
                    sub.setStart(textNode, start);
                    sub.setEnd(textNode, end);
                    const w = makeWrapper(idx);
                    sub.surroundContents(w);
                    wrapped.push(w);
                } catch {}
            });
            return wrapped;
        }
    };

    const saveHighlights = () => {
        try {
            const highlights = [];
            const els = document.querySelectorAll('.reading-helper-highlight');
            els.forEach(el => {
                try {
                    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
                    const id = el.getAttribute('data-highlight-id') || String(Date.now()) + Math.random().toString(36).slice(2);
                    const text = el.getAttribute('data-highlight-text') || (el.textContent || '').slice(0, 100);
                    highlights.push({
                        id,
                        text,
                        url: window.location.href,
                        timestamp: Date.now(),
                        position: {
                            x: rect ? rect.left + window.scrollX : 0,
                            y: rect ? rect.top + window.scrollY : 0
                        }
                    });
                } catch {}
            });
            chrome.runtime.sendMessage({ action: 'saveHighlights', highlights, url: window.location.href }, () => {
                if (chrome.runtime.lastError) err('Error saving highlights:', chrome.runtime.lastError);
            });
        } catch (e) { err('saveHighlights failed:', e); }
    };

    const hasEffectsInRange = (range, selectedText) => {
        if (!range || !selectedText) return false;
        if (!isConnected(range.startContainer) || !isConnected(range.endContainer)) return false;
        const common = range.commonAncestorContainer;
        const container = common.nodeType === Node.TEXT_NODE ? common.parentElement : common;
        if (!container) return false;
        let el = container;
        while (el && el !== document.body) {
            if (el.classList && (el.classList.contains('reading-helper-highlight') || el.classList.contains('reading-helper-bold') || el.classList.contains('reading-helper-contrast'))) return true;
            el = el.parentElement;
        }
        if (container.querySelectorAll) {
            const kids = container.querySelectorAll('.reading-helper-highlight, .reading-helper-bold, .reading-helper-contrast');
            if (kids.length) return true;
        }
        const all = document.querySelectorAll('.reading-helper-highlight, .reading-helper-bold, .reading-helper-contrast');
        for (const n of all) { if (n.textContent.includes(selectedText)) return true; }
        return false;
    };

    // ---------- Actions ----------
    const highlightText = (range, text) => {
        if (!range || !text) return;
        try {
            // Quick toggle if already within a highlight wrapper
            const parent = range.commonAncestorContainer && range.commonAncestorContainer.parentElement;
            if (parent && parent.classList && parent.classList.contains('reading-helper-highlight')) {
                const p = parent.parentNode;
                while (parent.firstChild) p.insertBefore(parent.firstChild, parent);
                p.removeChild(parent);
                saveHighlights();
                return;
            }
        } catch {}

        const makeWrapper = (idx = 0) => {
            const s = document.createElement('span');
            s.className = 'reading-helper-highlight';
            s.style.cssText = 'background-color: #fef08a !important;border-radius:3px !important;padding:1px 2px !important;position:relative !important;';
            s.setAttribute('data-highlight-id', Date.now().toString() + (idx ? '-' + idx : ''));
            s.setAttribute('data-highlight-text', text.slice(0, 100));
            return s;
        };
        wrapRangeOrTextNodes(range, makeWrapper);
        saveHighlights();
    };

    const makeBold = (range) => {
        if (!range) return;
        const makeWrapper = () => {
            const s = document.createElement('strong');
            s.className = 'reading-helper-bold';
            return s;
        };
        wrapRangeOrTextNodes(range, makeWrapper);
        saveHighlights();
    };

    const increaseContrast = (range) => {
        if (!range) return;
        const makeWrapper = () => {
            const s = document.createElement('span');
            s.className = 'reading-helper-contrast';
            s.style.cssText = 'color:#000 !important;background:#fff !important;font-weight:600 !important;text-shadow:0 0 1px rgba(0,0,0,0.3) !important;border-radius:2px !important;padding:1px 3px !important;';
            return s;
        };
        wrapRangeOrTextNodes(range, makeWrapper);
        saveHighlights();
    };

    const removeEffects = (range) => {
        if (!range) return;
        try {
            const sel = window.getSelection();
            const txt = sel ? sel.toString() : '';
            if (!txt) return;
            const effectEls = [];
            const common = range.commonAncestorContainer;
            const container = common.nodeType === Node.TEXT_NODE ? common.parentElement : common;
            if (container) {
                if (container.classList && (container.classList.contains('reading-helper-highlight') || container.classList.contains('reading-helper-bold') || container.classList.contains('reading-helper-contrast'))) effectEls.push(container);
                let p = container.parentElement;
                while (p && p !== document.body) {
                    if (p.classList && (p.classList.contains('reading-helper-highlight') || p.classList.contains('reading-helper-bold') || p.classList.contains('reading-helper-contrast'))) { effectEls.push(p); break; }
                    p = p.parentElement;
                }
                const children = container.querySelectorAll('.reading-helper-highlight, .reading-helper-bold, .reading-helper-contrast');
                effectEls.push(...children);
            }
            const unique = [...new Set(effectEls)];
            if (!unique.length) {
                const all = document.querySelectorAll('.reading-helper-highlight, .reading-helper-bold, .reading-helper-contrast');
                for (const e of all) if (e.textContent.includes(txt)) unique.push(e);
            }
            let removed = 0;
            unique.forEach(el => {
                try {
                    const parent = el.parentNode;
                    if (!parent) return;
                    while (el.firstChild) parent.insertBefore(el.firstChild, el);
                    parent.removeChild(el);
                    if (parent.normalize) parent.normalize();
                    removed++;
                } catch {}
            });
            if (removed) saveHighlights();
        } catch {}
    };

    // ---------- Meaning, search, messaging ----------
    const webSearchText = (text) => {
        const url = `https://www.google.com/search?q=${encodeURIComponent(text + ' meaning definition')}`;
        try { chrome.runtime.sendMessage({ action: 'openTab', url }); } catch (e) { /* ignore */ }
    };

    const getMeaningFromGemini = (text) => {
        if (!text || !text.trim()) { return; }
        try { chrome.runtime.sendMessage({ action: 'getMeaningDirect', text }); } catch (e) { /* ignore */ }
    };

    const displayMeaningBox = (selectedText, meaning, isError = false) => {
        const existing = document.getElementById('reading-helper-meaning-box');
        if (existing) existing.remove();
        const box = document.createElement('div');
        box.id = 'reading-helper-meaning-box';
        const baseBg = '#0f1629';
        const baseText = '#e5e7eb';
        const border = 'rgba(255,255,255,0.12)';
        const errorBg = '#2a0f12';
        const errorText = '#fecaca';
        const accent = '#6ee7ff';
        box.style.cssText = `position:fixed;top:20px;right:20px;width:320px;max-height:80vh;overflow-y:auto;background:${isError ? errorBg : baseBg};border:1px solid ${isError ? '#ef4444' : border};border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.35);padding:14px 16px;z-index:100000;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:${isError ? errorText : baseText};word-wrap:break-word;box-sizing:border-box;`;
        const header = document.createElement('div'); header.style.cssText=`font-size:1rem;font-weight:700;margin-bottom:10px;color:${isError ? '#fca5a5' : baseText}`; header.textContent='Reading Helper';
        const selLabel = document.createElement('div'); selLabel.style.cssText='font-size:.8rem;font-weight:600;margin-bottom:4px;color:#cbd5e1;'; selLabel.textContent='Selected Text:';
        const selBox = document.createElement('div'); selBox.style.cssText='font-size:.9rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:8px 10px;margin-bottom:12px;max-height:90px;overflow-y:auto;color:'+baseText+';'; selBox.textContent = selectedText || 'No text selected.';
        const meaningLabel = document.createElement('div'); meaningLabel.style.cssText='font-size:.8rem;font-weight:600;margin-bottom:4px;color:#cbd5e1;'; meaningLabel.textContent='Meaning:';
        const meaningContent = document.createElement('div'); meaningContent.style.cssText='font-size:.95rem;line-height:1.45;white-space:pre-wrap;color:'+ (isError ? errorText : baseText) +';'; meaningContent.textContent = meaning || 'No meaning available.';
        const closeBtn = document.createElement('button'); closeBtn.id='reading-helper-close-button'; closeBtn.style.cssText='position:absolute;top:8px;right:8px;background:none;border:1px solid rgba(255,255,255,0.15);border-radius:8px;font-size:14px;cursor:pointer;color:'+ (isError ? errorText : '#9ca3af') +';line-height:1;padding:4px 8px;'; closeBtn.textContent='Close';
        closeBtn.addEventListener('click', () => box.remove());
        box.append(header, selLabel, selBox, meaningLabel, meaningContent, closeBtn);
        document.body.appendChild(box);
        if (!isError) setTimeout(() => { const b=document.getElementById('reading-helper-meaning-box'); if (b) b.remove(); }, 15000);
    };

    chrome.runtime.onMessage.addListener((req) => {
        switch (req.action) {
            case 'displayMeaning':
                displayMeaningBox(req.selectedText, req.meaning, req.isError); break;
            case 'highlightsLoaded':
                // Placeholder: real restore needs robust location data
                log('highlights loaded', (req.highlights||[]).length); break;
            case 'jumpToHighlight':
                {
                    const el = document.querySelector(`[data-highlight-id="${req.highlightId}"]`);
                    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'), 1000); }
                }
                break;
            case 'focusMode':
                toggleFocusMode(!!req.enable); break;
        }
    });

    // ---------- Focus mode ----------
    const toggleFocusMode = (enable) => {
        let overlay = document.getElementById('reading-helper-focus-overlay');
        if (enable) {
            if (overlay) return;
            overlay = document.createElement('div');
            overlay.id = 'reading-helper-focus-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.8);z-index:99998;pointer-events:none;';
            const box = document.createElement('div');
            box.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60%;height:60%;background:transparent;border:2px solid #3b82f6;border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,0.8)';
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => toggleFocusMode(false));
            overlay.style.pointerEvents = 'auto';
        } else {
            if (overlay) overlay.remove();
        }
    };

    // ---------- Hover card ----------
    const removeHoverCard = () => {
        if (hoverCard && hoverCard.parentNode) {
            hoverCard._storedRange = null;
            hoverCard._storedText = null;
            hoverCard.parentNode.removeChild(hoverCard);
            hoverCard = null;
        }
    };

    const positionHoverCard = (x, y) => {
        if (!hoverCard) return;
        const top = Math.max(8, y - 52);
        const left = Math.max(8, Math.min(x, window.innerWidth - 8 - 180));
        hoverCard.style.left = left + 'px';
        hoverCard.style.top = top + 'px';
    };

    const showHoverCard = (x, y, text, range) => {
        removeHoverCard();
        hoverCard = document.createElement('div');
        hoverCard.id = 'reading-helper-hover-card';
        hoverCard._storedRange = range;
        hoverCard._storedText = text;
        // Use fixed positioning so it follows viewport and avoids layout parents
    hoverCard.style.cssText = `position:fixed;z-index:100000;display:flex;gap:4px;white-space:nowrap;`;

        const hasEffects = hasEffectsInRange(range, text);
        const actions = [
            { key:'highlight', title:'Highlight Text', run:() => highlightText(hoverCard._storedRange, hoverCard._storedText) },
            { key:'search', title:'Web Search', run:() => webSearchText(hoverCard._storedText) },
            { key:'meaning', title:'Get Meaning (Gemini)', run:() => getMeaningFromGemini(hoverCard._storedText) },
            { key:'bold', title:'Make Bold', run:() => makeBold(hoverCard._storedRange) },
            { key:'contrast', title:'Increase Contrast', run:() => increaseContrast(hoverCard._storedRange) },
            { key:'remove', title: hasEffects ? 'Remove Effects' : 'No Effects to Remove', run:() => removeEffects(hoverCard._storedRange), disabled: !hasEffects }
        ];

        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'reading-helper-icon-btn';
            btn.title = a.title; btn.setAttribute('aria-label', a.title);
            const svg = buildIcon(icons[a.key] || '');
            if (svg) btn.appendChild(svg);
            if (a.disabled) btn.setAttribute('disabled', 'true');
            btn.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (a.disabled) return;
                try { if (hoverCard && typeof a.run === 'function') a.run(); } catch (e2) { err('hover action error:', e2); }
                removeHoverCard();
            });
            hoverCard.appendChild(btn);
        });

        document.body.appendChild(hoverCard);
        // position after attaching to ensure correct bounds
        positionHoverCard(x, y);

        // Keep visible while hovered; hide shortly after leaving
        hoverCard.addEventListener('mouseenter', () => { if (hideHoverTimer) { clearTimeout(hideHoverTimer); hideHoverTimer = null; } });
        hoverCard.addEventListener('mouseleave', () => { hideHoverTimer = setTimeout(() => removeHoverCard(), 250); });
    };

    // ---------- Selection listeners ----------
    const updateSelectionState = () => {
        const sel = window.getSelection();
        const txt = sel ? sel.toString().trim() : '';
        currentSelectionText = txt;
        if (!sel || sel.rangeCount === 0 || !txt) {
            selectionRange = null;
            selectionRects = [];
            removeHoverCard();
            return;
        }
        try {
            selectionRange = sel.getRangeAt(0).cloneRange();
            // compute rects for hover detection
            const rectList = sel.getRangeAt(0).getClientRects();
            selectionRects = Array.from(rectList).map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
        } catch (e) {
            err('updateSelectionState error:', e);
            selectionRects = [];
        }
        // Notify background about latest selection (fire-and-forget)
        try { chrome.runtime.sendMessage({ action:'selection', text: txt }); } catch (e) { /* ignore */ }
    };

    document.addEventListener('selectionchange', () => {
        // Debounce selection updates slightly
        setTimeout(updateSelectionState, 0);
    });

    // Show hover card when mouse moves over the selected text
    const pointInSelection = (x, y) => {
        // x,y are client coordinates
        for (const r of selectionRects) {
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
        }
        return false;
    };

    document.addEventListener('mousemove', (e) => {
        if (!selectionRange || !currentSelectionText) return;
        const overSel = pointInSelection(e.clientX, e.clientY);
        const overCard = hoverCard && hoverCard.contains(e.target);
        if (overSel) {
            if (hideHoverTimer) { clearTimeout(hideHoverTimer); hideHoverTimer = null; }
            // Show or move near cursor
            if (hoverCard && hoverCard._storedText === currentSelectionText) {
                positionHoverCard(e.clientX + 12, e.clientY + 12);
            } else {
                showHoverCard(e.clientX + 12, e.clientY + 12, currentSelectionText, selectionRange);
            }
        } else if (!overCard) {
            // Delay hide slightly to allow moving into the card
            if (!hideHoverTimer) hideHoverTimer = setTimeout(() => removeHoverCard(), 200);
        }
    });

    document.addEventListener('click', (e) => {
        if (hoverCard && !hoverCard.contains(e.target)) removeHoverCard();
    });

    // ---------- Highlights load ----------
    const loadHighlights = () => {
        try { chrome.runtime.sendMessage({ action:'getHighlights', url: window.location.href }); } catch (e) { /* ignore */ }
    };
    document.addEventListener('DOMContentLoaded', loadHighlights);
})();
