/**
 * Klavye çalışması / özel metin — referans metin + yazım alanı senkron kaydırma
 * Textarea: imleç son satıra gelince yukarı kayar, silince geri gelir.
 */
(function (global) {
    'use strict';

    function parsePx(value, fallback) {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function measureWrappedTextHeight(text, styleSource) {
        const cs = getComputedStyle(styleSource);
        const isTextarea = styleSource.tagName === 'TEXTAREA';
        const width = Math.max(1, styleSource.clientWidth);

        const probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = `
            position: absolute;
            left: -99999px;
            top: 0;
            visibility: hidden;
            pointer-events: none;
            white-space: pre-wrap;
            word-wrap: break-word;
            overflow-wrap: break-word;
            box-sizing: ${cs.boxSizing};
            width: ${width}px;
            font-family: ${cs.fontFamily};
            font-size: ${cs.fontSize};
            font-weight: ${cs.fontWeight};
            font-style: ${cs.fontStyle};
            line-height: ${cs.lineHeight};
            letter-spacing: ${cs.letterSpacing};
            word-spacing: ${cs.wordSpacing};
            text-align: ${cs.textAlign};
            text-transform: ${cs.textTransform};
            padding: ${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft};
            margin: 0;
            border: 0;
            ${isTextarea ? `tab-size: ${cs.tabSize || 8};` : ''}
        `;
        // Son satır boşsa (\\n ile bitiyorsa) yüksekliğin sayılması için görünmez karakter
        const raw = text || '';
        probe.textContent = raw.endsWith('\n') ? raw + '\u200b' : raw;
        document.body.appendChild(probe);
        const height = probe.offsetHeight;
        probe.remove();
        return height;
    }

    function visibleContainerHeight(containerEl) {
        const cs = getComputedStyle(containerEl);
        const padY = parsePx(cs.paddingTop, 0) + parsePx(cs.paddingBottom, 0);
        return Math.max(0, containerEl.clientHeight - padY);
    }

    function resolveScroll(prefixHeight, fullHeight, containerHeight, anchorRatio) {
        if (containerHeight <= 0) return 0;
        const anchor = containerHeight * anchorRatio;
        const offset = Math.max(0, prefixHeight - anchor);
        const maxScroll = Math.max(0, fullHeight - containerHeight);
        return Math.min(offset, maxScroll);
    }

    /**
     * Textarea imlecini görünür alanda tutar (yazdıkça kayar, sildikçe geri gelir).
     * maxScroll için tarayıcının gerçek scrollHeight değerini kullanır.
     */
    function scrollTextareaToCaret(textarea, typedLen, anchorRatio) {
        if (!textarea) return;

        const value = textarea.value;
        const caret = Math.max(
            0,
            Math.min(
                typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : value.length,
                typedLen == null ? value.length : typedLen,
                value.length
            )
        );

        const maxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
        if (maxScroll <= 0) {
            textarea.scrollTop = 0;
            return;
        }

        // Yazım sonda ilerler: son satır görünür kalsın; silince maxScroll küçülür, metin geri gelir
        if (caret >= value.length) {
            textarea.scrollTop = maxScroll;
            return;
        }

        const before = value.slice(0, caret);
        const prefixHeight = measureWrappedTextHeight(before, textarea);
        const viewH = textarea.clientHeight;
        const ratio = Math.min(0.92, Math.max(0.55, anchorRatio));
        const target = prefixHeight - viewH * ratio;
        textarea.scrollTop = Math.max(0, Math.min(target, maxScroll));
    }

    function syncTypingPanels({
        referenceEl,
        referenceContainer,
        referenceFullText,
        userInputEl,
        typedLen,
        anchorRatio = 0.35,
        textareaAnchorRatio = 0.78,
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
            scrollTextareaToCaret(userInputEl, safeLen, textareaAnchorRatio);
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

    global.YaziyoTypingScroll = {
        syncTypingPanels,
        resetTypingPanels,
        scrollTextareaToCaret,
    };
})(typeof window !== 'undefined' ? window : globalThis);
