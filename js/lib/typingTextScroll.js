/**
 * Klavye çalışması / özel metin — referans metin + yazım alanı senkron kaydırma
 */
(function (global) {
    'use strict';

    function measureWrappedTextHeight(text, styleSource) {
        const cs = getComputedStyle(styleSource);
        const probe = document.createElement('div');
        probe.style.cssText = `
            position: absolute;
            visibility: hidden;
            pointer-events: none;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            box-sizing: ${cs.boxSizing};
            width: ${styleSource.clientWidth}px;
            font-family: ${cs.fontFamily};
            font-size: ${cs.fontSize};
            font-weight: ${cs.fontWeight};
            line-height: ${cs.lineHeight};
            letter-spacing: ${cs.letterSpacing};
            text-align: ${cs.textAlign};
            padding: ${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft};
            margin: 0;
            border: 0;
        `;
        probe.textContent = text || '';
        document.body.appendChild(probe);
        const height = probe.offsetHeight;
        probe.remove();
        return height;
    }

    function visibleContainerHeight(containerEl) {
        const cs = getComputedStyle(containerEl);
        const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        return Math.max(0, containerEl.clientHeight - padY);
    }

    function resolveScroll(prefixHeight, fullHeight, containerHeight, anchorRatio) {
        if (containerHeight <= 0) return 0;
        const anchor = containerHeight * anchorRatio;
        const offset = Math.max(0, prefixHeight - anchor);
        const maxScroll = Math.max(0, fullHeight - containerHeight);
        return Math.min(offset, maxScroll);
    }

    function syncTypingPanels({
        referenceEl,
        referenceContainer,
        referenceFullText,
        userInputEl,
        typedLen,
        anchorRatio = 0.35,
        referenceMoveMode = 'transform',
    }) {
        const safeLen = Math.max(0, typedLen || 0);
        const fullText = referenceFullText || '';

        if (referenceEl && referenceContainer) {
            const prefix = fullText.substring(0, Math.min(safeLen, fullText.length));
            const prefixHeight = measureWrappedTextHeight(prefix, referenceEl);
            const fullHeight = measureWrappedTextHeight(fullText, referenceEl);
            const containerHeight = visibleContainerHeight(referenceContainer);
            const scroll = resolveScroll(prefixHeight, fullHeight, containerHeight, anchorRatio);

            if (referenceMoveMode === 'top') {
                referenceEl.style.top = `${-scroll}px`;
                referenceEl.style.transform = '';
            } else {
                referenceEl.style.transform = `translateY(${-scroll}px)`;
                referenceEl.style.top = '';
            }
        }

        if (userInputEl) {
            const typed = userInputEl.value.substring(0, safeLen);
            const prefixHeight = measureWrappedTextHeight(typed, userInputEl);
            const fullHeight = measureWrappedTextHeight(userInputEl.value, userInputEl);
            const containerHeight = userInputEl.clientHeight;
            userInputEl.scrollTop = resolveScroll(prefixHeight, fullHeight, containerHeight, anchorRatio);
        }
    }

    function resetTypingPanels({ referenceEl, userInputEl, referenceMoveMode = 'transform' }) {
        if (referenceEl) {
            if (referenceMoveMode === 'top') {
                referenceEl.style.top = '0px';
                referenceEl.style.transform = '';
            } else {
                referenceEl.style.transform = 'translateY(0px)';
                referenceEl.style.top = '';
            }
        }
        if (userInputEl) {
            userInputEl.scrollTop = 0;
        }
    }

    global.YaziyoTypingScroll = { syncTypingPanels, resetTypingPanels };
})(typeof window !== 'undefined' ? window : globalThis);
