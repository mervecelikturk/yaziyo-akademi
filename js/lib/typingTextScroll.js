/**
 * Klavye çalışması / özel metin — referans metin + yazım alanı senkron kaydırma
 * Görünür alanın son 3 satırına gelene kadar kaymaz; sonra satır satır kayar.
 * Tablet/mobil: scrollHeight gecikmesi ve sanal klavye için tekrarlı senkron.
 */
(function (global) {
    'use strict';

    /** Görünür alanın altından kaç satır kalınca kaymaya başlansın */
    var DEFAULT_BOTTOM_LINES = 3;

    function parsePx(value, fallback) {
        const n = parseFloat(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function getLineHeightPx(el) {
        if (!el) return 24;
        const cs = getComputedStyle(el);
        let lh = parsePx(cs.lineHeight, NaN);
        if (!Number.isFinite(lh) || lh <= 0) {
            lh = parsePx(cs.fontSize, 16) * 1.5;
        }
        return lh;
    }

    function measureWrappedTextHeight(text, styleSource) {
        const cs = getComputedStyle(styleSource);
        const isTextarea = styleSource.tagName === 'TEXTAREA';
        // Scrollbar genişliğini düş: clientWidth sarmalama ile uyumlu
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

    /**
     * Son N satıra gelene kadar 0; sonrasında satır adımlarıyla kaydır.
     * İmlec görünür alanın (alt - N satır) hizasında tutulur.
     */
    function resolveScroll(prefixHeight, fullHeight, containerHeight, lineHeight, bottomLines) {
        if (containerHeight <= 0 || lineHeight <= 0) return 0;

        const lines = Math.max(1, bottomLines | 0);
        const keepFromBottom = Math.min(lines * lineHeight, Math.max(0, containerHeight - lineHeight));
        const anchor = containerHeight - keepFromBottom;
        const excess = prefixHeight - anchor;
        if (excess <= 0) return 0;

        // Son N satıra girince bir satır kay; her ek satırda bir satır daha
        const stepped = Math.ceil(excess / lineHeight) * lineHeight;
        const maxScroll = Math.max(0, fullHeight - containerHeight);
        return Math.min(Math.max(0, stepped), maxScroll);
    }

    /**
     * Textarea imlecini görünür alanda tutar (yazdıkça kayar, sildikçe geri gelir).
     * Son N satıra gelmeden kaymaz; gelince satır satır kayar.
     */
    function scrollTextareaToCaret(textarea, typedLen, bottomLines) {
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

        const before = value.slice(0, caret);
        const prefixHeight = measureWrappedTextHeight(before, textarea);
        const viewH = textarea.clientHeight;
        const lineHeight = getLineHeightPx(textarea);
        const lines = bottomLines == null ? DEFAULT_BOTTOM_LINES : bottomLines;
        const target = resolveScroll(prefixHeight, textarea.scrollHeight, viewH, lineHeight, lines);

        // Metin sonuna yakınken scrollHeight gecikmesi (iOS/tablet) için üst sınır
        const clamped = Math.max(0, Math.min(target, maxScroll));
        textarea.scrollTop = clamped;
        if (caret >= value.length && clamped >= maxScroll - 1 && textarea.scrollTop < maxScroll - 1) {
            textarea.scrollTop = maxScroll;
        }
    }

    function syncTypingPanels({
        referenceEl,
        referenceContainer,
        referenceFullText,
        userInputEl,
        typedLen,
        bottomLinesBeforeScroll = DEFAULT_BOTTOM_LINES,
        // Eski çağrılar için yok sayılır; davranış bottomLinesBeforeScroll ile belirlenir
        anchorRatio: _anchorRatio,
        textareaAnchorRatio: _textareaAnchorRatio,
        referenceMoveMode = 'transform',
    }) {
        const safeLen = Math.max(0, typedLen || 0);
        const fullText = referenceFullText || '';
        const bottomLines = bottomLinesBeforeScroll == null
            ? DEFAULT_BOTTOM_LINES
            : bottomLinesBeforeScroll;

        if (referenceEl && referenceContainer) {
            const prefix = fullText.substring(0, Math.min(safeLen, fullText.length));
            const prefixHeight = measureWrappedTextHeight(prefix, referenceEl);
            const fullHeight = measureWrappedTextHeight(fullText, referenceEl);
            const containerHeight = visibleContainerHeight(referenceContainer);
            const lineHeight = getLineHeightPx(referenceEl);
            const scroll = resolveScroll(
                prefixHeight,
                fullHeight,
                containerHeight,
                lineHeight,
                bottomLines
            );

            if (referenceMoveMode === 'top') {
                referenceEl.style.top = `${-scroll}px`;
                referenceEl.style.transform = '';
            } else {
                referenceEl.style.transform = `translateY(${-scroll}px)`;
                referenceEl.style.top = '';
            }
        }

        if (userInputEl) {
            scrollTextareaToCaret(userInputEl, safeLen, bottomLines);
        }
    }

    /**
     * Layout/scrollHeight oturana kadar birkaç kez senkronlar (tablet/iOS).
     */
    function scheduleSyncTypingPanels(options, delays) {
        const times = Array.isArray(delays) && delays.length ? delays : [0, 32, 100];
        const run = () => syncTypingPanels(options);
        times.forEach((ms) => {
            if (ms <= 0) {
                requestAnimationFrame(() => requestAnimationFrame(run));
            } else {
                setTimeout(run, ms);
            }
        });
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
        scheduleSyncTypingPanels,
        resetTypingPanels,
        scrollTextareaToCaret,
    };
})(typeof window !== 'undefined' ? window : globalThis);
