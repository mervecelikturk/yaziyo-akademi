/* ============================================================ */
/* YAZİYO - KLAVYE DÜELLOSU (Gerçek Zamanlı 1v1 Typing Arena)  */
/* Supabase Realtime (presence + broadcast) + replay kaydı      */
/* ============================================================ */
(function () {
    'use strict';

    const SUPABASE_WAIT_MS = 150;
    const SUPABASE_MAX_TRIES = 60;
    const COUNTDOWN_FROM = 3;
    const COUNTDOWN_TICK_MS = 1000;
    const START_LEAD_MS = 700;
    const PROGRESS_THROTTLE_MS = 70;
    const FINISH_WAIT_MS = 4000;
    const COMBO_GLOW_STEP = 5;
    const IDLE_MS = 3000;
    /** Presence track/reconnect leave olaylarını gerçek çıkıştan ayırmak için */
    const PRESENCE_LEAVE_DEBOUNCE_MS = 1800;
    /** Maç sırasında progress/heartbeat gelmeye devam ediyorsa ayrılma sayma */
    const RIVAL_ALIVE_GRACE_MS = 10000;
    const HEARTBEAT_MS = 2500;
    const MATCH_DISCONNECT_MS = 12000;
    const RECONNECT_MS = 2500;
    /** Odada tek kişi kalıp 5 dk kimse gelmezse oda kapanır */
    const SOLO_WAIT_MS = 5 * 60 * 1000;
    const SOUND_STORAGE_KEY = 'yaziyo-kd-sound';
    const IMLASIZ_IGNORE = /[.,\/#!$%\^&\*;:{}=\-_~()'’"“”\d]/g;

    const SOUND_KEYBOARD = window.YaziyoPaths?.assetHref?.('sound effect/keyboard1.mp3')
        ?? '../../sound effect/keyboard1.mp3';

    const CATEGORIES = {
        ozel: { label: 'Özel Metinler', groups: [
            { id: 'hikaye', label: 'Hikaye' }, { id: 'tekerleme', label: 'Tekerleme' },
            { id: 'harfler', label: 'Harfler' }, { id: 'tersten_metin', label: 'Tersten Metin' },
            { id: 'renkler', label: 'Renkler' }, { id: 'hayvanlar', label: 'Hayvanlar' },
            { id: 'isimler', label: 'İsimler' }, { id: 'bitkiler', label: 'Bitkiler' } ] },
        zabit: { label: 'Zabıt Katipliği', groups: [
            { id: '2026', label: '2026' }, { id: '2025', label: '2025' }, { id: '2023', label: '2023' }, { id: '2022', label: '2022' },
            { id: '2021', label: '2021' }, { id: '2019', label: '2019' }, { id: '2018', label: '2018' },
            { id: '2017_kasim', label: '2017 Kasım' }, { id: '2017_eylul', label: '2017 Eylül' },
            { id: '2016', label: '2016' }, { id: '2015_gys', label: '2015 GYS' }, { id: '2015', label: '2015' },
            { id: '2014', label: '2014' } ] },
        icra: { label: 'İcra Katipliği', groups: [
            { id: '2026', label: '2026' }, { id: '2021', label: '2021' }, { id: '2019', label: '2019' }, { id: '2018', label: '2018' },
            { id: '2017', label: '2017' }, { id: '2016', label: '2016' }, { id: '2015', label: '2015' },
            { id: '2014', label: '2014' } ] },
        cte: { label: 'CTE Katipliği', groups: [
            { id: '2026', label: '2026' }, { id: '2021', label: '2021' }, { id: '2019', label: '2019' }, { id: '2018', label: '2018' },
            { id: '2015', label: '2015' } ] },
        yargitay: { label: 'Yargıtay Metinleri', groups: [{ id: 'yargitay_metni', label: 'Yargıtay Metni' }] },
        danistay: { label: 'Danıştay Metinleri', groups: [{ id: 'danistay_metni', label: 'Danıştay Metni' }] },
        hsk: { label: 'HSK Metinleri', groups: [{ id: '2024', label: '2024' }, { id: '2021', label: '2021' }, { id: '2019', label: '2019' }] },
        yabanci: { label: 'Yabancı', groups: [
            { id: 'almanca', label: 'Almanca' }, { id: 'fransizca', label: 'Fransızca' },
            { id: 'ingilizce', label: 'İngilizce' }, { id: 'ispanyolca', label: 'İspanyolca' },
            { id: 'italyanca', label: 'İtalyanca' }, { id: 'portekizce', label: 'Portekizce' } ] },
    };

    const state = {
        supabase: null,
        userId: null,
        userName: 'Oyuncu',
        avatarUrl: null,
        screen: 'lobby',
        room: null,
        isHost: false,
        channel: null,
        lobbyChannel: null,
        ready: false,
        rivalReady: false,
        rivalPresent: false,
        rivalName: 'Rakip',
        rivalAvatar: null,
        rivalStats: { correct: 0, wrong: 0, combo: 0, wpm: 0, acc: 100, pct: 0, status: 'idle', errors: 0 },
        prevRivalCombo: 0,
        words: [],
        totalWords: 0,
        correctWords: 0,
        wrongWords: 0,
        errorCount: 0,
        combo: 0,
        maxCombo: 0,
        committedCount: 0,
        wordResults: [],
        running: false,
        startedAt: 0,
        durationSec: 60,
        timerInterval: null,
        idleInterval: null,
        lastBroadcast: 0,
        lastInputAt: 0,
        prevLeadSign: 0,
        selfFinal: null,
        rivalFinal: null,
        finishResolveTimer: null,
        resolved: false,
        outcome: null,
        savedResult: false,
        replaySaved: false,
        replayLog: [],
        rematchRequested: false,
        _startScheduled: false,
        _countdownIv: null,
        soundOn: false,
        keyboardAudio: null,
        form: { time: 60, type: 'acik', category: 'ozel', group: 'hikaye', textIndex: 0 },
        pendingJoinRoom: null,
        reconnectTimer: null,
        leaveConfirmTimer: null,
        lastRivalProgressAt: 0,
        ignoreLeaveUntil: 0,
        heartbeatTimer: null,
        matchActive: false,
        cleanedUp: false,
        soloWaitTimer: null,
    };

    const $ = (id) => document.getElementById(id);
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    function escapeHtml(t) {
        const d = document.createElement('div');
        d.textContent = t == null ? '' : String(t);
        return d.innerHTML;
    }

    function DB() { return (typeof metinlerDB !== 'undefined') ? metinlerDB : {}; }

    function normalizeWord(str) {
        if (!str) return '';
        return str.toLocaleLowerCase('tr-TR').replace(IMLASIZ_IGNORE, '');
    }

    function fmtTime(sec) {
        const s = Math.max(0, Math.floor(sec));
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const r = (s % 60).toString().padStart(2, '0');
        return m + ':' + r;
    }

    function calcWpm(correct, elapsedMs) {
        const min = Math.max(1 / 60, elapsedMs / 60000);
        return Math.round(correct / min);
    }

    function calcAcc(correct, wrong) {
        const total = correct + wrong;
        return total > 0 ? Math.round((correct / total) * 100) : 100;
    }

    function calcPct(correct, total) {
        return total > 0 ? Math.min(100, Math.round((correct / total) * 100)) : 0;
    }

    /* ---------------- SES ---------------- */
    function loadSoundPref() {
        state.soundOn = localStorage.getItem(SOUND_STORAGE_KEY) === 'true';
        updateSoundButtons();
    }

    function saveSoundPref() {
        localStorage.setItem(SOUND_STORAGE_KEY, state.soundOn ? 'true' : 'false');
    }

    function updateSoundButtons() {
        const icon = state.soundOn ? 'fa-volume-high' : 'fa-volume-xmark';
        qsa('#kd-sound-toggle, #kd-lobby-sound').forEach((btn) => {
            if (!btn) return;
            btn.innerHTML = `<i class="fa-solid ${icon}"></i>`;
            btn.classList.toggle('text-yaziyo-gold', state.soundOn);
            btn.classList.toggle('border-yaziyo-gold', state.soundOn);
        });
    }

    function ensureKeyboardAudio() {
        if (!state.keyboardAudio) {
            state.keyboardAudio = new Audio(SOUND_KEYBOARD);
            state.keyboardAudio.preload = 'auto';
        }
        return state.keyboardAudio;
    }

    function primeKeyboardAudio() {
        try {
            const base = ensureKeyboardAudio();
            const clip = base.cloneNode();
            clip.volume = 0.01;
            clip.play().then(() => {
                clip.pause();
                clip.currentTime = 0;
            }).catch(() => {});
        } catch (e) {}
    }

    function playKeyboardSound() {
        if (!state.soundOn) return;
        try {
            const base = ensureKeyboardAudio();
            const clip = base.cloneNode();
            clip.volume = 0.28;
            clip.play().catch(() => {});
        } catch (e) {}
    }

    function setSound(on) {
        state.soundOn = on;
        saveSoundPref();
        updateSoundButtons();
        if (on) primeKeyboardAudio();
    }

    /* ---------------- AVATAR ---------------- */
    function setAvatarElement(el, url, name) {
        if (!el) return;
        el.classList.add('overflow-hidden');
        if (url) {
            el.innerHTML = `<img src="${escapeHtml(url)}" alt="" class="w-full h-full object-cover rounded-full">`;
        } else {
            const initial = ((name || 'O').trim().charAt(0) || 'O').toLocaleUpperCase('tr-TR');
            el.innerHTML = `<span class="font-poppins font-bold text-lg">${escapeHtml(initial)}</span>`;
        }
    }

    function getPresencePayload() {
        return {
            userId: state.userId,
            name: state.userName,
            role: state.isHost ? 'host' : 'guest',
            ready: state.ready,
            avatarUrl: state.avatarUrl || null,
        };
    }

    /* ---------------- EKRAN ---------------- */
    function showScreen(name) {
        state.screen = name;
        ['lobby', 'create', 'join', 'room'].forEach((s) => {
            const el = $('kd-screen-' + s);
            if (el) el.classList.toggle('hidden', s !== name);
        });
        if (name !== 'join') teardownLobby();
        if (name === 'join') { setupLobby(); refreshRoomList(); }
        if (name === 'create') initCreateForm();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /* ---------------- CREATE FORM ---------------- */
    let createFormInited = false;
    let validateRoomNameCreate = null;

    function initCreateForm() {
        if (createFormInited) return;
        createFormInited = true;

        const catSel = $('kd-cat-select');
        const grpSel = $('kd-group-select');
        const txtSel = $('kd-text-select');

        Object.entries(CATEGORIES).forEach(([id, def]) => {
            const o = document.createElement('option');
            o.value = id;
            o.textContent = def.label;
            catSel.appendChild(o);
        });

        function fillGroups() {
            const cat = catSel.value;
            grpSel.innerHTML = '';
            (CATEGORIES[cat]?.groups || []).forEach((g) => {
                const o = document.createElement('option');
                o.value = g.id;
                o.textContent = g.label;
                grpSel.appendChild(o);
            });
            fillTexts();
        }

        function fillTexts() {
            const cat = catSel.value;
            const grp = grpSel.value;
            const list = (DB()[cat]?.[grp]) || [];
            txtSel.innerHTML = '';
            if (!list.length) {
                const o = document.createElement('option');
                o.value = '';
                o.textContent = 'Metin bulunamadı';
                txtSel.appendChild(o);
                return;
            }
            list.forEach((item, i) => {
                const o = document.createElement('option');
                o.value = String(i);
                o.textContent = item.id;
                txtSel.appendChild(o);
            });
        }

        catSel.addEventListener('change', fillGroups);
        grpSel.addEventListener('change', fillTexts);
        fillGroups();

        qsa('#kd-create-time .yr-time-opt').forEach((b) => {
            b.addEventListener('click', () => {
                state.form.time = parseInt(b.dataset.time, 10);
                qsa('#kd-create-time .yr-time-opt').forEach((x) => x.classList.toggle('is-active', x === b));
            });
        });
        qs('#kd-create-time .yr-time-opt[data-time="60"]').classList.add('is-active');

        qsa('#kd-create-type .yr-type-opt').forEach((b) => {
            b.addEventListener('click', () => {
                state.form.type = b.dataset.type;
                qsa('#kd-create-type .yr-type-opt').forEach((x) => x.classList.toggle('is-active', x === b));
                $('kd-pass-wrap').classList.toggle('hidden', state.form.type !== 'sifreli');
            });
        });
        qs('#kd-create-type .yr-type-opt[data-type="acik"]').classList.add('is-active');

        $('kd-create-submit').addEventListener('click', onCreateSubmit);

        const nameInput = $('kd-create-name');
        const nameError = $('kd-create-name-error');
        const submitBtn = $('kd-create-submit');
        if (window.YaziyoRoomName && nameInput) {
            validateRoomNameCreate = window.YaziyoRoomName.attachRoomNameInput({
                input: nameInput,
                errorEl: nameError,
                submitBtn,
            });
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', (e) => {
                const check = window.YaziyoRoomName?.validateRoomName(nameInput?.value);
                if (check && !check.valid) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (check.code === 'PROFANITY' && window.YaziyoAlert) {
                        window.YaziyoAlert.showRoomNameModeration(check.error, () => nameInput?.focus());
                    } else if (check.error) {
                        nameInput?.focus();
                        flashInput(nameInput);
                    }
                }
            }, true);
        }
    }

    function showCreateFeedback(message, code) {
        if (code === 'PROFANITY' && window.YaziyoAlert) {
            window.YaziyoAlert.showRoomNameModeration(message, () => $('kd-create-name')?.focus());
            return;
        }
        if (window.YaziyoAlert?.isModerationError?.(message)) {
            window.YaziyoAlert.show({ message, variant: 'moderation', onClose: () => $('kd-create-name')?.focus() });
            return;
        }
        if (window.YaziyoAlert) {
            const variant = code === 'error' ? 'error' : 'warning';
            window.YaziyoAlert.show({ message, variant });
            return;
        }
        alert(message);
    }

    async function onCreateSubmit() {
        const btn = $('kd-create-submit');
        const nameEl = $('kd-create-name');
        const roomCheck = window.YaziyoRoomName
            ? window.YaziyoRoomName.validateRoomName(nameEl?.value)
            : { valid: !!(nameEl?.value || '').trim(), value: (nameEl?.value || '').trim(), error: 'Oda adı boş olamaz.' };

        if (!roomCheck.valid) {
            showCreateFeedback(roomCheck.error, roomCheck.code);
            return;
        }

        const name = roomCheck.value;

        const cat = $('kd-cat-select').value;
        const grp = $('kd-group-select').value;
        const txtIdx = parseInt($('kd-text-select').value, 10);
        const list = (DB()[cat]?.[grp]) || [];
        const item = list[txtIdx];
        if (!item) { showCreateFeedback('Lütfen geçerli bir metin seçin.', 'warning'); return; }

        const time = state.form.time;
        const type = state.form.type;
        const sifre = type === 'sifreli' ? $('kd-create-pass').value.trim() : null;
        if (type === 'sifreli' && !sifre) { flashInput($('kd-create-pass')); $('kd-create-pass').focus(); return; }

        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Oluşturuluyor…';

        try {
            const { data, error } = await state.supabase.rpc('duello_odasi_olustur', {
                p_ad: name,
                p_sure_saniye: time,
                p_kategori: CATEGORIES[cat]?.label || cat,
                p_grup: grp,
                p_metin_index: txtIdx,
                p_metin_adi: item.id,
                p_metin_icerik: item.text,
                p_oda_tipi: type,
                p_sifre: sifre,
            });
            if (error) throw error;
            const room = Array.isArray(data) ? data[0] : data;
            enterRoom(room, true);
        } catch (err) {
            console.error('Oda oluşturma hatası:', err);
            showCreateFeedback(err.message || 'Oda oluşturulamadı.', window.YaziyoAlert?.isModerationError?.(err.message) ? 'PROFANITY' : 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }

    function flashInput(el) {
        el.classList.add('is-error');
        setTimeout(() => el.classList.remove('is-error'), 1200);
    }

    /* ---------------- LOBİ ---------------- */
    function setupLobby() {
        if (state.lobbyChannel) return;
        state.lobbyChannel = state.supabase
            .channel('duello-lobby')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'duello_odalari' }, () => {
                if (state.screen === 'join') refreshRoomList();
            })
            .subscribe();
    }

    function teardownLobby() {
        if (state.lobbyChannel) {
            try { state.supabase.removeChannel(state.lobbyChannel); } catch (e) {}
            state.lobbyChannel = null;
        }
    }

    async function refreshRoomList() {
        const listEl = $('kd-room-list');
        const emptyEl = $('kd-room-empty');
        if (!listEl) return;
        try {
            const { data, error } = await state.supabase.rpc('aktif_duello_odalari');
            if (error) throw error;
            const rooms = (data || []).filter((r) => r.olusturan_id !== state.userId);
            if (!rooms.length) {
                listEl.innerHTML = '';
                listEl.classList.add('hidden');
                emptyEl.classList.remove('hidden');
                emptyEl.classList.add('flex');
                return;
            }
            emptyEl.classList.add('hidden');
            emptyEl.classList.remove('flex');
            listEl.classList.remove('hidden');
            listEl.innerHTML = rooms.map(renderRoomCard).join('');
            qsa('[data-join-id]', listEl).forEach((btn) => {
                btn.addEventListener('click', () => {
                    const room = rooms.find((r) => r.id === btn.dataset.joinId);
                    if (room) attemptJoin(room);
                });
            });
        } catch (err) {
            console.error('Oda listesi hatası:', err);
        }
    }

    function renderRoomCard(r) {
        const sureLabel = r.sure_saniye >= 60 ? `${r.sure_saniye / 60} dk` : `${r.sure_saniye} sn`;
        const tipBadge = r.sifreli
            ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yaziyo-gold/15 text-yaziyo-gold border border-yaziyo-gold/30"><i class="fa-solid fa-lock mr-1"></i>Şifreli</span>'
            : '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"><i class="fa-solid fa-globe mr-1"></i>Açık</span>';
        return `
        <div class="yr-room-card yr-glass p-5 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-2">
                <h3 class="font-poppins font-bold text-light-text dark:text-dark-text truncate">${escapeHtml(r.ad)}</h3>
                ${tipBadge}
            </div>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                <span><i class="fa-solid fa-user text-yaziyo-gold mr-1"></i>${escapeHtml(r.olusturan_ad)}</span>
                <span><i class="fa-solid fa-clock text-yaziyo-gold mr-1"></i>${sureLabel}</span>
                <span><i class="fa-solid fa-book text-yaziyo-gold mr-1"></i>${escapeHtml(r.metin_adi || r.kategori || '—')}</span>
                <span><i class="fa-solid fa-users text-yaziyo-gold mr-1"></i>${r.doluluk}/${r.max_oyuncu}</span>
            </div>
            <div class="flex items-center justify-between mt-1">
                <span class="text-[11px] font-semibold text-emerald-500"><i class="fa-solid fa-circle text-[7px] mr-1 animate-pulse"></i>Rakip bekliyor</span>
                <button data-join-id="${r.id}" class="px-4 py-2 rounded-xl bg-gradient-to-r from-yaziyo-gold to-yellow-600 text-slate-900 font-bold text-sm hover:shadow-glow-gold transition-all">
                    Katıl <i class="fa-solid fa-arrow-right ml-1"></i>
                </button>
            </div>
        </div>`;
    }

    function attemptJoin(room) {
        if (room.sifreli) {
            state.pendingJoinRoom = room;
            openPassModal();
        } else {
            doJoin(room, null);
        }
    }

    function openPassModal() {
        $('kd-pass-input').value = '';
        $('kd-pass-error').classList.add('hidden');
        $('kd-pass-modal').classList.remove('hidden');
        setTimeout(() => $('kd-pass-input').focus(), 50);
    }

    function closePassModal() {
        $('kd-pass-modal').classList.add('hidden');
        state.pendingJoinRoom = null;
    }

    async function doJoin(room, sifre, fromModal = false) {
        try {
            const { data, error } = await state.supabase.rpc('duello_odaya_katil', {
                p_oda_id: room.id,
                p_sifre: sifre,
            });
            if (error) throw error;
            const full = Array.isArray(data) ? data[0] : data;
            if (fromModal) closePassModal();
            enterRoom(full, false);
        } catch (err) {
            console.error('Katılma hatası:', err);
            if (fromModal) {
                $('kd-pass-error').textContent = err.message || 'Katılınamadı';
                $('kd-pass-error').classList.remove('hidden');
                flashInput($('kd-pass-input'));
            } else {
                alert(err.message || 'Odaya katılınamadı.');
                refreshRoomList();
            }
        }
    }

    /* ---------------- ODA / REALTIME ---------------- */
    function enterRoom(room, isHost) {
        state.room = room;
        state.isHost = isHost;
        state.durationSec = room.sure_saniye;
        state.ready = false;
        state.rivalReady = false;
        state.rivalPresent = false;
        state.rivalAvatar = null;
        state.rivalName = isHost ? (room.katilan_ad || 'Rakip') : (room.olusturan_ad || 'Rakip');
        teardownLobby();
        showScreen('room');
        renderRoomScreen();
        joinRoomChannel();
        syncSoloWaitTimer();
    }

    function clearSoloWaitTimer() {
        if (state.soloWaitTimer) {
            clearTimeout(state.soloWaitTimer);
            state.soloWaitTimer = null;
        }
    }

    function startSoloWaitTimer() {
        if (state.soloWaitTimer) return;
        if (state.cleanedUp || state.screen !== 'room' || isInMatch() || state.rivalPresent) return;
        state.soloWaitTimer = setTimeout(() => {
            state.soloWaitTimer = null;
            if (state.cleanedUp || state.screen !== 'room' || isInMatch() || state.rivalPresent) return;
            alert('5 dakika boyunca rakip gelmediği için oda kapatıldı.');
            leaveRoom('lobby');
        }, SOLO_WAIT_MS);
    }

    function syncSoloWaitTimer() {
        if (state.rivalPresent || isInMatch() || state.screen !== 'room') {
            clearSoloWaitTimer();
        } else {
            startSoloWaitTimer();
        }
    }

    function renderRoomScreen() {
        const room = state.room;
        $('kd-room-title').textContent = room.ad;
        const sureLabel = room.sure_saniye >= 60 ? `${room.sure_saniye / 60} dakika` : `${room.sure_saniye} saniye`;
        $('kd-room-meta').innerHTML =
            `<i class="fa-solid fa-clock mr-1 text-yaziyo-gold"></i>${sureLabel} &nbsp;·&nbsp; ` +
            `<i class="fa-solid fa-book mr-1 text-yaziyo-gold"></i>${escapeHtml(room.metin_adi || '')} &nbsp;·&nbsp; ` +
            (room.sifre_hash || room.oda_tipi === 'sifreli'
                ? '<i class="fa-solid fa-lock mr-1 text-yaziyo-gold"></i>Şifreli'
                : '<i class="fa-solid fa-globe mr-1 text-yaziyo-gold"></i>Herkese açık');
        $('kd-slot-host-name').textContent = room.olusturan_ad || 'Oyuncu';
        updateSlots();
    }

    function updateSlots() {
        const room = state.room;
        const hostName = room.olusturan_ad || 'Oyuncu';
        $('kd-slot-host-name').textContent = hostName + (state.isHost ? ' (Sen)' : '');

        const guestPresent = state.isHost ? state.rivalPresent : true;
        const guestName = state.isHost
            ? (state.rivalPresent ? (state.rivalName || room.katilan_ad || 'Rakip') : 'Rakip bekleniyor…')
            : (state.userName + ' (Sen)');
        $('kd-slot-guest-name').textContent = guestName;

        const myReady = state.ready;
        const oppReady = state.rivalReady;
        const hostReady = state.isHost ? myReady : oppReady;
        const guestReady = state.isHost ? oppReady : myReady;

        setSlotStatus($('kd-slot-host-status'), $('kd-slot-host'), true, hostReady);
        setSlotStatus($('kd-slot-guest-status'), $('kd-slot-guest'), guestPresent, guestReady);
        $('kd-slot-guest').classList.toggle('yr-slot-filled', guestPresent);

        const hostAvatarUrl = state.isHost ? state.avatarUrl : state.rivalAvatar;
        const guestAvatarUrl = state.isHost
            ? (guestPresent ? state.rivalAvatar : null)
            : state.avatarUrl;
        setAvatarElement($('kd-slot-host-avatar'), hostAvatarUrl, hostName);
        setAvatarElement($('kd-slot-guest-avatar'), guestPresent ? guestAvatarUrl : null, guestName);

        const bothPresent = state.isHost ? state.rivalPresent : true;
        const readyBtn = $('kd-ready-btn');
        readyBtn.disabled = !bothPresent;
        const span = readyBtn.querySelector('span');
        if (state.ready) {
            span.textContent = 'Hazırsın';
            readyBtn.classList.add('opacity-80');
        } else {
            span.textContent = 'Hazırım';
            readyBtn.classList.remove('opacity-80');
        }

        const hint = $('kd-room-hint');
        if (!bothPresent) hint.textContent = 'Rakip katılınca hazır olabilirsin. 5 dakika kimse gelmezse oda kapanır.';
        else if (!myReady || !oppReady) hint.textContent = 'İki oyuncu da hazır olunca düello başlar.';
        else hint.textContent = 'Düello başlıyor…';
    }

    function setSlotStatus(badge, slotEl, present, ready) {
        slotEl.classList.toggle('yr-slot-ready', present && ready);
        if (!present) {
            badge.textContent = 'Boş';
            badge.className = 'inline-block mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary';
        } else if (ready) {
            badge.textContent = 'Hazır';
            badge.className = 'inline-block mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500';
        } else {
            badge.textContent = 'Bekliyor';
            badge.className = 'inline-block mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-yaziyo-gold/15 text-yaziyo-gold';
        }
    }

    function findRivalPresence(ch) {
        const states = (ch || state.channel)?.presenceState?.() || {};
        for (const key of Object.keys(states)) {
            if (key !== state.userId && states[key]?.[0]) return states[key][0];
        }
        return null;
    }

    function isInMatch() {
        return !!(state.matchActive || state.running || isCountdownOpen());
    }

    function markRivalAlive() {
        cancelLeaveConfirm();
        state.rivalPresent = true;
        state.lastRivalProgressAt = Date.now();
    }

    function sendHeartbeat() {
        if (!state.channel || state.cleanedUp) return;
        try {
            state.channel.send({
                type: 'broadcast',
                event: 'heartbeat',
                payload: { userId: state.userId, t: Date.now() },
            });
        } catch (e) {}
    }

    function stopHeartbeat() {
        if (state.heartbeatTimer) {
            clearInterval(state.heartbeatTimer);
            state.heartbeatTimer = null;
        }
    }

    function startHeartbeat() {
        stopHeartbeat();
        state.lastRivalProgressAt = Date.now();
        sendHeartbeat();
        state.heartbeatTimer = setInterval(() => {
            if (!isInMatch() || state.resolved || state.cleanedUp) {
                stopHeartbeat();
                return;
            }
            sendHeartbeat();
            if (state.lastRivalProgressAt && (Date.now() - state.lastRivalProgressAt) > MATCH_DISCONNECT_MS) {
                state.rivalPresent = false;
                state.rivalReady = false;
                handleRivalLeft();
            }
        }, HEARTBEAT_MS);
    }

    function onHeartbeatMsg(payload) {
        if (!payload || payload.userId === state.userId) return;
        markRivalAlive();
    }

    function cancelLeaveConfirm() {
        if (state.leaveConfirmTimer) {
            clearTimeout(state.leaveConfirmTimer);
            state.leaveConfirmTimer = null;
        }
    }

    function scheduleRivalLeaveConfirm() {
        // Maç/geri sayımda presence leave'e güvenme — heartbeat karar verir
        if (isInMatch()) return;
        if (Date.now() < state.ignoreLeaveUntil) return;
        if (state.resolved || state.cleanedUp) return;
        cancelLeaveConfirm();
        state.leaveConfirmTimer = setTimeout(() => {
            state.leaveConfirmTimer = null;
            confirmRivalLeft();
        }, PRESENCE_LEAVE_DEBOUNCE_MS);
    }

    function applyRivalPresenceMeta(rival) {
        if (!rival) return;
        state.rivalPresent = true;
        state.rivalName = rival.name || state.rivalName;
        state.rivalAvatar = rival.avatarUrl || state.rivalAvatar;
        // Presence yalnızca ready=true latch eder; false broadcast ile gelir
        if (rival.ready) state.rivalReady = true;
        syncSoloWaitTimer();
    }

    function confirmRivalLeft() {
        if (state.resolved || state.cleanedUp) return;
        // Maç sırasında presence tabanlı çıkış yok
        if (isInMatch()) return;

        const rival = findRivalPresence(state.channel);
        if (rival) {
            applyRivalPresenceMeta(rival);
            if (state.screen === 'room') updateSlots();
            if (state.running || state.screen === 'room') updateRivalPanel();
            maybeAutoStart();
            return;
        }

        state.rivalPresent = false;
        state.rivalReady = false;
        if (state.screen === 'room') updateSlots();
        syncSoloWaitTimer();
    }

    function joinRoomChannel() {
        const room = state.room;
        if (state.channel) {
            state.ignoreLeaveUntil = Date.now() + PRESENCE_LEAVE_DEBOUNCE_MS + 500;
            try {
                state.channel.send({
                    type: 'broadcast',
                    event: 'resync',
                    payload: { userId: state.userId, ready: state.ready, reconnecting: true },
                });
            } catch (e) {}
            try { state.supabase.removeChannel(state.channel); } catch (e) {}
            state.channel = null;
        }

        const ch = state.supabase.channel('duello-room-' + room.id, {
            config: { presence: { key: state.userId }, broadcast: { self: false } },
        });

        ch.on('presence', { event: 'sync' }, () => handlePresenceSync(ch))
          .on('presence', { event: 'leave' }, ({ leftPresences }) => handlePresenceLeave(leftPresences))
          .on('broadcast', { event: 'ready' }, ({ payload }) => onReadyMsg(payload))
          .on('broadcast', { event: 'start' }, () => onStartMsg())
          .on('broadcast', { event: 'progress' }, ({ payload }) => onProgressMsg(payload))
          .on('broadcast', { event: 'finish' }, ({ payload }) => onFinishMsg(payload))
          .on('broadcast', { event: 'heartbeat' }, ({ payload }) => onHeartbeatMsg(payload))
          .on('broadcast', { event: 'resync' }, ({ payload }) => onResyncMsg(payload))
          .on('broadcast', { event: 'rematch-request' }, () => onRematchRequest())
          .on('broadcast', { event: 'rematch-accept' }, () => onRematchAccept())
          .on('broadcast', { event: 'rematch-decline' }, () => onRematchDecline())
          .subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                  await ch.track(getPresencePayload());
                  try {
                      ch.send({
                          type: 'broadcast',
                          event: 'resync',
                          payload: { userId: state.userId, ready: state.ready },
                      });
                  } catch (e) {}
              } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                  // Maç sırasında kanal kopması presence leave zinciri başlatmasın
                  if (isInMatch()) {
                      state.ignoreLeaveUntil = Date.now() + RECONNECT_MS + PRESENCE_LEAVE_DEBOUNCE_MS;
                  }
                  scheduleReconnect();
              }
          });

        state.channel = ch;
    }

    function scheduleReconnect() {
        if (state.reconnectTimer || !state.room || state.cleanedUp) return;
        state.ignoreLeaveUntil = Date.now() + RECONNECT_MS + PRESENCE_LEAVE_DEBOUNCE_MS;
        state.reconnectTimer = setTimeout(() => {
            state.reconnectTimer = null;
            if (state.room && !state.cleanedUp) joinRoomChannel();
        }, RECONNECT_MS);
    }

    function handlePresenceSync(ch) {
        const rival = findRivalPresence(ch);
        if (rival) {
            cancelLeaveConfirm();
            applyRivalPresenceMeta(rival);
        } else if (state.rivalPresent && !isInMatch()) {
            // Anlık boş sync = gerçek çıkış demek değil; lobide doğrula
            scheduleRivalLeaveConfirm();
        }
        if (state.screen === 'room') updateSlots();
        if (state.running || state.screen === 'room') updateRivalPanel();
        maybeAutoStart();
    }

    function handlePresenceLeave(leftPresences) {
        const left = (leftPresences || []).some((p) => p.userId && p.userId !== state.userId);
        if (!left) return;
        if (Date.now() < state.ignoreLeaveUntil) return;
        if (isInMatch()) return; // maçta presence leave yok say
        scheduleRivalLeaveConfirm();
    }

    function isCountdownOpen() {
        const c = $('kd-countdown');
        return c && !c.classList.contains('hidden');
    }

    function handleRivalLeft() {
        if (state.resolved) return;
        cancelLeaveConfirm();
        state.matchActive = false;
        stopHeartbeat();
        stopTimers();
        const msg = $('kd-left-msg');
        if (state.running || isCountdownOpen()) {
            if (msg) msg.textContent = 'Rakibin düellodan ayrıldı. Düelloyu kazandın!';
            state.outcome = 'galibiyet';
        } else if (msg) {
            msg.textContent = 'Rakibin odadan ayrıldı.';
        }
        state.running = false;
        hideCountdown();
        $('kd-left-modal').classList.remove('hidden');
    }

    /* ---------------- HAZIR / BAŞLAT ---------------- */
    function toggleReady() {
        if ($('kd-ready-btn').disabled) return;
        state.ready = !state.ready;
        updateSlots();
        if (state.channel) {
            state.channel.send({ type: 'broadcast', event: 'ready', payload: { userId: state.userId, ready: state.ready } });
            try {
                const trackPromise = state.channel.track(getPresencePayload());
                if (trackPromise && typeof trackPromise.catch === 'function') trackPromise.catch(() => {});
            } catch (e) {}
        }
        maybeAutoStart();
    }

    function onReadyMsg(payload) {
        if (!payload || payload.userId === state.userId) return;
        cancelLeaveConfirm();
        state.rivalPresent = true;
        state.rivalReady = !!payload.ready;
        if (state.screen === 'room') updateSlots();
        maybeAutoStart();
    }

    function onResyncMsg(payload) {
        if (!payload || payload.userId === state.userId) return;
        cancelLeaveConfirm();
        state.ignoreLeaveUntil = Date.now() + PRESENCE_LEAVE_DEBOUNCE_MS;
        state.rivalPresent = true;
        if (typeof payload.ready === 'boolean') state.rivalReady = payload.ready;
        if (state.screen === 'room') updateSlots();
        maybeAutoStart();
    }

    function maybeAutoStart() {
        if (!state.isHost) return;
        if (state.screen !== 'room') return;
        if (state._startScheduled || state.running || isCountdownOpen()) return;
        if (state.ready && state.rivalReady && state.rivalPresent && !state.leaveConfirmTimer) {
            state._startScheduled = true;
            setTimeout(() => {
                if (state.ready && state.rivalReady && state.rivalPresent && !state.leaveConfirmTimer && !state.running && state.screen === 'room' && !isCountdownOpen()) {
                    state.channel.send({ type: 'broadcast', event: 'start', payload: { startAt: Date.now() + START_LEAD_MS } });
                    try { state.supabase.rpc('duello_baslat', { p_oda_id: state.room.id }); } catch (e) {}
                    beginDuelSequence();
                } else {
                    state._startScheduled = false;
                }
            }, START_LEAD_MS);
        }
    }

    function onStartMsg() {
        beginDuelSequence();
    }

    /* ---------------- DÜELLO AKIŞI ---------------- */
    function beginDuelSequence() {
        if (state.running || isCountdownOpen() || state.matchActive) return;
        cancelLeaveConfirm();
        state.matchActive = true;
        prepareDuel();
        openWorkspace();
        runCountdown(() => startDuel());
        startHeartbeat();
    }

    function prepareDuel() {
        const text = state.room.metin_icerik || '';
        state.words = text.trim().split(/\s+/).filter((w) => w.length > 0);
        state.totalWords = state.words.length;
        state.correctWords = 0;
        state.wrongWords = 0;
        state.errorCount = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.committedCount = 0;
        state.wordResults = [];
        state.replayLog = [];
        state.replaySaved = false;
        state.prevLeadSign = 0;
        state.prevRivalCombo = 0;
        state.selfFinal = null;
        state.rivalFinal = null;
        state.resolved = false;
        state.outcome = null;
        state.savedResult = false;
        state.rivalStats = { correct: 0, wrong: 0, combo: 0, wpm: 0, acc: 100, pct: 0, status: 'idle', errors: 0 };
        if (state.finishResolveTimer) { clearTimeout(state.finishResolveTimer); state.finishResolveTimer = null; }

        renderDuelText();
        updateProgressBars();
        updateHUD();
        updateRivalPanel();

        const input = $('kd-input');
        input.value = '';
        input.readOnly = true;
        input.placeholder = 'Düello başlayınca buraya yaz…';
        updateRivalPanel();
    }

    function renderDuelText() {
        const content = $('kd-text-content');
        content.innerHTML = state.words
            .map((w, i) => `<span class="kd-word" data-w="${i}">${escapeHtml(w)}</span>`)
            .join(' ');
        window.YaziyoTypingScroll?.resetTypingPanels({
            referenceEl: content,
            userInputEl: $('kd-input'),
            referenceMoveMode: 'transform',
        });
        highlightWord(0);
    }

    function openWorkspace() {
        $('kd-workspace').classList.remove('hidden');
        $('kd-workspace').classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    function closeWorkspace() {
        $('kd-workspace').classList.add('hidden');
        $('kd-workspace').classList.remove('flex');
        document.body.style.overflow = '';
        $('kd-ws-bg').classList.remove('is-dueling');
    }

    function runCountdown(done) {
        const overlay = $('kd-countdown');
        const numEl = $('kd-countdown-num');
        overlay.classList.remove('hidden');
        let n = COUNTDOWN_FROM;
        numEl.textContent = n;
        numEl.classList.remove('yr-shake');
        void numEl.offsetWidth;
        numEl.classList.add('yr-shake');
        if (window.gsap) gsap.fromTo(numEl, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });

        state._countdownIv = setInterval(() => {
            n--;
            if (n > 0) {
                numEl.textContent = n;
                numEl.classList.remove('yr-shake');
                void numEl.offsetWidth;
                numEl.classList.add('yr-shake');
                if (window.gsap) gsap.fromTo(numEl, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
            } else if (n === 0) {
                numEl.textContent = 'BAŞLA!';
                numEl.style.color = 'rgb(var(--yaziyo-green-rgb))';
                if (window.gsap) gsap.fromTo(numEl, { scale: 0.5, opacity: 0 }, { scale: 1.1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)' });
            } else {
                clearInterval(state._countdownIv);
                state._countdownIv = null;
                hideCountdown();
                numEl.style.color = '';
                done();
            }
        }, COUNTDOWN_TICK_MS);
    }

    function hideCountdown() {
        if (state._countdownIv) { clearInterval(state._countdownIv); state._countdownIv = null; }
        $('kd-countdown').classList.add('hidden');
    }

    function startDuel() {
        state.running = true;
        state._startScheduled = false;
        state.startedAt = Date.now();
        state.lastInputAt = Date.now();
        $('kd-input').readOnly = false;
        $('kd-input').focus();
        $('kd-ws-bg').classList.add('is-dueling');
        stopTimers();
        state.timerInterval = setInterval(onTick, COUNTDOWN_TICK_MS);
        state.idleInterval = setInterval(checkIdle, 500);
        updateHUD();
    }

    function onTick() {
        if (!state.running) return;
        const elapsed = (Date.now() - state.startedAt) / 1000;
        const remaining = state.durationSec - elapsed;
        $('kd-hud-time').textContent = fmtTime(remaining);
        $('kd-hud-time').classList.toggle('animate-pulse', remaining <= 10 && remaining > 0);
        if (remaining <= 0) finishDuel();
    }

    function stopTimers() {
        if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
        if (state.idleInterval) { clearInterval(state.idleInterval); state.idleInterval = null; }
    }

    function checkIdle() {
        if (!state.running) return;
        const rivalPanel = $('kd-rival-panel');
        if (!rivalPanel) return;
        const idle = Date.now() - (state.rivalStats.lastActive || 0) > IDLE_MS;
        rivalPanel.classList.toggle('is-idle', idle && state.rivalStats.status !== 'typing');
    }

    /* ---------------- YAZMA MOTORU ---------------- */
    function onInput() {
        if (!state.running) return;
        state.lastInputAt = Date.now();
        playKeyboardSound();

        const val = $('kd-input').value;
        const committed = val.match(/\S+(?=\s)/g) || [];
        syncCommittedWords(committed);
        highlightWord(state.committedCount);
        syncTypingScroll();
        broadcastProgress();
    }

    function syncTypingScroll() {
        const scrollLib = window.YaziyoTypingScroll;
        if (!scrollLib || !state.words?.length) return;
        const input = $('kd-input');
        scrollLib.syncTypingPanels({
            referenceEl: $('kd-text-content'),
            referenceContainer: $('kd-text-card'),
            referenceFullText: state.words.join(' '),
            userInputEl: input,
            typedLen: input.value.length,
            referenceMoveMode: 'transform',
        });
    }

    function clearWordStyle(index) {
        const span = qs(`[data-w="${index}"]`);
        if (!span) return;
        span.classList.remove('kd-word-correct', 'kd-word-wrong');
    }

    function syncCommittedWords(committed) {
        const prevResults = state.wordResults || [];
        const prevCommitted = state.committedCount;
        const newResults = [];
        let correct = 0;
        let wrong = 0;
        let combo = 0;
        let newlyWrong = false;

        const limit = Math.min(committed.length, state.words.length);
        for (let i = 0; i < limit; i++) {
            const expected = state.words[i];
            const typed = committed[i];
            const ok = normalizeWord(typed) === normalizeWord(expected);
            newResults[i] = ok;
            const span = qs(`[data-w="${i}"]`);

            if (ok) {
                correct++;
                combo++;
                if (combo > state.maxCombo) state.maxCombo = combo;
                if (span) {
                    span.classList.add('kd-word-correct');
                    span.classList.remove('kd-word-wrong');
                }
            } else {
                wrong++;
                combo = 0;
                if (span) {
                    span.classList.add('kd-word-wrong');
                    span.classList.remove('kd-word-correct');
                }
                if (prevResults[i] !== false) newlyWrong = true;
            }

            // Yeni commit veya düzeltme kaydı
            if (i >= prevCommitted || prevResults[i] !== ok) {
                state.replayLog.push({
                    word: typed,
                    expected,
                    ts: Date.now() - state.startedAt,
                    correct: ok,
                });
            }
        }

        // Artık commit edilmeyen kelimelerin stilini temizle
        for (let i = limit; i < prevCommitted; i++) {
            clearWordStyle(i);
        }

        state.wordResults = newResults;
        state.correctWords = correct;
        state.wrongWords = wrong;
        state.errorCount = wrong;
        state.combo = combo;
        state.committedCount = limit;

        if (newlyWrong && state.channel && state.running) {
            state.lastBroadcast = 0;
            const p = getProgressPayload();
            p.status = 'error';
            try { state.channel.send({ type: 'broadcast', event: 'progress', payload: p }); } catch (e) {}
        }

        updateProgressBars();
        updateHUD();
    }

    function highlightWord(index) {
        const prev = qs('.kd-word-active');
        if (prev) prev.classList.remove('kd-word-active');
        const cur = qs(`[data-w="${index}"]`);
        if (cur) {
            cur.classList.add('kd-word-active');
        }
    }

    function updateProgressBars() {
        const selfPct = calcPct(state.correctWords, state.totalWords);
        const rivalPct = state.rivalStats.pct || 0;
        $('kd-prog-self').style.width = selfPct + '%';
        $('kd-prog-rival').style.width = rivalPct + '%';
        $('kd-prog-self-pct').textContent = selfPct + '%';
        $('kd-prog-rival-pct').textContent = rivalPct + '%';
        $('kd-prog-self-row').classList.toggle('is-leading', selfPct > rivalPct);
        $('kd-prog-rival-row').classList.toggle('is-leading', rivalPct > selfPct);
    }

    function updateHUD() {
        const elapsed = state.running ? Date.now() - state.startedAt : 0;
        const wpm = calcWpm(state.correctWords, elapsed);
        const acc = calcAcc(state.correctWords, state.wrongWords);
        $('kd-hud-correct').textContent = state.correctWords;
        $('kd-hud-wrong').textContent = state.wrongWords;
        $('kd-hud-acc').textContent = acc + '%';
        $('kd-hud-wpm').textContent = wpm;
        $('kd-hud-errors').textContent = state.errorCount;
        const comboEl = $('kd-hud-combo');
        comboEl.textContent = state.combo;
        comboEl.classList.toggle('yr-combo-hot', state.combo >= COMBO_GLOW_STEP);
        const diff = state.correctWords - (state.rivalStats.correct || 0);
        const diffEl = $('kd-hud-diff');
        diffEl.textContent = (diff > 0 ? '+' : '') + diff;
        diffEl.classList.toggle('text-emerald-500', diff > 0);
        diffEl.classList.toggle('text-red-500', diff < 0);
    }

    function updateRivalPanel() {
        const rs = state.rivalStats;
        $('kd-rival-name').textContent = state.rivalName || 'Rakip';
        setAvatarElement($('kd-rival-avatar'), state.rivalAvatar, state.rivalName);
        $('kd-rival-wpm').textContent = rs.wpm || 0;
        $('kd-rival-acc').textContent = (rs.acc || 100) + '%';
        $('kd-rival-words').textContent = (rs.correct || 0) + (rs.wrong || 0);
        $('kd-rival-correct').textContent = rs.correct || 0;
        $('kd-rival-wrong').textContent = rs.wrong || 0;
        $('kd-rival-combo').textContent = rs.combo || 0;
        $('kd-rival-combo').classList.toggle('yr-combo-hot', (rs.combo || 0) >= COMBO_GLOW_STEP);

        const statusEl = $('kd-rival-status');
        const avatarEl = $('kd-rival-avatar');
        const panel = $('kd-rival-panel');
        const status = rs.status || 'idle';

        statusEl.className = 'kd-status-badge kd-status-badge--' + status;
        if (status === 'typing') {
            statusEl.innerHTML = '<i class="fa-solid fa-keyboard"></i> Yazıyor';
            avatarEl.classList.add('is-typing');
        } else if (status === 'error') {
            statusEl.innerHTML = '<i class="fa-solid fa-xmark"></i> Hata yaptı';
            avatarEl.classList.remove('is-typing');
        } else {
            statusEl.innerHTML = '<i class="fa-solid fa-pause"></i> Durdu';
            avatarEl.classList.remove('is-typing');
        }

        if ((rs.combo || 0) >= COMBO_GLOW_STEP && rs.combo > state.prevRivalCombo) {
            panel.classList.remove('is-combo-glow');
            void panel.offsetWidth;
            panel.classList.add('is-combo-glow');
            setTimeout(() => panel.classList.remove('is-combo-glow'), 600);
        }
        state.prevRivalCombo = rs.combo || 0;
    }

    function getProgressPayload() {
        const elapsed = Date.now() - state.startedAt;
        return {
            userId: state.userId,
            correct: state.correctWords,
            wrong: state.wrongWords,
            combo: state.combo,
            wpm: calcWpm(state.correctWords, elapsed),
            acc: calcAcc(state.correctWords, state.wrongWords),
            pct: calcPct(state.correctWords, state.totalWords),
            errors: state.errorCount,
            status: Date.now() - state.lastInputAt < IDLE_MS ? 'typing' : 'idle',
            lastActive: Date.now(),
            avatarUrl: state.avatarUrl || null,
        };
    }

    function broadcastProgress() {
        const now = Date.now();
        if (now - state.lastBroadcast < PROGRESS_THROTTLE_MS) return;
        state.lastBroadcast = now;
        if (!state.channel || !state.running) return;
        state.channel.send({ type: 'broadcast', event: 'progress', payload: getProgressPayload() });
    }

    function onProgressMsg(payload) {
        if (!payload || payload.userId === state.userId) return;
        markRivalAlive();
        const prevWrong = state.rivalStats.wrong || 0;
        if ((payload.wrong || 0) > prevWrong) payload.status = 'error';
        if (payload.avatarUrl) state.rivalAvatar = payload.avatarUrl;
        state.rivalStats = {
            correct: payload.correct || 0,
            wrong: payload.wrong || 0,
            combo: payload.combo || 0,
            wpm: payload.wpm || 0,
            acc: payload.acc || 100,
            pct: payload.pct || 0,
            errors: payload.errors || 0,
            status: payload.status || 'idle',
            lastActive: payload.lastActive || Date.now(),
        };

        const panel = $('kd-rival-panel');
        if (payload.status === 'error') {
            panel.classList.remove('is-error-flash');
            void panel.offsetWidth;
            panel.classList.add('is-error-flash');
            setTimeout(() => panel.classList.remove('is-error-flash'), 350);
        }

        updateProgressBars();
        updateRivalPanel();
        if (state.running) {
            const lead = state.correctWords - state.rivalStats.correct;
            const sign = lead > 0 ? 1 : lead < 0 ? -1 : 0;
            state.prevLeadSign = sign;
            updateHUD();
        }
    }

    /* ---------------- BİTİŞ / SONUÇ ---------------- */
    function finishDuel() {
        if (!state.running) return;
        state.running = false;
        state.matchActive = false;
        stopHeartbeat();
        stopTimers();
        $('kd-input').readOnly = true;
        $('kd-hud-time').classList.remove('animate-pulse');
        $('kd-ws-bg').classList.remove('is-dueling');

        const elapsed = Date.now() - state.startedAt;
        const wpm = calcWpm(state.correctWords, elapsed);
        const acc = calcAcc(state.correctWords, state.wrongWords);

        state.selfFinal = {
            correct: state.correctWords,
            wrong: state.wrongWords,
            wpm,
            acc,
            combo: state.maxCombo,
            errors: state.errorCount,
            total: state.correctWords + state.wrongWords,
        };

        if (state.channel) {
            state.channel.send({
                type: 'broadcast',
                event: 'finish',
                payload: { userId: state.userId, ...state.selfFinal, status: 'idle' },
            });
        }

        if (state.rivalFinal) resolveResult();
        else state.finishResolveTimer = setTimeout(() => resolveResult(), FINISH_WAIT_MS);
    }

    function onFinishMsg(payload) {
        if (!payload || payload.userId === state.userId) return;
        markRivalAlive();
        state.rivalFinal = {
            correct: payload.correct || 0,
            wrong: payload.wrong || 0,
            wpm: payload.wpm || 0,
            acc: payload.acc || 0,
            combo: payload.combo || 0,
            errors: payload.errors || 0,
            total: (payload.correct || 0) + (payload.wrong || 0),
        };
        state.rivalStats.correct = state.rivalFinal.correct;
        updateProgressBars();
        updateRivalPanel();
        if (state.running) {
            finishDuel();
            return;
        }
        if (state.selfFinal && !state.resolved) resolveResult();
    }

    function resolveResult() {
        if (state.resolved) return;
        state.resolved = true;
        if (state.finishResolveTimer) { clearTimeout(state.finishResolveTimer); state.finishResolveTimer = null; }

        const me = state.selfFinal || { correct: state.correctWords, wrong: state.wrongWords, wpm: 0, acc: 100, combo: state.maxCombo, errors: state.errorCount, total: 0 };
        const rival = state.rivalFinal || { correct: state.rivalStats.correct, wrong: state.rivalStats.wrong, wpm: 0, acc: 100, combo: 0, errors: 0, total: 0 };

        let outcome;
        if (state.outcome) outcome = state.outcome;
        else if (me.correct > rival.correct) outcome = 'galibiyet';
        else if (me.correct < rival.correct) outcome = 'maglubiyet';
        else outcome = 'beraberlik';
        state.outcome = outcome;

        saveReplay(outcome, me);
        showResult(outcome, me, rival);
    }

    async function saveReplay(outcome, stats) {
        if (state.replaySaved || !state.room) return;
        try {
            await state.supabase.rpc('duello_replay_kaydet', {
                p_oda_id: state.room.id,
                p_kelimeler: state.replayLog,
                p_sonuc: outcome,
                p_wpm: stats.wpm || 0,
                p_dogruluk: stats.acc || 0,
            });
            state.replaySaved = true;
        } catch (err) {
            console.warn('Replay kaydı başarısız:', err);
        }
    }

    function showResult(outcome, stats, rival) {
        const diff = (stats.correct || 0) - (rival.correct || 0);
        $('kd-stat-wpm').textContent = stats.wpm || 0;
        $('kd-stat-acc').textContent = (stats.acc || 0) + '%';
        $('kd-stat-total').textContent = stats.total || ((stats.correct || 0) + (stats.wrong || 0));
        $('kd-stat-combo').textContent = stats.combo || 0;
        $('kd-stat-correct').textContent = stats.correct || 0;
        $('kd-stat-wrong').textContent = stats.wrong || 0;
        $('kd-stat-errors').textContent = stats.errors || 0;
        $('kd-stat-diff').textContent = (diff > 0 ? '+' : '') + diff;
        $('kd-stat-diff').classList.toggle('yr-result-stat-value--green', diff > 0);
        $('kd-stat-diff').classList.toggle('yr-result-stat-value--red', diff < 0);

        const title = $('kd-result-title');
        const sub = $('kd-result-sub');
        $('kd-result-stage').innerHTML = resultStageHtml(outcome);
        title.classList.remove('yr-result-outcome--win', 'yr-result-outcome--loss', 'yr-result-outcome--draw');

        if (outcome === 'galibiyet') {
            title.textContent = 'KAZANDIN!';
            title.classList.add('yr-result-outcome--win');
            sub.textContent = 'Arenanın galibi sensin! Muhteşem performans.';
            launchConfetti();
        } else if (outcome === 'maglubiyet') {
            title.textContent = 'KAYBETTİN';
            title.classList.add('yr-result-outcome--loss');
            sub.textContent = 'Rakibin bu sefer daha hızlıydı. Rövanş zamanı!';
        } else {
            title.textContent = 'BERABERE';
            title.classList.add('yr-result-outcome--draw');
            sub.textContent = 'İkiniz de eşit performans gösterdiniz. Çekişmeli düello!';
        }

        $('kd-btn-save').disabled = false;
        $('kd-btn-save').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Sonucu Kaydet';
        $('kd-save-toast').className = 'yr-result-toast hidden';
        $('kd-result-modal').classList.remove('hidden');
    }

    function resultStageHtml(outcome) {
        if (outcome === 'galibiyet') {
            return `<div class="relative w-40 h-40 flex items-center justify-center">
                <i class="fa-solid fa-trophy yr-trophy text-yaziyo-gold" style="font-size:72px"></i>
            </div>`;
        }
        if (outcome === 'maglubiyet') {
            return `<div class="w-40 h-24 flex items-center justify-center">
                <i class="fa-solid fa-keyboard text-light-text-secondary dark:text-dark-text-secondary" style="font-size:56px;opacity:0.5"></i>
            </div>`;
        }
        return `<div class="flex items-end justify-center gap-2">
            <i class="fa-solid fa-handshake text-yaziyo-gold yr-handshake-left" style="font-size:48px"></i>
        </div>`;
    }

    function launchConfetti() {
        if (typeof confetti !== 'function') return;
        const canvas = $('kd-confetti');
        let inst;
        try { inst = confetti.create(canvas, { resize: true, useWorker: true }); }
        catch (e) { inst = confetti; }
        const end = Date.now() + 1500;
        (function frame() {
            inst({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#D97706', '#22D3EE', '#ef4444', '#3b82f6'] });
            inst({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#D97706', '#22D3EE', '#ef4444', '#3b82f6'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        })();
    }

    function closeResultModal() {
        $('kd-result-modal').classList.add('hidden');
    }

    async function saveResult() {
        if (state.savedResult || !state.outcome) return;
        const btn = $('kd-btn-save');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Kaydediliyor…';
        try {
            const { saveYarisDuelloSonucu, isUserLoggedIn, applyProfileStatsUI } = await import('./userStats.js');
            if (!await isUserLoggedIn(state.supabase)) throw new Error('Sonucu kaydetmek için giriş yapmalısınız');

            const me = state.selfFinal || { correct: state.correctWords, wrong: state.wrongWords, combo: state.maxCombo };
            const kelimeSayisi = (me.correct || 0) + (me.wrong || 0);
            const stats = await saveYarisDuelloSonucu(state.supabase, state.outcome, kelimeSayisi, me.combo || state.maxCombo || 0);

            state.savedResult = true;
            if (document.getElementById('profile-total-words')) applyProfileStatsUI(stats);

            const toast = $('kd-save-toast');
            toast.textContent = 'Sonuç profiline kaydedildi ✓';
            toast.className = 'yr-result-toast yr-result-toast--ok';
            toast.classList.remove('hidden');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Kaydedildi';
        } catch (err) {
            console.error('Düello kaydetme hatası:', err);
            $('kd-save-toast').textContent = err.message || 'Kayıt başarısız';
            $('kd-save-toast').className = 'yr-result-toast yr-result-toast--err';
            $('kd-save-toast').classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Sonucu Kaydet';
        }
    }

    /* ---------------- RÖVANŞ ---------------- */
    function requestRematch() {
        if (!state.channel || !state.rivalPresent) {
            $('kd-save-toast').textContent = 'Rakip artık odada değil.';
            $('kd-save-toast').className = 'yr-result-toast yr-result-toast--err';
            $('kd-save-toast').classList.remove('hidden');
            return;
        }
        state.channel.send({ type: 'broadcast', event: 'rematch-request', payload: { userId: state.userId } });
        const btn = $('kd-btn-rematch');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-hourglass-half mr-1"></i> Yanıt bekleniyor…';
    }

    function onRematchRequest() {
        $('kd-rematch-msg').textContent = `${state.rivalName || 'Rakip'} rövanş istiyor!`;
        $('kd-rematch-modal').classList.remove('hidden');
    }

    function onRematchAccept() { beginRematch(); }

    function onRematchDecline() {
        $('kd-btn-rematch').disabled = false;
        $('kd-btn-rematch').innerHTML = '<i class="fa-solid fa-rotate-right"></i> Rövanş İste';
        $('kd-save-toast').textContent = 'Rakip rövanşı reddetti.';
        $('kd-save-toast').className = 'yr-result-toast yr-result-toast--err';
        $('kd-save-toast').classList.remove('hidden');
    }

    function acceptRematch() {
        $('kd-rematch-modal').classList.add('hidden');
        if (state.channel) state.channel.send({ type: 'broadcast', event: 'rematch-accept', payload: { userId: state.userId } });
        beginRematch();
    }

    function declineRematch() {
        $('kd-rematch-modal').classList.add('hidden');
        if (state.channel) state.channel.send({ type: 'broadcast', event: 'rematch-decline', payload: { userId: state.userId } });
    }

    function beginRematch() {
        state.rematchRequested = false;
        state._startScheduled = false;
        $('kd-btn-rematch').disabled = false;
        $('kd-btn-rematch').innerHTML = '<i class="fa-solid fa-rotate-right mr-1"></i> Rövanş İste';
        closeResultModal();
        if (state.isHost) {
            setTimeout(() => {
                if (state.channel) state.channel.send({ type: 'broadcast', event: 'start', payload: { startAt: Date.now() + START_LEAD_MS } });
                beginDuelSequence();
            }, START_LEAD_MS);
        }
    }

    function replayLocal() {
        closeResultModal();
        beginDuelSequence();
    }

    /* ---------------- AYRIL / TEMİZLİK ---------------- */
    async function leaveRoom(toScreen = 'lobby') {
        clearSoloWaitTimer();
        stopTimers();
        hideCountdown();
        state.running = false;
        closeWorkspace();
        closeResultModal();
        $('kd-left-modal').classList.add('hidden');
        $('kd-rematch-modal').classList.add('hidden');

        const room = state.room;
        if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
        cancelLeaveConfirm();
        stopHeartbeat();
        state.matchActive = false;
        state.ignoreLeaveUntil = 0;
        state.lastRivalProgressAt = 0;
        if (state.channel) {
            try { await state.channel.untrack(); } catch (e) {}
            try { state.supabase.removeChannel(state.channel); } catch (e) {}
            state.channel = null;
        }
        if (room) {
            try { await state.supabase.rpc('duello_odadan_ayril', { p_oda_id: room.id }); } catch (e) {}
        }
        state.room = null;
        state.isHost = false;
        state.ready = false;
        state.rivalReady = false;
        state.rivalPresent = false;
        state._startScheduled = false;
        showScreen(toScreen);
    }

    function cleanupOnExit() {
        if (state.cleanedUp) return;
        state.cleanedUp = true;
        state.matchActive = false;
        clearSoloWaitTimer();
        stopHeartbeat();
        try { if (state.channel) state.channel.untrack(); } catch (e) {}
        try { if (state.channel) state.supabase.removeChannel(state.channel); } catch (e) {}
        try { if (state.lobbyChannel) state.supabase.removeChannel(state.lobbyChannel); } catch (e) {}
        if (state.room) {
            try { state.supabase.rpc('duello_odadan_ayril', { p_oda_id: state.room.id }); } catch (e) {}
        }
        stopTimers();
    }

    function preventTextCopy(el) {
        if (!el) return;
        ['copy', 'cut', 'contextmenu', 'selectstart', 'dragstart'].forEach((evt) => {
            el.addEventListener(evt, (e) => e.preventDefault());
        });
    }

    /* ---------------- OLAYLAR ---------------- */
    function bindEvents() {
        qsa('[data-goto]').forEach((b) => {
            b.addEventListener('click', () => {
                const target = b.dataset.goto;
                if (target === 'lobby' && state.room) { leaveRoom('lobby'); return; }
                showScreen(target);
            });
        });

        $('kd-join-refresh').addEventListener('click', refreshRoomList);
        $('kd-pass-submit').addEventListener('click', () => {
            if (state.pendingJoinRoom) doJoin(state.pendingJoinRoom, $('kd-pass-input').value.trim(), true);
        });
        $('kd-pass-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && state.pendingJoinRoom) doJoin(state.pendingJoinRoom, $('kd-pass-input').value.trim(), true);
        });
        qsa('[data-pass-close]').forEach((el) => el.addEventListener('click', closePassModal));

        $('kd-ready-btn').addEventListener('click', toggleReady);
        $('kd-room-leave').addEventListener('click', () => leaveRoom('lobby'));

        $('kd-input').addEventListener('input', onInput);
        preventTextCopy($('kd-text-card'));
        preventTextCopy($('kd-text-content'));

        $('kd-sound-toggle').addEventListener('click', () => setSound(!state.soundOn));
        $('kd-lobby-sound').addEventListener('click', () => setSound(!state.soundOn));
        $('kd-fullscreen').addEventListener('click', toggleFullscreen);
        $('kd-ws-exit').addEventListener('click', () => {
            if (state.running) finishDuel();
            else leaveRoom('lobby');
        });

        $('kd-stats-toggle').addEventListener('click', () => {
            const panel = $('kd-stats-panel');
            const chev = $('kd-stats-chevron');
            panel.classList.toggle('is-collapsed');
            chev.classList.toggle('fa-chevron-down', panel.classList.contains('is-collapsed'));
            chev.classList.toggle('fa-chevron-up', !panel.classList.contains('is-collapsed'));
        });

        $('kd-btn-save').addEventListener('click', saveResult);
        $('kd-btn-rematch').addEventListener('click', requestRematch);
        $('kd-btn-replay').addEventListener('click', replayLocal);
        $('kd-btn-lobby').addEventListener('click', () => leaveRoom('lobby'));
        $('kd-left-ok').addEventListener('click', () => leaveRoom('lobby'));
        $('kd-rematch-accept').addEventListener('click', acceptRematch);
        $('kd-rematch-decline').addEventListener('click', declineRematch);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && state.channel && state.room && !isInMatch()) {
                try {
                    const trackPromise = state.channel.track(getPresencePayload());
                    if (trackPromise && typeof trackPromise.catch === 'function') trackPromise.catch(() => {});
                } catch (e) {}
            }
        });

        window.addEventListener('beforeunload', cleanupOnExit);
        window.addEventListener('pagehide', cleanupOnExit);
    }

    function toggleFullscreen() {
        const ws = $('kd-workspace');
        if (!document.fullscreenElement) {
            (ws.requestFullscreen ? ws.requestFullscreen() : Promise.reject()).catch(() => {});
            $('kd-fullscreen').innerHTML = '<i class="fa-solid fa-compress"></i>';
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            $('kd-fullscreen').innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
    }

    async function resolveUser() {
        try {
            const { data: { user } } = await state.supabase.auth.getUser();
            if (user) {
                state.userId = user.id;
                state.userName = user.user_metadata?.site_full_name || user.user_metadata?.full_name || 'Oyuncu';
                state.avatarUrl = user.user_metadata?.avatar_url || null;
                return true;
            }
        } catch (e) {}
        return false;
    }

    function waitForSupabase(tries = 0) {
        if (window.yaziyoSupabase) {
            state.supabase = window.yaziyoSupabase;
            init();
            return;
        }
        if (tries >= SUPABASE_MAX_TRIES) {
            console.error('Klavye Düellosu: Supabase istemcisi bulunamadı.');
            return;
        }
        setTimeout(() => waitForSupabase(tries + 1), SUPABASE_WAIT_MS);
    }

    async function init() {
        if (!$('kd-screen-lobby')) return;
        loadSoundPref();
        await resolveUser();
        bindEvents();
        showScreen('lobby');
    }

    function boot() {
        if (typeof metinlerDB === 'undefined') {
            setTimeout(boot, 100);
            return;
        }
        waitForSupabase();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
