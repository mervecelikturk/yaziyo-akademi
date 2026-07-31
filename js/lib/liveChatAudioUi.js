/**
 * YAZİYO — Compact tema uyumlu ses oynatıcı (native audio menu yok)
 * Çizgi (progress) kalıcı; süre saniye olarak da yazılır.
 */

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
}

function formatMmSs(sec) {
    const n = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(n / 60);
    const s = n % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/** "0:12 · 12 sn" */
export function formatAudioDurationLabel(sec) {
    const n = Math.max(0, Math.round(Number(sec) || 0));
    if (!n && n !== 0) return 'Ses';
    return `${formatMmSs(n)} · ${n} sn`;
}

/**
 * @param {string} url
 * @param {string|number} durationLabelOrSec
 * @param {'lc'|'alc'} variant
 */
export function buildAudioPlayerHtml(url, durationLabelOrSec = 'Ses', variant = 'lc') {
    let dur = 'Ses';
    let totalSec = null;
    if (typeof durationLabelOrSec === 'number' && Number.isFinite(durationLabelOrSec)) {
        totalSec = Math.max(0, Math.round(durationLabelOrSec));
        dur = formatAudioDurationLabel(totalSec);
    } else {
        const raw = String(durationLabelOrSec || 'Ses');
        const m = raw.match(/(\d+)/);
        if (m && !raw.includes('sn') && !raw.includes(':')) {
            totalSec = parseInt(m[1], 10);
            dur = formatAudioDurationLabel(totalSec);
        } else if (raw.includes(':') && !raw.includes('sn')) {
            const parts = raw.match(/(\d+):(\d{2})/);
            if (parts) {
                totalSec = parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
                dur = formatAudioDurationLabel(totalSec);
            } else {
                dur = raw;
            }
        } else {
            dur = raw;
        }
    }

    return `
        <div class="${variant}-audio-player" data-audio-player${totalSec != null ? ` data-audio-total="${totalSec}"` : ''}>
            <button type="button" class="${variant}-audio-btn" data-audio-toggle aria-label="Ses oynat">
                <i class="fa-solid fa-play" data-audio-icon></i>
            </button>
            <div class="${variant}-audio-meta">
                <div class="${variant}-audio-line" aria-hidden="true">
                    <div class="${variant}-audio-line-fill" data-audio-fill></div>
                </div>
                <span class="${variant}-audio-dur" data-audio-dur>${escapeHtml(dur)}</span>
            </div>
            <audio preload="metadata" src="${escapeHtml(url)}" data-audio-el></audio>
        </div>
    `;
}

function setPlayingUi(wrap, playing) {
    if (!wrap) return;
    wrap.classList.toggle('is-playing', playing);
    const icon = wrap.querySelector('[data-audio-icon]');
    if (icon) {
        icon.classList.toggle('fa-play', !playing);
        icon.classList.toggle('fa-pause', playing);
    }
    const btn = wrap.querySelector('[data-audio-toggle]');
    if (btn) btn.setAttribute('aria-label', playing ? 'Duraklat' : 'Ses oynat');
}

function updateFill(wrap, audio) {
    const fill = wrap?.querySelector('[data-audio-fill]');
    if (!fill || !audio) return;
    const total = audio.duration || Number(wrap.dataset.audioTotal) || 0;
    const pct = total > 0 ? Math.min(100, (audio.currentTime / total) * 100) : 0;
    fill.style.width = `${pct}%`;
}

/** Aynı root üzerinde bir kez bağlanır */
export function bindAudioPlayerRoot(root) {
    if (!root || root.dataset.yaziyoAudioBound === '1') return;
    root.dataset.yaziyoAudioBound = '1';

    let activeWrap = null;

    root.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-audio-toggle]');
        if (!btn || !root.contains(btn)) return;
        e.preventDefault();
        e.stopPropagation();

        const wrap = btn.closest('[data-audio-player]');
        const audio = wrap?.querySelector('audio[data-audio-el]');
        if (!audio) return;

        if (activeWrap && activeWrap !== wrap) {
            const prev = activeWrap.querySelector('audio[data-audio-el]');
            if (prev) {
                prev.pause();
                prev.currentTime = 0;
                updateFill(activeWrap, prev);
            }
            setPlayingUi(activeWrap, false);
        }

        if (audio.paused) {
            try {
                await audio.play();
                activeWrap = wrap;
                setPlayingUi(wrap, true);
            } catch (err) {
                console.warn('Ses oynatılamadı:', err);
            }
        } else {
            audio.pause();
            setPlayingUi(wrap, false);
            activeWrap = null;
        }
    });

    root.addEventListener('timeupdate', (e) => {
        const audio = e.target;
        if (!(audio instanceof HTMLAudioElement) || !audio.hasAttribute('data-audio-el')) return;
        const wrap = audio.closest('[data-audio-player]');
        updateFill(wrap, audio);
    }, true);

    root.addEventListener('ended', (e) => {
        const audio = e.target;
        if (!(audio instanceof HTMLAudioElement) || !audio.hasAttribute('data-audio-el')) return;
        const wrap = audio.closest('[data-audio-player]');
        setPlayingUi(wrap, false);
        audio.currentTime = 0;
        updateFill(wrap, audio);
        if (activeWrap === wrap) activeWrap = null;
    }, true);
}
