/**
 * Profil — Klavye Isı Haritası UI
 */
import { KEYBOARD_LAYOUTS } from './lib/keyboardLayouts.js';
import { getHeatLevel, getHeatLevelClass, HEAT_LEGEND } from './lib/keyboardHeatmapColors.js';
import { loadHeatmapSessions, loadHeatmapAggregate } from './lib/keyboardHeatmapApi.js';
import { formatKeyDisplay } from './lib/keyboardHeatmapAnalytics.js';

/** @type {{ layout: string, sessionId: string|null, sessions: object[], aggregate: object|null, loading: boolean, rendered: boolean }} */
const state = {
    layout: 'q',
    sessionId: null,
    sessions: [],
    aggregate: null,
    loading: false,
    rendered: false,
};

let rootEl = null;
let supabaseClient = null;

function $(id) {
    return document.getElementById(id);
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
}

function formatSessionLabel(session, index) {
    const date = session.created_at
        ? new Date(session.created_at).toLocaleString('tr-TR', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        })
        : `#${index + 1}`;
    const title = session.metin_adi || session.kategori || 'Çalışma';
    const short = title.length > 18 ? `${title.slice(0, 18)}…` : title;
    return `${date} · ${short}`;
}

function getActiveKeyStats() {
    if (state.sessionId) {
        const session = state.sessions.find((s) => s.session_id === state.sessionId);
        return session?.key_stats || {};
    }
    return state.aggregate?.key_stats || {};
}

function getActiveAnalytics() {
    if (state.sessionId) {
        const session = state.sessions.find((s) => s.session_id === state.sessionId);
        return session?.analytics || {};
    }
    return state.aggregate?.analytics || {};
}

function renderKeyboardGrid(keyStats) {
    const layout = KEYBOARD_LAYOUTS[state.layout === 'f' ? 'f' : 'q'];
    const rowsHtml = layout.rows.map((row) => {
        const keysHtml = row.keys.map((keyDef) => {
            const stat = keyStats[keyDef.id] || {};
            const pct = Number(stat.percentage) || 0;
            const level = getHeatLevel(pct);
            const levelClass = getHeatLevelClass(level);
            const isWide = (keyDef.width || 1) >= 4;
            const label = keyDef.id === ' ' ? '␣' : keyDef.label;

            return `<button type="button" class="kh-key ${levelClass}${isWide ? ' kh-key--wide' : ''}"
                data-kh-key="${escapeHtml(keyDef.id)}"
                data-kh-label="${escapeHtml(keyDef.label)}"
                data-kh-count="${Number(stat.total_count) || 0}"
                data-kh-pct="${pct}"
                aria-label="${escapeHtml(keyDef.label)}">${label}</button>`;
        }).join('');

        return `<div class="kh-row" role="row">${keysHtml}</div>`;
    }).join('');

    return `<div class="kh-keyboard" role="grid">${rowsHtml}</div>`;
}

function renderLegend() {
    return `<div class="kh-legend">${HEAT_LEGEND.map((item) =>
        `<span class="kh-legend-item"><span class="kh-legend-swatch kh-key ${getHeatLevelClass(item.level)}"></span>${item.label}</span>`
    ).join('')}</div>`;
}

function renderAnalytics(analytics) {
    const top5 = analytics?.top5 || [];
    const bottom5 = analytics?.bottom5 || [];
    const hand = analytics?.hand_usage || { left: 0, right: 0, thumb: 0 };
    const fingers = analytics?.finger_distribution || [];

    const listItems = (items) =>
        items.length
            ? items.map((item) =>
                `<li><span>${escapeHtml(formatKeyDisplay(item.key))}</span><span>${Number(item.total_count).toLocaleString('tr-TR')}</span></li>`
            ).join('')
            : '<li><span>—</span><span>—</span></li>';

    const fingerItems = fingers.length
        ? fingers.map((f) => `<li><span>${escapeHtml(f.label)}</span><span>%${f.percentage}</span></li>`).join('')
        : '<li><span>—</span><span>—</span></li>';

    return `
        <div class="kh-analytics">
            <div class="kh-analytic-card">
                <h4><i class="fa-solid fa-arrow-trend-up"></i> En Çok Kullanılan</h4>
                <ul class="kh-analytic-list">${listItems(top5)}</ul>
            </div>
            <div class="kh-analytic-card">
                <h4><i class="fa-solid fa-arrow-trend-down"></i> En Az Kullanılan</h4>
                <ul class="kh-analytic-list">${listItems(bottom5)}</ul>
            </div>
            <div class="kh-analytic-card">
                <h4><i class="fa-solid fa-hands"></i> El Kullanımı</h4>
                <div class="kh-hand-bars">
                    ${[
                        { label: 'Sol el', val: hand.left },
                        { label: 'Sağ el', val: hand.right },
                        { label: 'Başparmak', val: hand.thumb },
                    ].map((row) => `
                        <div class="kh-hand-bar-row">
                            <span>${row.label}</span>
                            <div class="kh-hand-bar-track"><div class="kh-hand-bar-fill" style="width:${Math.min(100, row.val)}%"></div></div>
                            <span>%${row.val}</span>
                        </div>`).join('')}
                </div>
            </div>
            <div class="kh-analytic-card">
                <h4><i class="fa-solid fa-hand-pointer"></i> Parmak Dağılımı</h4>
                <ul class="kh-analytic-list">${fingerItems}</ul>
            </div>
        </div>`;
}

function renderToolbar() {
    const layoutBtns = ['q', 'f'].map((id) =>
        `<button type="button" class="kh-layout-btn${state.layout === id ? ' active' : ''}" data-kh-layout="${id}">${id.toUpperCase()} Klavye</button>`
    ).join('');

    const sessionBtns = [
        `<button type="button" class="kh-session-btn${!state.sessionId ? ' active' : ''}" data-kh-session="">Tümü</button>`,
        ...state.sessions.map((s, i) =>
            `<button type="button" class="kh-session-btn${state.sessionId === s.session_id ? ' active' : ''}" data-kh-session="${s.session_id}" title="${escapeHtml(s.metin_adi || '')}">${escapeHtml(formatSessionLabel(s, i))}</button>`
        ),
    ].join('');

    return `
        <div class="kh-toolbar">
            <div class="kh-layout-toggle" role="group" aria-label="Klavye türü">${layoutBtns}</div>
            <div class="kh-session-scroll" role="group" aria-label="Oturum seçimi">${sessionBtns}</div>
        </div>`;
}

function renderEmpty() {
    return `
        <div class="kh-empty">
            <div><i class="fa-solid fa-keyboard"></i></div>
            <p class="font-poppins font-bold text-base mb-1">Henüz ısı haritası yok</p>
            <p class="text-sm max-w-md mx-auto">Klavye Çalışması veya Özel Metin Çalışması sonrası <strong>Sonucu Kaydet</strong> dediğinizde tuş basım verileriniz burada görünür.</p>
        </div>`;
}

function renderContent() {
    if (!rootEl) return;

    if (state.loading) {
        rootEl.innerHTML = `<div class="kh-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor…</div>`;
        return;
    }

    const hasData = state.sessions.length > 0 || (state.aggregate?.total_presses > 0);
    if (!hasData) {
        rootEl.innerHTML = renderEmpty();
        return;
    }

    const keyStats = getActiveKeyStats();
    const analytics = getActiveAnalytics();
    const total = analytics?.total_presses || state.aggregate?.total_presses || 0;

    rootEl.innerHTML = `
        ${renderToolbar()}
        <p class="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-3 text-center">
            Toplam <strong class="text-yaziyo-gold">${total.toLocaleString('tr-TR')}</strong> tuş basımı
            · ${state.sessionId ? 'Seçili oturum' : 'Tüm oturumlar (son 30 gün dahil)'}
        </p>
        ${renderLegend()}
        <div class="kh-keyboard-wrap">${renderKeyboardGrid(keyStats)}</div>
        ${renderAnalytics(analytics)}
    `;

    bindInteractions();
}

function openKeyModal(keyId, label, count, pct) {
    const modal = $('kh-key-modal');
    const backdrop = $('kh-key-modal-backdrop');
    if (!modal) return;

    $('kh-key-modal-title').textContent = formatKeyDisplay(keyId);
    $('kh-key-modal-count').textContent = Number(count).toLocaleString('tr-TR');
    $('kh-key-modal-pct').textContent = `%${Number(pct).toFixed(2)}`;
    $('kh-key-modal-label').textContent = label || formatKeyDisplay(keyId);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    requestAnimationFrame(() => backdrop?.classList.remove('opacity-0'));
}

function closeKeyModal() {
    const modal = $('kh-key-modal');
    const backdrop = $('kh-key-modal-backdrop');
    if (!modal) return;
    backdrop?.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

function bindInteractions() {
    if (!rootEl) return;

    rootEl.querySelectorAll('[data-kh-layout]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const layout = btn.getAttribute('data-kh-layout');
            if (layout && layout !== state.layout) {
                state.layout = layout;
                refreshAggregate().then(() => renderContent());
            }
        });
    });

    rootEl.querySelectorAll('[data-kh-session]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const sid = btn.getAttribute('data-kh-session') || null;
            state.sessionId = sid || null;
            if (sid) {
                const session = state.sessions.find((s) => s.session_id === sid);
                if (session?.keyboard_layout === 'f' || session?.keyboard_layout === 'q') {
                    state.layout = session.keyboard_layout;
                }
            }
            renderContent();
        });
    });

    rootEl.querySelectorAll('[data-kh-key]').forEach((btn) => {
        btn.addEventListener('click', () => {
            openKeyModal(
                btn.getAttribute('data-kh-key'),
                btn.getAttribute('data-kh-label'),
                btn.getAttribute('data-kh-count'),
                btn.getAttribute('data-kh-pct')
            );
        });
    });
}

async function refreshAggregate() {
    if (!supabaseClient) return;
    state.aggregate = await loadHeatmapAggregate(supabaseClient, state.layout, null);
}

async function loadHeatmapData() {
    if (!supabaseClient) return;
    state.loading = true;
    renderContent();

    try {
        state.sessions = await loadHeatmapSessions(supabaseClient, 10);
        if (state.sessions.length > 0 && !state.sessionId) {
            const firstLayout = state.sessions[0].keyboard_layout;
            if (firstLayout === 'f' || firstLayout === 'q') state.layout = firstLayout;
        }
        await refreshAggregate();
    } catch (err) {
        console.error('Isı haritası yükleme hatası:', err);
        state.sessions = [];
        state.aggregate = null;
    } finally {
        state.loading = false;
        state.rendered = true;
        renderContent();
    }
}

/**
 * Profil paneli açıldığında veya sayfa yüklendiğinde çağır
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function initKeyboardHeatmapPanel(supabase) {
    rootEl = $('keyboard-heatmap-root');
    if (!rootEl || !supabase) return;

    supabaseClient = supabase;

    $('kh-key-modal-close')?.addEventListener('click', closeKeyModal);
    $('kh-key-modal-backdrop')?.addEventListener('click', closeKeyModal);
    $('kh-key-modal-ok')?.addEventListener('click', closeKeyModal);

    await loadHeatmapData();
}

export async function refreshKeyboardHeatmapPanel() {
    if (!supabaseClient) return;
    const { invalidateHeatmapCache } = await import('./lib/keyboardHeatmapApi.js');
    invalidateHeatmapCache();
    await loadHeatmapData();
}

/** Panel görünür olduğunda lazy load */
export function setupHeatmapPanelLazyLoad(supabase) {
    const menuBtn = $('menu-isi-haritasi');
    if (!menuBtn) return;

    menuBtn.addEventListener('click', () => {
        if (!state.rendered) {
            initKeyboardHeatmapPanel(supabase);
        }
    });
}

if (typeof window !== 'undefined') {
    window.YaziyoKeyboardHeatmap = {
        initKeyboardHeatmapPanel,
        refreshKeyboardHeatmapPanel,
        setupHeatmapPanelLazyLoad,
    };
}
