/* ============================================================ */
/* YAZİYO - KELİME EVİ                                           */
/* Klavye Çalışması mantığı + cozy ev inşa oyunu (GSAP)          */
/* ============================================================ */
(function () {
    'use strict';

    const Core = window.YaziyoKlavyeCore;
    if (!Core) {
        console.error('YaziyoKlavyeCore yüklenmedi');
        return;
    }

    const CFG = {
        WORDS_PER_FLOOR: 20,
        COMBO_FLOWER_EVERY: 5,
        COUNTDOWN_FROM: 3,
        COUNTDOWN_MS: 1000,
        PARTICLE_POOL: 24,
        SPARKLE_POOL: 16,
        SKY_PHASE_MS: 45000,
        WPM_SAMPLE_MS: 500,
        SAVE_THUMB_MAX_W: 480,
        SAVE_THUMB_MAX_H: 360,
        SAVE_THUMB_QUALITY: 0.82,
        ANIM_BASE: 0.35,
        ANIM_MIN: 0.12,
        ANIM_MAX: 0.55,
    };

    const SOUND_BIRD = window.YaziyoPaths?.assetHref?.('sound effect/bird.mp3')
        ?? '../../sound effect/bird.mp3';
    const FLOOR_DROP_PX = 72;

    const FLOWER_EMOJI = ['🌸', '🌼', '🌷', '🌻', '🪻'];

    const $ = (id) => document.getElementById(id);

    const state = {
        running: false,
        wordsArray: [],
        originalWords: [],
        timeRemaining: 0,
        initialTime: 0,
        timerId: null,
        correctWords: 0,
        wrongWords: 0,
        prevCorrect: 0,
        prevWrong: 0,
        committedCount: 0,
        combo: 0,
        maxCombo: 0,
        floorCount: 0,
        brickProgress: 0,
        flowersPlaced: 0,
        wpm: 0,
        sessionStart: 0,
        lastWpmSample: 0,
        animSpeed: CFG.ANIM_BASE,
        resultSaved: false,
        pendingSave: null,
        skyPhase: 0,
        skyTimer: null,
        tweens: [],
        audioCtx: null,
        bgAudio: null,
        countdownIv: null,
        sessionToken: 0,
        sessionMeta: { kategori: '', grup: '', metinAdi: '' },
    };

    /* ---------------- DOM refs (lazy) ---------------- */
    let els = {};

    function cacheEls() {
        els = {
            workspace: $('ke-workspace'),
            countdownOverlay: $('ke-countdown-overlay'),
            countdownNumber: $('ke-countdown-number'),
            textContent: $('ke-text-content'),
            textCard: $('ke-text-display-card'),
            userInput: $('ke-user-input'),
            buildPanel: $('ke-build-panel'),
            scene: $('ke-scene'),
            houseWrap: $('ke-house-wrap'),
            garden: $('ke-garden'),
            crane: $('ke-crane'),
            craneRope: $('ke-crane-rope'),
            particles: $('ke-particles'),
            flashError: $('ke-flash-error'),
            glowSuccess: $('ke-glow-success'),
            roof: $('ke-roof'),
            hud: {
                time: $('ke-hud-time'),
                wpm: $('ke-hud-wpm'),
                accuracy: $('ke-hud-accuracy'),
                correct: $('ke-hud-correct'),
                wrong: $('ke-hud-wrong'),
                combo: $('ke-hud-combo'),
                progress: $('ke-hud-progress-fill'),
                progressLabel: $('ke-hud-progress-label'),
            },
        };
    }

    function isImlasizMode() {
        const el = $('punctuation-select');
        return el ? el.value === 'imlasiz' : true;
    }

    function fmtTime(sec) {
        const s = Math.max(0, Math.floor(sec));
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    async function ensureAudioCtx() {
        if (!state.audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) state.audioCtx = new Ctx();
        }
        if (state.audioCtx?.state === 'suspended') {
            try { await state.audioCtx.resume(); } catch (_) { /* ignore */ }
        }
        return state.audioCtx;
    }

    async function playBeep(freq, dur, vol = 0.15) {
        const ctx = await ensureAudioCtx();
        if (!ctx || ctx.state !== 'running') return;
        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur / 1000);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + dur / 1000);
        } catch (_) { /* ignore */ }
    }

    function isSoundOn() {
        const toggle = $('ke-sound-toggle');
        return toggle?.getAttribute('aria-checked') === 'true';
    }

    function ensureBgAudio() {
        if (!state.bgAudio) {
            state.bgAudio = new Audio();
            state.bgAudio.loop = true;
            state.bgAudio.preload = 'auto';
        }
        return state.bgAudio;
    }

    function stopBackgroundAudio() {
        if (!state.bgAudio) return;
        try {
            state.bgAudio.pause();
            state.bgAudio.currentTime = 0;
            state.bgAudio.loop = false;
        } catch (_) { /* ignore */ }
    }

    async function primeBackgroundAudio() {
        if (!isSoundOn()) return;
        const audio = ensureBgAudio();
        audio.src = SOUND_BIRD;
        audio.loop = true;
        const prevVolume = audio.volume;
        audio.volume = 0.01;
        try {
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
        } catch (_) {
            /* mobilde sessiz başlatma engellenirse geri sayım sonrası tekrar denenecek */
        } finally {
            audio.volume = prevVolume || 1;
        }
    }

    function startBackgroundAudio() {
        if (!isSoundOn()) return;
        const audio = ensureBgAudio();
        if (!audio.src || !audio.src.includes('bird.mp3')) {
            audio.src = SOUND_BIRD;
        }
        audio.loop = true;
        audio.play().catch((e) => console.error('Arka plan sesi çalınamadı:', e));
    }

    function initSoundToggle() {
        const toggle = $('ke-sound-toggle');
        const status = $('ke-sound-status');
        if (!toggle) return;

        const setSoundState = (on) => {
            toggle.setAttribute('aria-checked', on ? 'true' : 'false');
            if (status) {
                status.textContent = on ? 'Açık' : 'Kapalı';
                status.classList.toggle('is-on', on);
            }
            if (state.running) {
                if (on) startBackgroundAudio();
                else stopBackgroundAudio();
            }
        };

        toggle.addEventListener('click', () => setSoundState(!isSoundOn()));
        toggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSoundState(!isSoundOn());
            }
        });
    }

    /* ---------------- Dropdown cascade (klavye çalışması ile aynı) ---------------- */
    function initDropdowns() {
        const categorySelect = $('category-select');
        const groupSelect = $('group-select');
        const textSelect = $('text-select');
        const groupTrigger = $('group-select-trigger');
        const groupOptions = $('group-select-options');
        const groupLabel = $('group-select-label');
        const textTrigger = $('text-select-trigger');
        const textOptions = $('text-select-options');
        const textLabel = $('text-select-label');

        function closeAll() {
            groupOptions?.classList.add('hidden');
            textOptions?.classList.add('hidden');
            groupTrigger?.querySelector('i')?.classList.remove('rotate-180');
            textTrigger?.querySelector('i')?.classList.remove('rotate-180');
        }

        groupTrigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            const hidden = groupOptions.classList.contains('hidden');
            closeAll();
            if (hidden) {
                groupOptions.classList.remove('hidden');
                groupTrigger.querySelector('i').classList.add('rotate-180');
            }
        });

        textTrigger?.addEventListener('click', (e) => {
            e.stopPropagation();
            const hidden = textOptions.classList.contains('hidden');
            closeAll();
            if (hidden) {
                textOptions.classList.remove('hidden');
                textTrigger.querySelector('i').classList.add('rotate-180');
            }
        });

        document.addEventListener('click', closeAll);

        function updateTexts() {
            const category = categorySelect.value;
            const group = groupSelect.value;
            const texts = (typeof metinlerDB !== 'undefined' && metinlerDB[category]?.[group]) || [];

            textSelect.innerHTML = '';
            textOptions.innerHTML = '';

            const groups = Core.CATEGORIES[category]?.groups || [];
            if (!groups.length) {
                groupLabel.textContent = 'Seçenek Bulunamadı';
                textLabel.textContent = 'Metin Bulunamadı';
                return;
            }

            groups.forEach((g) => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.label;
                groupSelect.appendChild(opt);

                const item = document.createElement('div');
                item.className = 'ke-dropdown-item';
                item.textContent = g.label;
                item.addEventListener('click', () => {
                    groupSelect.value = g.id;
                    groupLabel.textContent = g.label;
                    groupSelect.dispatchEvent(new Event('change'));
                });
                groupOptions.appendChild(item);
            });

            if (groups.length) {
                groupSelect.value = groups[0].id;
                groupLabel.textContent = groups[0].label;
            }

            texts.forEach((itemData, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                opt.textContent = itemData.id;
                textSelect.appendChild(opt);

                const item = document.createElement('div');
                item.className = 'ke-dropdown-item';
                item.textContent = itemData.id;
                item.addEventListener('click', () => {
                    textSelect.value = index;
                    textLabel.textContent = itemData.id;
                });
                textOptions.appendChild(item);
            });

            if (texts.length) {
                textSelect.value = '0';
                textLabel.textContent = texts[0].id;
            } else {
                textLabel.textContent = 'Metin Bulunamadı';
            }
        }

        function updateGroups() {
            const category = categorySelect.value;
            const groups = Core.CATEGORIES[category]?.groups || [];
            groupSelect.innerHTML = '';
            groupOptions.innerHTML = '';
            groupLabel.textContent = groups.length ? groups[0].label : 'Seçiniz...';

            groups.forEach((g) => {
                const opt = document.createElement('option');
                opt.value = g.id;
                opt.textContent = g.label;
                groupSelect.appendChild(opt);

                const item = document.createElement('div');
                item.className = 'ke-dropdown-item';
                item.textContent = g.label;
                item.addEventListener('click', () => {
                    groupSelect.value = g.id;
                    groupLabel.textContent = g.label;
                    groupSelect.dispatchEvent(new Event('change'));
                });
                groupOptions.appendChild(item);
            });

            if (groups.length) {
                groupSelect.value = groups[0].id;
                groupLabel.textContent = groups[0].label;
            }
            updateTexts();
        }

        categorySelect.addEventListener('change', updateGroups);
        groupSelect.addEventListener('change', updateTexts);
        updateGroups();
    }

    /* ---------------- Ev inşa ---------------- */
    function resetHouse() {
        if (els.houseWrap) els.houseWrap.innerHTML = '';
        if (els.garden) els.garden.innerHTML = '';
        els.roof = null;
        state.floorCount = 0;
        state.brickProgress = 0;
        state.flowersPlaced = 0;
    }

    function createFloorEl(isGround) {
        const floor = document.createElement('div');
        floor.className = 'ke-floor';
        floor.innerHTML = `
            <div class="ke-floor-body">
                <div class="ke-brick-fill"></div>
                <div class="ke-window left"></div>
                <div class="ke-window right"></div>
                ${isGround ? '<div class="ke-door"></div>' : ''}
            </div>`;
        floor.style.opacity = '0';
        floor.style.transform = 'translateY(20px)';
        return floor;
    }

    function ensureGroundFloor() {
        if (state.floorCount > 0) return els.houseWrap.querySelector('.ke-floor');
        const floor = createFloorEl(true);
        els.houseWrap.appendChild(floor);
        state.floorCount = 1;
        gsap.to(floor, { opacity: 1, y: 0, duration: state.animSpeed, ease: 'back.out(1.4)' });
        return floor;
    }

    function getCurrentFloorEl() {
        const floors = els.houseWrap.querySelectorAll('.ke-floor');
        return floors[floors.length - 1] || ensureGroundFloor();
    }

    function updateBrickVisual() {
        const mod = state.correctWords % CFG.WORDS_PER_FLOOR;
        const pct = mod === 0 && state.correctWords > 0 ? 100 : (mod / CFG.WORDS_PER_FLOOR) * 100;
        state.brickProgress = pct;
        const fill = getCurrentFloorEl()?.querySelector('.ke-brick-fill');
        if (fill) fill.style.height = pct + '%';

        const totalFloorsTarget = Math.max(1, Math.ceil(state.correctWords / CFG.WORDS_PER_FLOOR) || 1);
        const overallPct = Math.min(100, ((state.correctWords % CFG.WORDS_PER_FLOOR) / CFG.WORDS_PER_FLOOR) * 100
            + (Math.max(0, state.floorCount - 1) / Math.max(1, totalFloorsTarget)) * 100);
        if (els.hud.progress) els.hud.progress.style.width = Math.min(100, overallPct) + '%';
        if (els.hud.progressLabel) {
            els.hud.progressLabel.textContent = Math.round(Math.min(100, overallPct)) + '%';
        }
    }

    function spawnParticle(x, y, color) {
        if (!els.particles) return;
        const p = document.createElement('div');
        p.className = 'ke-particle';
        const size = 4 + Math.random() * 6;
        p.style.cssText = `width:${size}px;height:${size}px;background:${color};left:${x}px;top:${y}px;`;
        els.particles.appendChild(p);
        gsap.to(p, {
            x: (Math.random() - 0.5) * 40,
            y: -20 - Math.random() * 30,
            opacity: 0,
            duration: 0.5 + Math.random() * 0.3,
            ease: 'power2.out',
            onComplete: () => p.remove(),
        });
    }

    function brickEffect() {
        const floor = getCurrentFloorEl();
        if (!floor) return;
        const rect = floor.getBoundingClientRect();
        const sceneRect = els.scene.getBoundingClientRect();
        const x = rect.left - sceneRect.left + rect.width / 2;
        const y = rect.top - sceneRect.top + rect.height * 0.3;

        for (let i = 0; i < 5; i++) {
            spawnParticle(x + (Math.random() - 0.5) * 30, y, '#D4A574');
        }

        gsap.fromTo(floor, { scale: 1.015 }, { scale: 1, duration: state.animSpeed * 0.5, ease: 'power2.out' });

        if (els.glowSuccess) {
            gsap.fromTo(els.glowSuccess, { opacity: 0.6 }, { opacity: 0, duration: 0.5 });
        }
    }

    function wrongEffect() {
        if (!els.flashError) return;
        gsap.killTweensOf(els.flashError);
        gsap.fromTo(els.flashError, { opacity: 0.45 }, { opacity: 0, duration: 0.35, ease: 'power2.out' });
    }

    function getCommittedWords(typed) {
        return typed.match(/\S+(?=\s)/g) || [];
    }

    function wordsMatch(typedWord, expectedWord) {
        const isImlasiz = isImlasizMode();
        return Core.normalizeForComparison(typedWord, isImlasiz)
            === Core.normalizeForComparison(expectedWord, isImlasiz);
    }

    /** Ardışık doğru kelime serisini committed listesinden hesaplar */
    function syncComboFromCommitted(committed) {
        let streak = 0;
        for (let i = 0; i < committed.length; i++) {
            const expected = state.wordsArray[i];
            if (!expected) break;
            if (wordsMatch(committed[i], expected)) {
                streak++;
            } else {
                streak = 0;
            }
        }
        state.combo = streak;
        if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    }

    /** Boşlukla tamamlanan kelimeler üzerinden combo */
    function processCommittedWords(typed) {
        const committed = getCommittedWords(typed);

        if (committed.length < state.committedCount) {
            state.committedCount = committed.length;
            syncComboFromCommitted(committed);
            updateHud();
            return;
        }

        let changed = false;
        while (state.committedCount < committed.length) {
            const idx = state.committedCount;
            const expected = state.wordsArray[idx];
            if (!expected) break;

            const typedWord = committed[idx];
            if (wordsMatch(typedWord, expected)) {
                state.combo++;
                if (state.combo > state.maxCombo) state.maxCombo = state.combo;
                if (state.combo % CFG.COMBO_FLOWER_EVERY === 0) {
                    addFlower();
                    sparkleCombo();
                    lightWindows();
                }
            } else {
                state.combo = 0;
                wrongEffect();
            }

            state.committedCount++;
            changed = true;
        }

        if (changed) updateHud();
    }

    function addFloorWithCrane() {
        return new Promise((resolve) => {
            const newFloor = createFloorEl(false);
            els.houseWrap.appendChild(newFloor);
            state.floorCount++;

            gsap.set(newFloor, { y: -FLOOR_DROP_PX, opacity: 0.9 });

            if (els.crane) {
                els.crane.style.opacity = '1';
                gsap.set(els.craneRope, { height: 0 });
                gsap.to(els.craneRope, {
                    height: FLOOR_DROP_PX + 16,
                    duration: state.animSpeed * 1.1,
                    ease: 'power2.inOut',
                });
            }

            gsap.to(newFloor, {
                y: 0,
                opacity: 1,
                duration: state.animSpeed * 1.25,
                delay: state.animSpeed * 0.2,
                ease: 'power2.out',
                onComplete: () => {
                    gsap.set(newFloor, { clearProps: 'transform,opacity' });
                    const fill = newFloor.querySelector('.ke-brick-fill');
                    if (fill) fill.style.height = '0%';
                    if (els.crane) {
                        gsap.to(els.craneRope, { height: 0, duration: state.animSpeed * 0.7, delay: 0.15 });
                        gsap.to(els.crane, { opacity: 0, duration: 0.35, delay: state.animSpeed * 0.8 });
                    }
                    resolve();
                },
            });
        });
    }

    function addFloorDirect() {
        const floor = createFloorEl(false);
        els.houseWrap.appendChild(floor);
        state.floorCount++;
        gsap.to(floor, { opacity: 1, y: 0, duration: state.animSpeed, ease: 'back.out(1.4)' });
    }

    async function onCorrectWord(count) {
        const startCorrect = state.correctWords - count;
        for (let i = 0; i < count; i++) {
            const wordTotal = startCorrect + i + 1;

            ensureGroundFloor();
            updateBrickVisual();
            brickEffect();

            if (wordTotal > 0 && wordTotal % CFG.WORDS_PER_FLOOR === 0) {
                await addFloorWithCrane();
            }
        }
        updateHud();
    }

    function addFlower() {
        if (!els.garden) return;
        const f = document.createElement('span');
        f.className = 'ke-flower';
        f.textContent = FLOWER_EMOJI[state.flowersPlaced % FLOWER_EMOJI.length];
        state.flowersPlaced++;
        els.garden.appendChild(f);
        gsap.to(f, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(2)' });
    }

    function sparkleCombo() {
        if (!els.particles || !els.scene) return;
        const rect = els.scene.getBoundingClientRect();
        for (let i = 0; i < 8; i++) {
            const s = document.createElement('div');
            s.className = 'ke-sparkle';
            s.style.left = (rect.width * 0.3 + Math.random() * rect.width * 0.4) + 'px';
            s.style.top = (rect.height * 0.2 + Math.random() * rect.height * 0.3) + 'px';
            els.particles.appendChild(s);
            gsap.to(s, {
                y: -30 - Math.random() * 40,
                x: (Math.random() - 0.5) * 50,
                opacity: 0,
                scale: 0,
                duration: 0.6 + Math.random() * 0.4,
                ease: 'power2.out',
                onComplete: () => s.remove(),
            });
        }
    }

    function lightWindows() {
        els.houseWrap.querySelectorAll('.ke-window').forEach((w) => {
            w.classList.add('lit');
            gsap.fromTo(w, { scale: 1 }, { scale: 1.15, duration: 0.2, yoyo: true, repeat: 1 });
        });
    }

    function setAnimSpeedFromWpm() {
        const ratio = Math.min(1, state.wpm / 80);
        state.animSpeed = CFG.ANIM_MAX - ratio * (CFG.ANIM_MAX - CFG.ANIM_MIN);
    }

    /* ---------------- Gökyüzü ---------------- */
    function initSky() {
        const panel = els.buildPanel;
        if (!panel) return;

        state.skyPhase = 0;
        panel.classList.remove('phase-dusk', 'phase-night');

        document.querySelectorAll('.ke-star').forEach((s) => {
            gsap.to(s, { opacity: 0.7, duration: 1, delay: Math.random() * 2 });
        });

        gsap.to('.ke-cloud-1', { x: 30, duration: 25, repeat: -1, yoyo: true, ease: 'sine.inOut' });
        gsap.to('.ke-cloud-2', { x: -25, duration: 32, repeat: -1, yoyo: true, ease: 'sine.inOut' });

        gsap.to('.ke-bird', {
            x: '+=120',
            duration: 8,
            repeat: -1,
            ease: 'none',
            stagger: { each: 2.5, from: 'random' },
        });

        if (state.skyTimer) clearInterval(state.skyTimer);
        state.skyTimer = setInterval(advanceSkyPhase, CFG.SKY_PHASE_MS);
    }

    function advanceSkyPhase() {
        if (!state.running) return;
        state.skyPhase = (state.skyPhase + 1) % 3;
        const panel = els.buildPanel;
        panel.classList.remove('phase-dusk', 'phase-night');
        const sun = panel.querySelector('.ke-sun');
        const moon = panel.querySelector('.ke-moon');

        if (state.skyPhase === 1) {
            panel.classList.add('phase-dusk');
            gsap.to(sun, { opacity: 0.5, scale: 0.8, duration: 2 });
        } else if (state.skyPhase === 2) {
            panel.classList.add('phase-night');
            gsap.to(sun, { opacity: 0, duration: 1.5 });
            gsap.to(moon, { opacity: 1, duration: 1.5 });
            document.querySelectorAll('.ke-star').forEach((s) => gsap.to(s, { opacity: 0.8, duration: 1 }));
        } else {
            gsap.to(sun, { opacity: 1, scale: 1, duration: 2 });
            gsap.to(moon, { opacity: 0, duration: 1 });
            document.querySelectorAll('.ke-star').forEach((s) => gsap.to(s, { opacity: 0, duration: 1 }));
        }
    }

    function stopSky() {
        if (state.skyTimer) {
            clearInterval(state.skyTimer);
            state.skyTimer = null;
        }
        gsap.killTweensOf('.ke-cloud-1, .ke-cloud-2, .ke-bird');
    }

    /* ---------------- Typing session ---------------- */
    function prepareWordsDOM(rawText) {
        const processed = rawText.trim().replace(/\s+/g, ' ');
        state.displayText = processed;
        state.wordsArray = processed.split(' ').filter(w => w.length > 0);
        let html = '';
        state.wordsArray.forEach((w, idx) => {
            html += `<span id="word-${idx}" class="inline-block transition-all duration-200">${w}</span> `;
        });
        els.textContent.innerHTML = html;
        window.YaziyoTypingScroll?.resetTypingPanels({
            referenceEl: els.textContent,
            userInputEl: els.userInput,
            referenceMoveMode: 'transform',
        });
    }

    function syncTypingScroll() {
        const scrollLib = window.YaziyoTypingScroll;
        if (!scrollLib || !state.displayText) return;
        scrollLib.syncTypingPanels({
            referenceEl: els.textContent,
            referenceContainer: $('ke-text-display-card'),
            referenceFullText: state.displayText,
            userInputEl: els.userInput,
            typedLen: els.userInput?.value.length || 0,
            referenceMoveMode: 'transform',
        });
    }

    function updateHud() {
        const net = Math.max(0, state.correctWords - state.wrongWords);
        const total = state.correctWords + state.wrongWords;
        const acc = total > 0 ? Math.round((state.correctWords / total) * 100) : 100;

        if (els.hud.time) els.hud.time.textContent = fmtTime(state.timeRemaining);
        if (els.hud.wpm) els.hud.wpm.textContent = String(state.wpm);
        if (els.hud.accuracy) els.hud.accuracy.textContent = acc + '%';
        if (els.hud.correct) els.hud.correct.textContent = String(state.correctWords);
        if (els.hud.wrong) els.hud.wrong.textContent = String(state.wrongWords);
        if (els.hud.combo) els.hud.combo.textContent = String(state.combo);
    }

    function handleInput() {
        if (!state.running) return;
        const typed = els.userInput.value;

        processCommittedWords(typed);

        const isImlasiz = isImlasizMode();
        const live = Core.evaluateExamText(state.wordsArray, typed, isImlasiz, {});

        const newCorrect = live.correct - state.prevCorrect;
        const newWrong = live.wrong - state.prevWrong;

        const applyStats = () => {
            const elapsed = (Date.now() - state.sessionStart) / 60000;
            if (elapsed > 0) {
                const net = Math.max(0, live.correct - live.wrong);
                state.wpm = Math.round(net / elapsed);
                setAnimSpeedFromWpm();
            }
            updateHud();
            updateBrickVisual();
        };

        if (newCorrect > 0) {
            state.correctWords = live.correct;
            state.wrongWords = live.wrong;
            state.prevCorrect = live.correct;
            state.prevWrong = live.wrong;
            onCorrectWord(newCorrect).then(() => {
                applyStats();
                syncTypingScroll();
            });
            return;
        }

        if (newWrong > 0) {
            state.wrongWords = live.wrong;
            state.correctWords = live.correct;
        } else {
            state.correctWords = live.correct;
            state.wrongWords = live.wrong;
        }

        state.prevCorrect = live.correct;
        state.prevWrong = live.wrong;
        applyStats();
        syncTypingScroll();
    }

    function handleTick() {
        if (!state.running) return;
        state.timeRemaining--;
        updateHud();
        if (state.timeRemaining <= 0) endSession();
    }

    function cancelCountdown() {
        if (state.countdownIv) {
            clearInterval(state.countdownIv);
            state.countdownIv = null;
        }
        if (els.countdownOverlay) {
            els.countdownOverlay.classList.add('hidden');
        }
        if (els.countdownNumber) {
            els.countdownNumber.style.color = '';
        }
    }

    function isSessionActive(token) {
        return token === state.sessionToken
            && els.workspace
            && !els.workspace.classList.contains('hidden');
    }

    function startCountdown(sessionToken) {
        cancelCountdown();
        els.countdownOverlay.classList.remove('hidden');
        let count = CFG.COUNTDOWN_FROM;
        els.countdownNumber.textContent = count;
        playBeep(440, 150);

        state.countdownIv = setInterval(() => {
            if (!isSessionActive(sessionToken)) {
                cancelCountdown();
                return;
            }
            count--;
            if (count > 0) {
                els.countdownNumber.textContent = count;
                playBeep(440, 150);
            } else if (count === 0) {
                els.countdownNumber.textContent = 'BAŞLA!';
                els.countdownNumber.style.color = '#15803D';
                playBeep(880, 400, 0.2);
            } else {
                cancelCountdown();
                if (isSessionActive(sessionToken)) beginSession(sessionToken);
            }
        }, CFG.COUNTDOWN_MS);
    }

    function beginSession(sessionToken) {
        if (!isSessionActive(sessionToken)) {
            stopBackgroundAudio();
            return;
        }
        state.running = true;
        state.sessionStart = Date.now();
        els.userInput.readOnly = false;
        els.userInput.focus();
        state.timerId = setInterval(handleTick, 1000);

        startBackgroundAudio();

        initSky();
        ensureGroundFloor();
        updateHud();
    }

    async function startSession() {
        cacheEls();
        const category = $('category-select').value;
        const group = $('group-select').value;
        const textIndex = $('text-select').value;
        const timeVal = parseInt($('time-select').value, 10);

        const catDef = Core.CATEGORIES[category];
        state.sessionMeta.kategori = catDef ? catDef.label : category;
        state.sessionMeta.grup = $('group-select-label')?.textContent || group;
        state.sessionMeta.metinAdi = $('text-select-label')?.textContent || '';

        if (!metinlerDB[category]?.[group]?.[textIndex]) {
            alert('Lütfen geçerli bir metin seçiniz.');
            return;
        }

        await ensureAudioCtx();
        await primeBackgroundAudio();

        const rawText = metinlerDB[category][group][textIndex].text;
        state.originalWords = rawText.trim().split(/\s+/).filter(w => w.length > 0);
        prepareWordsDOM(rawText);

        state.correctWords = 0;
        state.wrongWords = 0;
        state.prevCorrect = 0;
        state.prevWrong = 0;
        state.committedCount = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.wpm = 0;
        state.timeRemaining = timeVal;
        state.initialTime = timeVal;
        state.resultSaved = false;
        state.pendingSave = null;

        els.userInput.value = '';
        els.userInput.readOnly = true;
        resetHouse();

        if (els.buildPanel) gsap.set(els.buildPanel, { clearProps: 'transform' });

        const sessionToken = ++state.sessionToken;
        els.workspace.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        startCountdown(sessionToken);
    }

    async function playCompletionAnimation() {
        let roof = $('ke-roof');
        if (!roof && els.houseWrap) {
            roof = document.createElement('div');
            roof.id = 'ke-roof';
            roof.className = 'ke-roof';
            els.houseWrap.appendChild(roof);
            els.roof = roof;
        }
        if (roof) {
            roof.classList.add('visible');
            gsap.fromTo(roof, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.5)' });
        }

        lightWindows();
        els.houseWrap.querySelectorAll('.ke-window').forEach(w => w.classList.add('lit'));

        gsap.to(els.scene, { scale: 1.06, duration: 1.2, ease: 'power2.inOut', yoyo: true, repeat: 1 });

        if (typeof confetti === 'function') {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.55 }, colors: ['#D97706', '#FBBF24', '#F5E6D3', '#7CB342'] });
        }

        const birds = document.querySelectorAll('.ke-bird');
        birds.forEach((b, i) => {
            gsap.to(b, { x: '+=200', y: '-=30', opacity: 1, duration: 2, delay: i * 0.3, ease: 'power1.out' });
        });
    }

    function endSession() {
        if (!state.running) return;
        state.running = false;
        state.sessionToken++;
        clearInterval(state.timerId);
        state.timerId = null;
        cancelCountdown();
        els.userInput.readOnly = true;
        stopBackgroundAudio();
        stopSky();

        const elapsed = state.initialTime - state.timeRemaining;
        const elapsedMin = elapsed / 60;
        const isImlasiz = isImlasizMode();
        const typedWords = Core.parseWordsFromInput(els.userInput.value);
        const incomplete = state.timeRemaining <= 0 &&
            Core.isIncompleteLastWord(state.originalWords, typedWords, isImlasiz);
        const examOpts = { incompleteLastWord: incomplete };

        const wordResult = Core.evaluateExamText(state.originalWords, els.userInput.value, isImlasiz, examOpts);
        const wpm = elapsedMin > 0 ? Math.round(wordResult.netWords / elapsedMin) : 0;
        const evaluated = wordResult.correct + wordResult.wrong;
        const accuracy = evaluated > 0 ? Math.round((wordResult.correct / evaluated) * 100) : 100;

        playCompletionAnimation();

        state.pendingSave = {
            wpm,
            accuracy,
            maxCombo: state.maxCombo,
            dogru: wordResult.correct,
            yanlis: wordResult.wrong,
            toplamKelime: typedWords.length,
            katSayisi: state.floorCount,
            evSeviyesi: state.floorCount,
            sureSaniye: elapsed,
            netKelime: wordResult.netWords,
            metinAdi: state.sessionMeta.metinAdi,
            kategori: state.sessionMeta.kategori,
            grup: state.sessionMeta.grup,
            gorsel: null,
        };

        setTimeout(async () => {
            const thumb = await captureHouseThumb();
            if (state.pendingSave) state.pendingSave.gorsel = thumb;
        }, 900);

        $('ke-result-wpm').textContent = wpm;
        $('ke-result-time').textContent = fmtTime(elapsed);
        $('ke-result-accuracy').textContent = accuracy + '%';
        $('ke-result-combo').textContent = state.maxCombo;
        $('ke-result-correct').textContent = wordResult.correct;
        $('ke-result-total').textContent = typedWords.length;
        $('ke-result-wrong').textContent = wordResult.wrong;
        $('ke-result-floors').textContent = state.floorCount;

        els.workspace.classList.add('hidden');
        document.body.style.overflow = 'auto';
        $('ke-result-modal').classList.remove('hidden');
        updateSaveBtn();
    }

    async function captureHouseThumb() {
        const scene = els.scene || $('ke-scene');
        const workspace = els.workspace || $('ke-workspace');
        if (!scene || typeof html2canvas === 'undefined') return null;

        const wasHidden = workspace?.classList.contains('hidden');
        if (wasHidden && workspace) {
            workspace.classList.remove('hidden');
            workspace.style.pointerEvents = 'none';
            workspace.style.opacity = '0';
        }

        try {
            await new Promise(r => setTimeout(r, 100));
            const canvas = await html2canvas(scene, {
                backgroundColor: null,
                scale: Math.min(2, window.devicePixelRatio || 1),
                logging: false,
                useCORS: true,
            });
            const ratio = Math.min(
                CFG.SAVE_THUMB_MAX_W / canvas.width,
                CFG.SAVE_THUMB_MAX_H / canvas.height,
                1
            );
            if (ratio >= 1) {
                return canvas.toDataURL('image/jpeg', CFG.SAVE_THUMB_QUALITY);
            }
            const out = document.createElement('canvas');
            out.width = Math.round(canvas.width * ratio);
            out.height = Math.round(canvas.height * ratio);
            out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
            return out.toDataURL('image/jpeg', CFG.SAVE_THUMB_QUALITY);
        } catch (e) {
            console.warn('Ev görseli alınamadı:', e);
            return null;
        } finally {
            if (wasHidden && workspace) {
                workspace.classList.add('hidden');
                workspace.style.pointerEvents = '';
                workspace.style.opacity = '';
            }
        }
    }

    async function updateSaveBtn() {
        const btn = $('ke-save-btn');
        if (!btn) return;
        if (state.resultSaved) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-check"></i><span>Kaydedildi</span>';
            btn.classList.add('!bg-green-600/20', '!border-green-500/40');
            return;
        }
        btn.classList.remove('!bg-green-600/20', '!border-green-500/40');
        try {
            const { isUserLoggedIn } = await import('./userStats.js');
            const ok = await isUserLoggedIn(window.yaziyoSupabase);
            btn.disabled = !ok;
            const labelText = ok ? 'Sonucu Kaydet' : 'Giriş Yapın (Kaydet)';
            btn.innerHTML = `<i class="fa-solid fa-bookmark"></i><span>${labelText}</span>`;
        } catch {
            btn.disabled = true;
        }
    }

    async function saveResult() {
        const btn = $('ke-save-btn');
        if (state.resultSaved || btn?.disabled || !state.pendingSave) return;

        btn.disabled = true;
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Kaydediliyor...</span>';

        try {
            const thumb = state.pendingSave.gorsel || await captureHouseThumb();
            const { saveKelimeEviSonucu, isUserLoggedIn } = await import('./userStats.js');
            if (!await isUserLoggedIn(window.yaziyoSupabase)) {
                throw new Error('Kaydetmek için giriş yapmalısınız');
            }
            await saveKelimeEviSonucu(window.yaziyoSupabase, { ...state.pendingSave, gorsel: thumb });
            state.resultSaved = true;
            showToast('Ev profilinize kaydedildi!');
            updateSaveBtn();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Kayıt başarısız', true);
            btn.disabled = false;
            btn.innerHTML = orig;
        }
    }

    function showToast(msg, isError) {
        const t = $('ke-toast');
        if (!t) return;
        $('ke-toast-text').textContent = msg;
        t.classList.remove('hidden', 'translate-y-4', 'opacity-0');
        t.classList.add('translate-y-0', 'opacity-100');
        setTimeout(() => {
            t.classList.add('translate-y-4', 'opacity-0');
            setTimeout(() => t.classList.add('hidden'), 400);
        }, 2800);
    }

    function closeWorkspace() {
        state.sessionToken++;
        cancelCountdown();
        stopBackgroundAudio();

        if (state.running) {
            endSession();
            return;
        }

        clearInterval(state.timerId);
        state.timerId = null;
        els.workspace?.classList.add('hidden');
        document.body.style.overflow = 'auto';
        stopSky();
    }

    function preventTextCopy(e) {
        const card = $('ke-text-display-card');
        const content = $('ke-text-content');
        if (!card || !content) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        if (card.contains(sel.anchorNode) || content.contains(sel.anchorNode)) {
            e.preventDefault();
        }
    }

    function bindEvents() {
        $('ke-start-btn')?.addEventListener('click', startSession);
        $('ke-exit-btn')?.addEventListener('click', closeWorkspace);
        $('ke-close-modal')?.addEventListener('click', () => $('ke-result-modal').classList.add('hidden'));
        $('ke-back-btn')?.addEventListener('click', () => {
            $('ke-result-modal').classList.add('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        $('ke-save-btn')?.addEventListener('click', saveResult);

        els.userInput = $('ke-user-input');
        els.userInput?.addEventListener('input', handleInput);
        els.userInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && state.running) {
                e.preventDefault();
                endSession();
            }
        });

        document.addEventListener('copy', preventTextCopy);
        document.addEventListener('cut', preventTextCopy);
        $('ke-text-display-card')?.addEventListener('contextmenu', (e) => e.preventDefault());
        $('ke-text-content')?.addEventListener('contextmenu', (e) => e.preventDefault());

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && els.workspace && !els.workspace.classList.contains('hidden') && !state.running) {
                closeWorkspace();
            }
        });

        window.addEventListener('pagehide', () => {
            state.sessionToken++;
            cancelCountdown();
            stopBackgroundAudio();
            clearInterval(state.timerId);
            state.timerId = null;
            state.running = false;
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        cacheEls();
        initDropdowns();
        initSoundToggle();
        bindEvents();
    });
})();
