/* ============================================================ */
/* YAZİYO - ARABA YARIŞI (Gerçek Zamanlı 1v1 Klavye Düellosu)   */
/* Supabase Realtime (presence + broadcast) + GSAP animasyon    */
/* ============================================================ */
(function () {
    'use strict';

    /* ---------------- SABİTLER (magic number yok) ---------------- */
    const SUPABASE_WAIT_MS = 150;
    const SUPABASE_MAX_TRIES = 60;
    const COUNTDOWN_FROM = 3;
    const COUNTDOWN_TICK_MS = 1000;
    const START_LEAD_MS = 700;          // host "start" yayınından önce kısa gecikme
    const PROGRESS_THROTTLE_MS = 70;     // ilerleme yayını min aralık
    const FINISH_WAIT_MS = 4000;         // rakibin finish'i beklenir
    const COMBO_TURBO_STEP = 5;          // her 5 comboda mini turbo
    const SOUND_BASE_VOLUME = 0.32;
    const SOUND_RACE_VOLUME = 0.5;
    const SOUND_FADE_MS = 1200;
    const CAR_LEFT_PAD = 12;
    const CAR_RIGHT_PAD = 30;            // bitiş çizgisi payı
    const CAR_TWEEN_S = 0.45;
    const TIME_OPTIONS = [60, 180, 300];
    // Süreye göre bitiş hedefi (kelime) — arcade hissi için ulaşılabilir mesafe
    const DURATION_TARGET = { 60: 45, 180: 120, 300: 190 };
    const IMLASIZ_IGNORE = /[.,\/#!$%\^&\*;:{}=\-_~()'’"“”\d]/g;

    const SOUND_CAR = '../sound effect/car.mp3';

    // Klavye Çalışması ile aynı kategori yapısı
    const CATEGORIES = {
        "ozel": { label: "Özel Metinler", groups: [
            { id: "hikaye", label: "Hikaye" }, { id: "tekerleme", label: "Tekerleme" },
            { id: "harfler", label: "Harfler" }, { id: "tersten_metin", label: "Tersten Metin" },
            { id: "renkler", label: "Renkler" }, { id: "hayvanlar", label: "Hayvanlar" },
            { id: "isimler", label: "İsimler" }, { id: "bitkiler", label: "Bitkiler" } ] },
        "zabit": { label: "Zabıt Katipliği", groups: [
            { id: "2025", label: "2025" }, { id: "2023", label: "2023" }, { id: "2022", label: "2022" },
            { id: "2021", label: "2021" }, { id: "2019", label: "2019" }, { id: "2018", label: "2018" },
            { id: "2017_kasim", label: "2017 Kasım" }, { id: "2017_eylul", label: "2017 Eylül" },
            { id: "2016", label: "2016" }, { id: "2015_gys", label: "2015 GYS" }, { id: "2015", label: "2015" },
            { id: "2014", label: "2014" } ] },
        "icra": { label: "İcra Katipliği", groups: [
            { id: "2021", label: "2021" }, { id: "2019", label: "2019" }, { id: "2018", label: "2018" },
            { id: "2017", label: "2017" }, { id: "2016", label: "2016" }, { id: "2015", label: "2015" },
            { id: "2014", label: "2014" } ] },
        "cte": { label: "CTE Katipliği", groups: [
            { id: "2021", label: "2021" }, { id: "2019", label: "2019" }, { id: "2018", label: "2018" },
            { id: "2015", label: "2015" } ] },
        "yargitay": { label: "Yargıtay Metinleri", groups: [ { id: "yargitay_metni", label: "Yargıtay Metni" } ] },
        "danistay": { label: "Danıştay Metinleri", groups: [ { id: "danistay_metni", label: "Danıştay Metni" } ] },
        "hsk": { label: "HSK Metinleri", groups: [ { id: "2024", label: "2024" }, { id: "2021", label: "2021" }, { id: "2019", label: "2019" } ] },
        "yabanci": { label: "Yabancı", groups: [
            { id: "almanca", label: "Almanca" }, { id: "fransizca", label: "Fransızca" },
            { id: "ingilizce", label: "İngilizce" }, { id: "ispanyolca", label: "İspanyolca" },
            { id: "italyanca", label: "İtalyanca" }, { id: "portekizce", label: "Portekizce" } ] }
    };

    /* ---------------- DURUM ---------------- */
    const state = {
        supabase: null,
        userId: null,
        userName: 'Oyuncu',
        avatarUrl: null,
        screen: 'lobby',
        // oda
        room: null,            // yaris_odalari satırı
        isHost: false,
        channel: null,
        lobbyChannel: null,
        ready: false,
        rivalReady: false,
        rivalPresent: false,
        rivalName: 'Rakip',
        rivalAvatar: null,
        // yarış
        words: [],
        targetWords: 0,
        correctWords: 0,
        wrongWords: 0,
        combo: 0,
        maxCombo: 0,
        committedCount: 0,
        rivalCorrect: 0,
        running: false,
        startedAt: 0,
        durationSec: 60,
        timerInterval: null,
        lastBroadcast: 0,
        prevLeadSign: 0,
        // finish
        selfFinal: null,
        rivalFinal: null,
        finishResolveTimer: null,
        resolved: false,
        outcome: null,
        savedResult: false,
        // rematch
        rematchRequested: false,
        _startScheduled: false,
        // ses
        soundOn: false,
        engineAudio: null,
        audioCtx: null,
        volTween: null,
        // create form
        form: { time: 60, type: 'acik', category: 'ozel', group: 'hikaye', textIndex: 0 },
        // pending join (şifre modalı)
        pendingJoinRoom: null,
        cleanedUp: false,
    };

    /* ---------------- KISA YARDIMCILAR ---------------- */
    const $ = (id) => document.getElementById(id);
    const qs = (sel, root = document) => root.querySelector(sel);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    function escapeHtml(t) {
        const d = document.createElement('div');
        d.textContent = t == null ? '' : String(t);
        return d.innerHTML;
    }

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

    // metinlerDB klasik script'te top-level const'tur → bare global olarak erişilir
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

    /* ---------------- SES SİSTEMİ ---------------- */
    function ensureAudioCtx() {
        if (!state.audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) state.audioCtx = new Ctx();
        }
        if (state.audioCtx && state.audioCtx.state === 'suspended') state.audioCtx.resume();
        return state.audioCtx;
    }

    function beep(freq, durMs, vol = 0.12) {
        const ctx = ensureAudioCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durMs / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + durMs / 1000);
    }

    function getEngineAudio() {
        if (!state.engineAudio) {
            const a = new Audio(SOUND_CAR);
            a.loop = true;
            a.volume = 0;
            a.preload = 'auto';
            state.engineAudio = a;
        }
        return state.engineAudio;
    }

    function rampVolume(target, ms) {
        const a = state.engineAudio;
        if (!a) return;
        if (state.volTween) clearInterval(state.volTween);
        const start = a.volume;
        const steps = Math.max(1, Math.round(ms / 40));
        let i = 0;
        state.volTween = setInterval(() => {
            i++;
            const t = i / steps;
            a.volume = Math.min(1, Math.max(0, start + (target - start) * t));
            if (i >= steps) {
                clearInterval(state.volTween);
                state.volTween = null;
                if (target === 0) { try { a.pause(); } catch (e) {} }
            }
        }, 40);
    }

    function setSound(on) {
        state.soundOn = on;
        const btn = $('yr-sound-toggle');
        if (btn) {
            btn.innerHTML = on
                ? '<i class="fa-solid fa-volume-high"></i>'
                : '<i class="fa-solid fa-volume-xmark"></i>';
            btn.classList.toggle('text-yaziyo-gold', on);
            btn.classList.toggle('border-yaziyo-gold', on);
        }
        const a = getEngineAudio();
        if (on) {
            a.play().then(() => rampVolume(state.running ? SOUND_RACE_VOLUME : SOUND_BASE_VOLUME, 400)).catch(() => {});
        } else {
            rampVolume(0, 300);
        }
    }

    /* ---------------- EKRAN YÖNETİMİ ---------------- */
    function showScreen(name) {
        state.screen = name;
        ['lobby', 'create', 'join', 'room'].forEach((s) => {
            const el = $('yr-screen-' + s);
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

        const catSel = $('yr-cat-select');
        const grpSel = $('yr-group-select');
        const txtSel = $('yr-text-select');

        Object.entries(CATEGORIES).forEach(([id, def]) => {
            const o = document.createElement('option');
            o.value = id; o.textContent = def.label;
            catSel.appendChild(o);
        });

        function fillGroups() {
            const cat = catSel.value;
            grpSel.innerHTML = '';
            (CATEGORIES[cat]?.groups || []).forEach((g) => {
                const o = document.createElement('option');
                o.value = g.id; o.textContent = g.label;
                grpSel.appendChild(o);
            });
            fillTexts();
        }
        function fillTexts() {
            const cat = catSel.value, grp = grpSel.value;
            const list = (DB()[cat]?.[grp]) || [];
            txtSel.innerHTML = '';
            if (!list.length) {
                const o = document.createElement('option');
                o.value = ''; o.textContent = 'Metin bulunamadı';
                txtSel.appendChild(o);
                return;
            }
            list.forEach((item, i) => {
                const o = document.createElement('option');
                o.value = String(i); o.textContent = item.id;
                txtSel.appendChild(o);
            });
        }
        catSel.addEventListener('change', fillGroups);
        grpSel.addEventListener('change', fillTexts);
        fillGroups();

        // Süre seçenekleri
        qsa('#yr-create-time .yr-time-opt').forEach((b) => {
            b.addEventListener('click', () => {
                state.form.time = parseInt(b.dataset.time, 10);
                qsa('#yr-create-time .yr-time-opt').forEach((x) => x.classList.toggle('is-active', x === b));
            });
        });
        qs('#yr-create-time .yr-time-opt[data-time="60"]').classList.add('is-active');

        // Tip seçenekleri
        qsa('#yr-create-type .yr-type-opt').forEach((b) => {
            b.addEventListener('click', () => {
                state.form.type = b.dataset.type;
                qsa('#yr-create-type .yr-type-opt').forEach((x) => x.classList.toggle('is-active', x === b));
                $('yr-pass-wrap').classList.toggle('hidden', state.form.type !== 'sifreli');
            });
        });
        qs('#yr-create-type .yr-type-opt[data-type="acik"]').classList.add('is-active');

        $('yr-create-submit').addEventListener('click', onCreateSubmit);

        const nameInput = $('yr-create-name');
        const nameError = $('yr-create-name-error');
        const submitBtn = $('yr-create-submit');
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
            window.YaziyoAlert.showRoomNameModeration(message, () => $('yr-create-name')?.focus());
            return;
        }
        if (window.YaziyoAlert?.isModerationError?.(message)) {
            window.YaziyoAlert.show({ message, variant: 'moderation', onClose: () => $('yr-create-name')?.focus() });
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
        const btn = $('yr-create-submit');
        const nameEl = $('yr-create-name');
        const roomCheck = window.YaziyoRoomName
            ? window.YaziyoRoomName.validateRoomName(nameEl?.value)
            : { valid: !!(nameEl?.value || '').trim(), value: (nameEl?.value || '').trim(), error: 'Oda adı boş olamaz.' };

        if (!roomCheck.valid) {
            showCreateFeedback(roomCheck.error, roomCheck.code);
            return;
        }

        const name = roomCheck.value;

        const cat = $('yr-cat-select').value;
        const grp = $('yr-group-select').value;
        const txtIdx = parseInt($('yr-text-select').value, 10);
        const list = (DB()[cat]?.[grp]) || [];
        const item = list[txtIdx];
        if (!item) { showCreateFeedback('Lütfen geçerli bir metin seçin.', 'warning'); return; }

        const time = state.form.time;
        const type = state.form.type;
        const sifre = type === 'sifreli' ? $('yr-create-pass').value.trim() : null;
        if (type === 'sifreli' && !sifre) { flashInput($('yr-create-pass')); $('yr-create-pass').focus(); return; }

        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Oluşturuluyor…';

        try {
            const { data, error } = await state.supabase.rpc('yaris_odasi_olustur', {
                p_ad: name,
                p_sure_saniye: time,
                p_kategori: CATEGORIES[cat]?.label || cat,
                p_grup: grp,
                p_metin_index: txtIdx,
                p_metin_adi: item.id,
                p_metin_icerik: item.text,
                p_yaris_tipi: type,
                p_sifre: sifre,
            });
            if (error) throw error;
            const room = Array.isArray(data) ? data[0] : data;
            enterRoom(room, true);
        } catch (err) {
            console.error('Oda oluşturma hatası:', err);
            showCreateFeedback(err.message || 'Oda oluşturulamadı.', window.YaziyoAlert?.isModerationError?.(err.message) ? 'PROFANITY' : 'error');
            btn.disabled = false;
            btn.innerHTML = origHtml;
        } finally {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }

    function flashInput(el) {
        el.classList.add('is-error');
        setTimeout(() => el.classList.remove('is-error'), 1200);
    }

    /* ---------------- LOBİ (oda listesi + realtime) ---------------- */
    function setupLobby() {
        if (state.lobbyChannel) return;
        const ch = state.supabase
            .channel('yaris-lobby')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'yaris_odalari' }, () => {
                if (state.screen === 'join') refreshRoomList();
            })
            .subscribe();
        state.lobbyChannel = ch;
    }
    function teardownLobby() {
        if (state.lobbyChannel) {
            try { state.supabase.removeChannel(state.lobbyChannel); } catch (e) {}
            state.lobbyChannel = null;
        }
    }

    async function refreshRoomList() {
        const listEl = $('yr-room-list');
        const emptyEl = $('yr-room-empty');
        if (!listEl) return;
        try {
            const { data, error } = await state.supabase.rpc('aktif_yaris_odalari');
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

    /* ---------------- ODAYA KATIL ---------------- */
    function attemptJoin(room) {
        if (room.sifreli) {
            state.pendingJoinRoom = room;
            openPassModal();
        } else {
            doJoin(room, null);
        }
    }

    function openPassModal() {
        const m = $('yr-pass-modal');
        $('yr-pass-input').value = '';
        $('yr-pass-error').classList.add('hidden');
        m.classList.remove('hidden');
        setTimeout(() => $('yr-pass-input').focus(), 50);
    }
    function closePassModal() {
        $('yr-pass-modal').classList.add('hidden');
        state.pendingJoinRoom = null;
    }

    async function doJoin(room, sifre, fromModal = false) {
        try {
            const { data, error } = await state.supabase.rpc('yaris_odaya_katil', {
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
                const e = $('yr-pass-error');
                e.textContent = err.message || 'Katılınamadı';
                e.classList.remove('hidden');
                flashInput($('yr-pass-input'));
            } else {
                alert(err.message || 'Odaya katılınamadı.');
                refreshRoomList();
            }
        }
    }

    /* ---------------- ODA / REALTIME KANAL ---------------- */
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
    }

    function renderRoomScreen() {
        const room = state.room;
        $('yr-room-title').textContent = room.ad;
        const sureLabel = room.sure_saniye >= 60 ? `${room.sure_saniye / 60} dakika` : `${room.sure_saniye} saniye`;
        $('yr-room-meta').innerHTML =
            `<i class="fa-solid fa-clock mr-1 text-yaziyo-gold"></i>${sureLabel} &nbsp;·&nbsp; ` +
            `<i class="fa-solid fa-book mr-1 text-yaziyo-gold"></i>${escapeHtml(room.metin_adi || '')} &nbsp;·&nbsp; ` +
            (room.sifre_hash || room.yaris_tipi === 'sifreli'
                ? '<i class="fa-solid fa-lock mr-1 text-yaziyo-gold"></i>Şifreli'
                : '<i class="fa-solid fa-globe mr-1 text-yaziyo-gold"></i>Herkese açık');

        // Host slot her zaman oluşturan
        $('yr-slot-host-name').textContent = room.olusturan_ad || 'Oyuncu';
        updateSlots();
    }

    function updateSlots() {
        const room = state.room;
        const hostName = room.olusturan_ad || 'Oyuncu';
        const guestSlot = $('yr-slot-guest');
        const guestNameEl = $('yr-slot-guest-name');
        const guestStatus = $('yr-slot-guest-status');
        const hostStatus = $('yr-slot-host-status');

        // İsimler — host/guest bakış açısına göre
        $('yr-slot-host-name').textContent = hostName + (state.isHost ? ' (Sen)' : '');

        const guestPresent = state.isHost ? state.rivalPresent : true; // guest kendisi
        const guestName = state.isHost
            ? (state.rivalPresent ? (state.rivalName || room.katilan_ad || 'Rakip') : 'Rakip bekleniyor…')
            : (state.userName + ' (Sen)');

        guestNameEl.textContent = guestName;

        // Hazır durumları
        const myReady = state.ready;
        const oppReady = state.rivalReady;
        const hostReady = state.isHost ? myReady : oppReady;
        const guestReady = state.isHost ? oppReady : myReady;

        setSlotStatus(hostStatus, $('yr-slot-host'), true, hostReady);
        setSlotStatus(guestStatus, guestSlot, guestPresent, guestReady);

        guestSlot.classList.toggle('yr-slot-filled', guestPresent);

        const hostAvatarUrl = state.isHost ? state.avatarUrl : state.rivalAvatar;
        const guestAvatarUrl = state.isHost
            ? (guestPresent ? state.rivalAvatar : null)
            : state.avatarUrl;
        setAvatarElement($('yr-slot-host-avatar'), hostAvatarUrl, hostName);
        setAvatarElement($('yr-slot-guest-avatar'), guestPresent ? guestAvatarUrl : null, guestName);

        // Hazır butonu sadece iki oyuncu da varsa aktif
        const bothPresent = state.isHost ? state.rivalPresent : true; // guest var demektir
        const readyBtn = $('yr-ready-btn');
        const canReady = bothPresent && (state.isHost ? state.rivalPresent : true);
        readyBtn.disabled = !canReady;
        const span = readyBtn.querySelector('span');
        if (state.ready) {
            span.textContent = 'Hazırsın';
            readyBtn.classList.add('opacity-80');
        } else {
            span.textContent = 'Hazırım';
            readyBtn.classList.remove('opacity-80');
        }

        const hint = $('yr-room-hint');
        if (!bothPresent) hint.textContent = 'Rakip katılınca hazır olabilirsin.';
        else if (!myReady || !oppReady) hint.textContent = 'İki oyuncu da hazır olunca yarış başlar.';
        else hint.textContent = 'Yarış başlıyor…';
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

    function joinRoomChannel() {
        const room = state.room;
        const ch = state.supabase.channel('yaris-room-' + room.id, {
            config: { presence: { key: state.userId }, broadcast: { self: false } },
        });

        ch.on('presence', { event: 'sync' }, () => handlePresenceSync(ch))
          .on('presence', { event: 'leave' }, ({ leftPresences }) => handlePresenceLeave(leftPresences))
          .on('broadcast', { event: 'ready' }, ({ payload }) => onReadyMsg(payload))
          .on('broadcast', { event: 'start' }, ({ payload }) => onStartMsg(payload))
          .on('broadcast', { event: 'progress' }, ({ payload }) => onProgressMsg(payload))
          .on('broadcast', { event: 'finish' }, ({ payload }) => onFinishMsg(payload))
          .on('broadcast', { event: 'rematch-request' }, () => onRematchRequest())
          .on('broadcast', { event: 'rematch-accept' }, () => onRematchAccept())
          .on('broadcast', { event: 'rematch-decline' }, () => onRematchDecline())
          .subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                  await ch.track(getPresencePayload());
              }
          });

        state.channel = ch;
    }

    function handlePresenceSync(ch) {
        const states = ch.presenceState();
        let rival = null;
        Object.keys(states).forEach((key) => {
            if (key !== state.userId && states[key] && states[key][0]) rival = states[key][0];
        });
        const wasPresent = state.rivalPresent;
        state.rivalPresent = !!rival;
        if (rival) {
            state.rivalName = rival.name || state.rivalName;
            state.rivalAvatar = rival.avatarUrl || state.rivalAvatar;
            state.rivalReady = !!rival.ready;
        } else {
            state.rivalReady = false;
        }
        // Rakip yeni katıldıysa label güncelle
        const lbl = qs('[data-label="rival"]');
        if (lbl) lbl.textContent = state.rivalPresent ? (state.rivalName || 'Rakip') : 'Rakip';
        const selfLbl = qs('[data-label="self"]');
        if (selfLbl) selfLbl.textContent = state.userName || 'Sen';

        if (state.screen === 'room') updateSlots();
        // Rakip yarış/sayım sırasında ayrıldıysa
        if (wasPresent && !state.rivalPresent && (state.running || state.screen === 'countdown')) {
            handleRivalLeft();
        }
        maybeAutoStart();
    }

    function handlePresenceLeave(leftPresences) {
        const left = (leftPresences || []).some((p) => p.userId && p.userId !== state.userId);
        if (!left) return;
        state.rivalPresent = false;
        state.rivalReady = false;
        if (state.screen === 'room') updateSlots();
        if (state.running || isCountdownOpen()) handleRivalLeft();
    }

    function isCountdownOpen() {
        const c = $('yr-countdown');
        return c && !c.classList.contains('hidden');
    }

    function handleRivalLeft() {
        if (state.resolved) return;
        // Yarış sırasında rakip ayrıldı → mevcut oyuncu kazanır
        stopTimers();
        const msg = $('yr-left-msg');
        if (state.running || isCountdownOpen()) {
            if (msg) msg.textContent = 'Rakibin yarıştan ayrıldı. Yarışı kazandın!';
            state.outcome = 'galibiyet';
        } else {
            if (msg) msg.textContent = 'Rakibin odadan ayrıldı.';
        }
        state.running = false;
        hideCountdown();
        $('yr-left-modal').classList.remove('hidden');
        rampVolume(0, SOUND_FADE_MS);
    }

    /* ---------------- HAZIR / BAŞLAT ---------------- */
    function toggleReady() {
        if ($('yr-ready-btn').disabled) return;
        state.ready = !state.ready;
        updateSlots();
        if (state.channel) {
            state.channel.track(getPresencePayload());
            state.channel.send({ type: 'broadcast', event: 'ready', payload: { userId: state.userId, ready: state.ready } });
        }
        maybeAutoStart();
    }

    function onReadyMsg(payload) {
        if (!payload || payload.userId === state.userId) return;
        state.rivalReady = !!payload.ready;
        if (state.screen === 'room') updateSlots();
        maybeAutoStart();
    }

    function maybeAutoStart() {
        if (!state.isHost) return;
        if (state.screen !== 'room') return;
        if (state._startScheduled || state.running || isCountdownOpen()) return;
        if (state.ready && state.rivalReady && state.rivalPresent) {
            state._startScheduled = true;
            setTimeout(() => {
                if (state.ready && state.rivalReady && state.rivalPresent && !state.running && state.screen === 'room' && !isCountdownOpen()) {
                    const startAt = Date.now() + START_LEAD_MS;
                    state.channel.send({ type: 'broadcast', event: 'start', payload: { startAt } });
                    beginRaceSequence();
                } else {
                    state._startScheduled = false;
                }
            }, START_LEAD_MS);
        }
    }

    function onStartMsg(payload) {
        beginRaceSequence();
    }

    /* ---------------- YARIŞ AKIŞI ---------------- */
    function beginRaceSequence() {
        if (state.running || isCountdownOpen()) return;
        prepareRace();
        openWorkspace();
        runCountdown(() => startRace());
    }

    function prepareRace() {
        const text = state.room.metin_icerik || '';
        state.words = text.trim().split(/\s+/).filter((w) => w.length > 0);
        const cap = DURATION_TARGET[state.durationSec] || 60;
        state.targetWords = Math.max(10, Math.min(state.words.length, cap));
        state.correctWords = 0;
        state.wrongWords = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.committedCount = 0;
        state.rivalCorrect = 0;
        state.prevLeadSign = 0;
        state.selfFinal = null;
        state.rivalFinal = null;
        state.resolved = false;
        state.outcome = null;
        state.savedResult = false;
        if (state.finishResolveTimer) { clearTimeout(state.finishResolveTimer); state.finishResolveTimer = null; }

        renderTrackText();
        resetCars();
        updateHUD();

        const input = $('yr-input');
        input.value = '';
        input.readOnly = true;
        input.placeholder = 'Yarış başlayınca buraya yaz…';

        const sl = qs('[data-label="self"]'); if (sl) sl.textContent = state.userName || 'Sen';
        const rl = qs('[data-label="rival"]'); if (rl) rl.textContent = state.rivalName || 'Rakip';
    }

    function renderTrackText() {
        const c = $('yr-text-content');
        c.innerHTML = state.words
            .map((w, i) => `<span class="yr-word" data-w="${i}">${escapeHtml(w)}</span>`)
            .join(' ');
        window.YaziyoTypingScroll?.resetTypingPanels({
            referenceEl: c,
            userInputEl: $('yr-input'),
            referenceMoveMode: 'transform',
        });
        highlightWord(0);
    }

    function resetCars() {
        ['self', 'rival'].forEach((who) => {
            const car = qs(`[data-car="${who}"]`);
            const trail = qs(`[data-trail="${who}"]`);
            if (window.gsap) gsap.set(car, { x: 0 });
            else car.style.transform = 'translateX(0)';
            car.style.setProperty('--yr-x', '0px');
            if (trail) trail.style.width = '0px';
        });
    }

    function openWorkspace() {
        const ws = $('yr-workspace');
        ws.classList.remove('hidden');
        ws.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
    function closeWorkspace() {
        const ws = $('yr-workspace');
        ws.classList.add('hidden');
        ws.classList.remove('flex');
        document.body.style.overflow = '';
        $('yr-ws-bg').classList.remove('is-racing');
        qsa('.yr-lane').forEach((l) => l.classList.remove('is-racing'));
    }

    function runCountdown(done) {
        const overlay = $('yr-countdown');
        const numEl = $('yr-countdown-num');
        overlay.classList.remove('hidden');
        ensureAudioCtx();
        let n = COUNTDOWN_FROM;
        numEl.textContent = n;
        numEl.classList.remove('yr-shake');
        void numEl.offsetWidth;
        numEl.classList.add('yr-shake');
        beep(440, 150);
        if (window.gsap) gsap.fromTo(numEl, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });

        const iv = setInterval(() => {
            n--;
            if (n > 0) {
                numEl.textContent = n;
                numEl.classList.remove('yr-shake'); void numEl.offsetWidth; numEl.classList.add('yr-shake');
                beep(440, 150);
                if (window.gsap) gsap.fromTo(numEl, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
            } else if (n === 0) {
                numEl.textContent = 'BAŞLA!';
                numEl.style.color = 'rgb(var(--yaziyo-green-rgb))';
                beep(880, 360, 0.18);
                if (window.gsap) gsap.fromTo(numEl, { scale: 0.5, opacity: 0 }, { scale: 1.1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)' });
            } else {
                clearInterval(iv);
                hideCountdown();
                numEl.style.color = '';
                done();
            }
        }, COUNTDOWN_TICK_MS);
        state._countdownIv = iv;
    }

    function hideCountdown() {
        if (state._countdownIv) { clearInterval(state._countdownIv); state._countdownIv = null; }
        $('yr-countdown').classList.add('hidden');
    }

    function startRace() {
        state.running = true;
        state._startScheduled = false;
        state.startedAt = Date.now();
        const input = $('yr-input');
        input.readOnly = false;
        input.focus();

        $('yr-ws-bg').classList.add('is-racing');
        qsa('.yr-lane').forEach((l) => l.classList.add('is-racing'));

        if (state.soundOn) {
            const a = getEngineAudio();
            a.play().then(() => rampVolume(SOUND_RACE_VOLUME, 600)).catch(() => {});
        }

        stopTimers();
        state.timerInterval = setInterval(onTick, COUNTDOWN_TICK_MS);
        updateHUD();
    }

    function onTick() {
        if (!state.running) return;
        const elapsed = (Date.now() - state.startedAt) / 1000;
        const remaining = state.durationSec - elapsed;
        $('yr-hud-time').textContent = fmtTime(remaining);
        if (remaining <= 10 && remaining > 0) $('yr-hud-time').classList.add('animate-pulse');
        if (remaining <= 0) finishRace(false);
    }

    function stopTimers() {
        if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    }

    /* ---------------- YAZMA / KELİME MOTORU ---------------- */
    function onInput() {
        if (!state.running) return;
        const val = $('yr-input').value;
        // Sonunda boşluk olan (tamamlanmış) kelimeleri yakala
        const committed = val.match(/\S+(?=\s)/g) || [];
        if (committed.length > state.committedCount) {
            for (let i = state.committedCount; i < committed.length; i++) {
                evaluateWord(i, committed[i]);
            }
            state.committedCount = committed.length;
        }
        // Aktif kelime vurgusu
        highlightWord(state.committedCount);
        syncTypingScroll();
    }

    function syncTypingScroll() {
        const scrollLib = window.YaziyoTypingScroll;
        if (!scrollLib || !state.words?.length) return;
        const input = $('yr-input');
        scrollLib.syncTypingPanels({
            referenceEl: $('yr-text-content'),
            referenceContainer: $('yr-text-card'),
            referenceFullText: state.words.join(' '),
            userInputEl: input,
            typedLen: input.value.length,
            referenceMoveMode: 'transform',
        });
    }

    function evaluateWord(index, typed) {
        if (index >= state.words.length) return; // metin bitti
        const expected = state.words[index];
        const ok = normalizeWord(typed) === normalizeWord(expected);
        const span = qs(`[data-w="${index}"]`);

        if (ok) {
            state.correctWords++;
            state.combo++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            if (span) { span.classList.add('yr-word-correct'); span.classList.remove('yr-word-wrong'); }
            carBoost('self', state.combo % COMBO_TURBO_STEP === 0);
            beep(660, 45, 0.05);
            if (state.combo % COMBO_TURBO_STEP === 0) beep(990, 90, 0.08);
        } else {
            state.wrongWords++;
            state.combo = 0;
            if (span) { span.classList.add('yr-word-wrong'); span.classList.remove('yr-word-correct'); }
            carError('self');
            beep(180, 90, 0.06);
        }

        positionCar('self', state.correctWords);
        updateHUD();
        broadcastProgress();

        // Bitiş hedefine ulaşıldı mı?
        if (state.correctWords >= state.targetWords) {
            finishRace(true);
        }
    }

    function highlightWord(index) {
        const prev = qs('.yr-word-active');
        if (prev) prev.classList.remove('yr-word-active');
        const cur = qs(`[data-w="${index}"]`);
        if (cur) {
            cur.classList.add('yr-word-active');
        }
    }

    /* ---------------- ARABA HAREKETİ ---------------- */
    function laneTravel(laneEl, car) {
        const w = laneEl.clientWidth;
        const cw = car.offsetWidth || 88;
        return Math.max(40, w - cw - CAR_LEFT_PAD - CAR_RIGHT_PAD);
    }

    function positionCar(who, correct) {
        const car = qs(`[data-car="${who}"]`);
        const lane = car.closest('.yr-lane');
        const trail = qs(`[data-trail="${who}"]`);
        if (!car || !lane) return;
        const frac = Math.min(1, correct / Math.max(1, state.targetWords));
        const x = frac * laneTravel(lane, car);
        car.style.setProperty('--yr-x', x + 'px');
        if (window.gsap) {
            gsap.to(car, { x, duration: CAR_TWEEN_S, ease: 'power2.out', overwrite: 'auto' });
        } else {
            car.style.transform = `translateX(${x}px)`;
        }
        if (trail) trail.style.width = (x + 20) + 'px';
    }

    function carBoost(who, turbo) {
        const car = qs(`[data-car="${who}"]`);
        if (!car) return;
        car.classList.remove('is-boosting');
        void car.offsetWidth;
        car.classList.add('is-boosting');
        if (turbo) {
            car.classList.remove('is-turbo'); void car.offsetWidth; car.classList.add('is-turbo');
            setTimeout(() => car.classList.remove('is-turbo'), 650);
        }
        setTimeout(() => car.classList.remove('is-boosting'), 480);
    }

    function carError(who) {
        const car = qs(`[data-car="${who}"]`);
        const lane = car ? car.closest('.yr-lane') : null;
        if (!car) return;
        car.classList.remove('is-error'); void car.offsetWidth; car.classList.add('is-error');
        if (lane) { lane.classList.add('is-error-flash'); setTimeout(() => lane.classList.remove('is-error-flash'), 260); }
        setTimeout(() => car.classList.remove('is-error'), 340);
    }

    /* ---------------- HUD ---------------- */
    function updateHUD() {
        $('yr-hud-correct').textContent = state.correctWords;
        $('yr-hud-wrong').textContent = state.wrongWords;
        const total = state.correctWords + state.wrongWords;
        const acc = total > 0 ? Math.round((state.correctWords / total) * 100) : 100;
        $('yr-hud-acc').textContent = acc + '%';
        const elapsedMin = Math.max(1 / 60, (Date.now() - state.startedAt) / 60000);
        const wpm = state.running ? Math.round(state.correctWords / elapsedMin) : 0;
        $('yr-hud-wpm').textContent = wpm;
        const comboEl = $('yr-hud-combo');
        comboEl.textContent = state.combo;
        comboEl.classList.toggle('yr-combo-hot', state.combo >= COMBO_TURBO_STEP);
        const diff = state.correctWords - state.rivalCorrect;
        const diffEl = $('yr-hud-diff');
        diffEl.textContent = (diff > 0 ? '+' : '') + diff;
        diffEl.classList.toggle('text-emerald-500', diff > 0);
        diffEl.classList.toggle('text-red-500', diff < 0);
    }

    /* ---------------- BROADCAST: ilerleme ---------------- */
    function broadcastProgress() {
        const now = Date.now();
        if (now - state.lastBroadcast < PROGRESS_THROTTLE_MS) return;
        state.lastBroadcast = now;
        if (!state.channel) return;
        state.channel.send({
            type: 'broadcast', event: 'progress',
            payload: { userId: state.userId, correct: state.correctWords, wrong: state.wrongWords, combo: state.combo },
        });
    }

    function onProgressMsg(payload) {
        if (!payload || payload.userId === state.userId) return;
        state.rivalCorrect = payload.correct || 0;
        positionCar('rival', state.rivalCorrect);
        // Rakip geçti sesi
        const lead = state.correctWords - state.rivalCorrect;
        const sign = lead > 0 ? 1 : lead < 0 ? -1 : 0;
        if (state.prevLeadSign >= 0 && sign < 0 && state.running) {
            beep(520, 120, 0.08); beep(380, 140, 0.07);
        }
        state.prevLeadSign = sign;
        if (state.running) updateHUD();
    }

    /* ---------------- BİTİŞ / SONUÇ ---------------- */
    function finishRace(completed) {
        if (!state.running) return;
        state.running = false;
        stopTimers();
        $('yr-input').readOnly = true;
        $('yr-hud-time').classList.remove('animate-pulse');
        $('yr-ws-bg').classList.remove('is-racing');
        qsa('.yr-lane').forEach((l) => l.classList.remove('is-racing'));
        rampVolume(0, SOUND_FADE_MS);
        beep(700, 120, 0.1); setTimeout(() => beep(900, 160, 0.12), 130);

        const total = state.correctWords + state.wrongWords;
        const acc = total > 0 ? Math.round((state.correctWords / total) * 100) : 100;
        const elapsedMin = Math.max(1 / 60, (Date.now() - state.startedAt) / 60000);
        const wpm = Math.round(state.correctWords / elapsedMin);

        state.selfFinal = {
            correct: state.correctWords, wrong: state.wrongWords,
            wpm, acc, combo: state.maxCombo, completed: !!completed,
        };

        if (state.channel) {
            state.channel.send({ type: 'broadcast', event: 'finish', payload: { userId: state.userId, ...state.selfFinal } });
        }

        // Rakip finish'i geldiyse hemen çöz, yoksa bekle
        if (state.rivalFinal) {
            resolveResult();
        } else {
            state.finishResolveTimer = setTimeout(() => resolveResult(), FINISH_WAIT_MS);
        }
    }

    function onFinishMsg(payload) {
        if (!payload || payload.userId === state.userId) return;
        state.rivalFinal = {
            correct: payload.correct || 0, wrong: payload.wrong || 0,
            wpm: payload.wpm || 0, acc: payload.acc || 0, combo: payload.combo || 0,
            completed: !!payload.completed,
        };
        state.rivalCorrect = state.rivalFinal.correct;
        positionCar('rival', state.rivalCorrect);
        // Rakip bitirdiyse ben hâlâ yarışıyorsam yarışı sonlandır (kendi finish'imi yayınlar)
        if (state.running) {
            finishRace(false);
            return;
        }
        if (state.selfFinal && !state.resolved) resolveResult();
    }

    function resolveResult() {
        if (state.resolved) return;
        state.resolved = true;
        if (state.finishResolveTimer) { clearTimeout(state.finishResolveTimer); state.finishResolveTimer = null; }

        const me = state.selfFinal || { correct: state.correctWords, wrong: state.wrongWords, wpm: 0, acc: 100, combo: state.maxCombo };
        const rival = state.rivalFinal || { correct: state.rivalCorrect };

        let outcome;
        if (state.outcome) {
            outcome = state.outcome; // rakip ayrıldı → galibiyet
        } else if (me.correct > rival.correct) outcome = 'galibiyet';
        else if (me.correct < rival.correct) outcome = 'maglubiyet';
        else outcome = 'beraberlik';
        state.outcome = outcome;

        showResult(outcome, me);
    }

    function showResult(outcome, stats) {
        const modal = $('yr-result-modal');
        const title = $('yr-result-title');
        const sub = $('yr-result-sub');
        const stage = $('yr-result-stage');

        $('yr-stat-wpm').textContent = stats.wpm || 0;
        $('yr-stat-acc').textContent = (stats.acc || 0) + '%';
        $('yr-stat-combo').textContent = stats.combo || 0;
        $('yr-stat-correct').textContent = stats.correct || 0;
        $('yr-stat-wrong').textContent = stats.wrong || 0;
        $('yr-stat-dist').textContent = stats.correct || 0;

        stage.innerHTML = resultStageHtml(outcome);

        title.classList.remove('yr-result-outcome--win', 'yr-result-outcome--loss', 'yr-result-outcome--draw');
        if (outcome === 'galibiyet') {
            title.textContent = 'KAZANDIN!';
            title.classList.add('yr-result-outcome--win');
            sub.textContent = 'Bitiş çizgisini önce sen geçtin. Şampiyon sensin!';
            launchConfetti();
        } else if (outcome === 'maglubiyet') {
            title.textContent = 'KAYBETTİN';
            title.classList.add('yr-result-outcome--loss');
            sub.textContent = 'Rakibin bu sefer daha hızlıydı. Rövanş zamanı!';
        } else {
            title.textContent = 'BERABERE';
            title.classList.add('yr-result-outcome--draw');
            sub.textContent = 'İkiniz de aynı mesafeyi kat ettiniz. Çekişmeli yarış!';
        }

        // Kaydet butonu durumu
        const saveBtn = $('yr-btn-save');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Sonucu Kaydet';
        $('yr-save-toast').className = 'yr-result-toast hidden';

        modal.classList.remove('hidden');
    }

    function resultStageHtml(outcome) {
        const carSvg = (cls, faceRight = true) => {
            const dir = faceRight ? 'yr-result-car-svg ' : '';
            return `<svg viewBox="0 0 100 48" width="64" class="${dir}${cls}" xmlns="http://www.w3.org/2000/svg"><path d="M4 33 Q5 23 17 23 L31 23 Q41 11 60 12 L75 13 Q88 16 93 26 L96 31 Q99 35 94 38 L9 38 Q2 37 4 33 Z" fill="#ef4444"/><path d="M35 22 Q43 14 58 15 L69 16 L73 23 Z" fill="#e0f2fe"/><circle cx="27" cy="39" r="8" fill="#111827"/><circle cx="75" cy="39" r="8" fill="#111827"/></svg>`;
        };
        if (outcome === 'galibiyet') {
            return `
            <div class="relative w-40 h-40 flex items-center justify-center">
                <i class="fa-solid fa-trophy yr-trophy text-yaziyo-gold" style="font-size:72px"></i>
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="yr-drift-car">${carSvg('')}</div>
                </div>
            </div>`;
        }
        if (outcome === 'maglubiyet') {
            return `
            <div class="relative w-40 h-24 flex items-end justify-center">
                <div class="yr-crash-car">${carSvg('')}</div>
                <i class="fa-solid fa-smog yr-smoke absolute left-1/2 -translate-x-1/2 text-slate-400" style="font-size:34px; bottom:30px"></i>
                <i class="fa-solid fa-burst absolute text-orange-500" style="font-size:26px; top:6px; right:34px"></i>
            </div>`;
        }
        return `
        <div class="flex items-end justify-center gap-1">
            <div class="yr-handshake-left">${carSvg('')}</div>
            <i class="fa-solid fa-handshake text-yaziyo-gold" style="font-size:34px"></i>
            <div class="yr-handshake-right">${carSvg('', false)}</div>
        </div>`;
    }

    function launchConfetti() {
        if (typeof confetti !== 'function') return;
        const canvas = $('yr-confetti');
        let myConfetti;
        try { myConfetti = confetti.create(canvas, { resize: true, useWorker: true }); }
        catch (e) { myConfetti = confetti; }
        const end = Date.now() + 1500;
        (function frame() {
            myConfetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#D97706', '#22D3EE', '#ef4444', '#3b82f6'] });
            myConfetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#D97706', '#22D3EE', '#ef4444', '#3b82f6'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        })();
    }

    function closeResultModal() {
        $('yr-result-modal').classList.add('hidden');
    }

    /* ---------------- SONUÇ KAYDET (Düello) ---------------- */
    async function saveResult() {
        if (state.savedResult || !state.outcome) return;
        const btn = $('yr-btn-save');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Kaydediliyor…';
        try {
            const { saveYarisDuelloSonucu, isUserLoggedIn, applyProfileStatsUI } = await import('./userStats.js');

            if (!await isUserLoggedIn(state.supabase)) {
                throw new Error('Sonucu kaydetmek için giriş yapmalısınız');
            }

            const me = state.selfFinal || {
                correct: state.correctWords,
                wrong: state.wrongWords,
                combo: state.maxCombo,
            };
            const kelimeSayisi = (me.correct || 0) + (me.wrong || 0);
            const maxKombo = me.combo || state.maxCombo || 0;

            const stats = await saveYarisDuelloSonucu(
                state.supabase,
                state.outcome,
                kelimeSayisi,
                maxKombo
            );

            state.savedResult = true;

            if (document.getElementById('profile-total-words')) {
                applyProfileStatsUI(stats);
            }

            const toast = $('yr-save-toast');
            toast.textContent = 'Sonuç profiline kaydedildi ✓';
            toast.className = 'yr-result-toast yr-result-toast--ok';
            toast.classList.remove('hidden');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Kaydedildi';
        } catch (err) {
            console.error('Düello kaydetme hatası:', err);
            const toast = $('yr-save-toast');
            toast.textContent = err.message || 'Kayıt başarısız';
            toast.className = 'yr-result-toast yr-result-toast--err';
            toast.classList.remove('hidden');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Sonucu Kaydet';
        }
    }

    /* ---------------- RÖVANŞ ---------------- */
    function requestRematch() {
        if (!state.channel || !state.rivalPresent) {
            const toast = $('yr-save-toast');
            toast.textContent = 'Rakip artık odada değil.';
            toast.className = 'yr-result-toast yr-result-toast--err';
            toast.classList.remove('hidden');
            return;
        }
        state.rematchRequested = true;
        state.channel.send({ type: 'broadcast', event: 'rematch-request', payload: { userId: state.userId } });
        const btn = $('yr-btn-rematch');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-hourglass-half mr-1"></i> Yanıt bekleniyor…';
    }

    function onRematchRequest() {
        $('yr-rematch-msg').textContent = `${state.rivalName || 'Rakip'} rövanş istiyor!`;
        $('yr-rematch-modal').classList.remove('hidden');
    }

    function onRematchAccept() {
        // Karşı taraf kabul etti (ben istemiştim)
        beginRematch();
    }
    function onRematchDecline() {
        const btn = $('yr-btn-rematch');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Rövanş İste';
        const toast = $('yr-save-toast');
        toast.textContent = 'Rakip rövanşı reddetti.';
        toast.className = 'yr-result-toast yr-result-toast--err';
        toast.classList.remove('hidden');
    }

    function acceptRematch() {
        $('yr-rematch-modal').classList.add('hidden');
        if (state.channel) state.channel.send({ type: 'broadcast', event: 'rematch-accept', payload: { userId: state.userId } });
        beginRematch();
    }
    function declineRematch() {
        $('yr-rematch-modal').classList.add('hidden');
        if (state.channel) state.channel.send({ type: 'broadcast', event: 'rematch-decline', payload: { userId: state.userId } });
    }

    function beginRematch() {
        state.rematchRequested = false;
        state._startScheduled = false;
        const rbtn = $('yr-btn-rematch');
        rbtn.disabled = false;
        rbtn.innerHTML = '<i class="fa-solid fa-rotate-right mr-1"></i> Rövanş İste';
        closeResultModal();
        if (state.isHost) {
            const startAt = Date.now() + START_LEAD_MS;
            setTimeout(() => {
                if (state.channel) state.channel.send({ type: 'broadcast', event: 'start', payload: { startAt } });
                beginRaceSequence();
            }, START_LEAD_MS);
        }
        // guest: 'start' mesajını bekler
    }

    /* ---------------- ODADAN AYRIL / TEMİZLİK ---------------- */
    async function leaveRoom(toScreen = 'lobby') {
        stopTimers();
        hideCountdown();
        state.running = false;
        rampVolume(0, 200);
        closeWorkspace();
        closeResultModal();
        $('yr-left-modal').classList.add('hidden');
        $('yr-rematch-modal').classList.add('hidden');

        const room = state.room;
        if (state.channel) {
            try { await state.channel.untrack(); } catch (e) {}
            try { state.supabase.removeChannel(state.channel); } catch (e) {}
            state.channel = null;
        }
        if (room) {
            try { await state.supabase.rpc('yaris_odadan_ayril', { p_oda_id: room.id }); } catch (e) {}
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
        try { if (state.channel) state.channel.untrack(); } catch (e) {}
        try { if (state.channel) state.supabase.removeChannel(state.channel); } catch (e) {}
        try { if (state.lobbyChannel) state.supabase.removeChannel(state.lobbyChannel); } catch (e) {}
        if (state.room) {
            try {
                // best-effort: sayfa kapanırken odadan çık
                state.supabase.rpc('yaris_odadan_ayril', { p_oda_id: state.room.id });
            } catch (e) {}
        }
        stopTimers();
    }

    /* ---------------- OLAY BAĞLAMA ---------------- */
    function bindEvents() {
        // Lobi / ekran geçiş butonları (data-goto)
        qsa('[data-goto]').forEach((b) => {
            b.addEventListener('click', () => {
                const target = b.dataset.goto;
                if ((target === 'lobby') && state.room) { leaveRoom('lobby'); return; }
                showScreen(target);
            });
        });

        $('yr-join-refresh').addEventListener('click', refreshRoomList);

        // Şifre modalı
        $('yr-pass-submit').addEventListener('click', () => {
            if (state.pendingJoinRoom) doJoin(state.pendingJoinRoom, $('yr-pass-input').value.trim(), true);
        });
        $('yr-pass-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && state.pendingJoinRoom) doJoin(state.pendingJoinRoom, $('yr-pass-input').value.trim(), true);
        });
        qsa('[data-pass-close]').forEach((el) => el.addEventListener('click', closePassModal));

        // Oda
        $('yr-ready-btn').addEventListener('click', toggleReady);
        $('yr-room-leave').addEventListener('click', () => leaveRoom('lobby'));

        // Yarış input
        $('yr-input').addEventListener('input', onInput);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !$('yr-workspace').classList.contains('hidden')) {
                if (state.running) finishRace(false);
            }
        });

        // Workspace kontrolleri
        $('yr-sound-toggle').addEventListener('click', () => setSound(!state.soundOn));
        $('yr-fullscreen').addEventListener('click', toggleFullscreen);
        $('yr-ws-exit').addEventListener('click', () => {
            if (state.running) { finishRace(false); }
            else { leaveRoom('lobby'); }
        });

        // Sonuç modalı butonları
        $('yr-btn-save').addEventListener('click', saveResult);
        $('yr-btn-rematch').addEventListener('click', requestRematch);
        $('yr-btn-lobby').addEventListener('click', () => leaveRoom('lobby'));

        // Rakip ayrıldı modalı
        $('yr-left-ok').addEventListener('click', () => leaveRoom('lobby'));

        // Rövanş modalı
        $('yr-rematch-accept').addEventListener('click', acceptRematch);
        $('yr-rematch-decline').addEventListener('click', declineRematch);

        // Sayfa kapanışı / gizlenme temizliği
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && state.channel && state.room) {
                state.channel.track(getPresencePayload());
            }
        });

        window.addEventListener('beforeunload', cleanupOnExit);
        window.addEventListener('pagehide', cleanupOnExit);
    }

    function toggleFullscreen() {
        const ws = $('yr-workspace');
        if (!document.fullscreenElement) {
            (ws.requestFullscreen ? ws.requestFullscreen() : Promise.reject()).catch(() => {});
            $('yr-fullscreen').innerHTML = '<i class="fa-solid fa-compress"></i>';
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            $('yr-fullscreen').innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
    }

    /* ---------------- BAŞLATMA ---------------- */
    async function resolveUser() {
        try {
            const { data: { user } } = await state.supabase.auth.getUser();
            if (user) {
                state.userId = user.id;
                state.userName = user.user_metadata?.full_name || 'Oyuncu';
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
            console.error('Araba Yarışı: Supabase istemcisi bulunamadı.');
            return;
        }
        setTimeout(() => waitForSupabase(tries + 1), SUPABASE_WAIT_MS);
    }

    async function init() {
        // İçerik yalnızca giriş yapan kullanıcıda görünür (auth.js #yaris-content'i yönetir)
        if (!$('yr-screen-lobby')) return;
        const ok = await resolveUser();
        if (!ok) {
            // Kullanıcı henüz hydrate olmadıysa kısa bir süre sonra tekrar dene
            setTimeout(() => resolveUser(), 800);
        }
        bindEvents();
        showScreen('lobby');
    }

    function boot() {
        // metinlerDB yüklenene kadar bekle (script sırası garanti ama emniyet)
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
