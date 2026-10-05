
            ( () => {
                'use strict';
                const $ = s => document.querySelector(s)
                  , canvas = $('#canvas')
                  , ctx = canvas.getContext('2d');
                const ASSETS = {
                    titleArt: 'assets/images/titleArt.webp',
                    background: 'assets/images/background.webp',
  normal: 'assets/images/normal.webp',
  smile: 'assets/images/smile.webp',
  mistake: 'assets/images/mistake.webp',
  serious: 'assets/images/serious.webp',
  manaNormal: 'assets/images/manaNormal.webp',
  manaHit: 'assets/images/manaHit.webp',
  mokaNormal: 'assets/images/mokaNormal.webp',
  mokaHit: 'assets/images/mokaHit.webp',
  acorn: 'assets/images/acorn.webp',
  gold: 'assets/images/gold.webp',
  rock: 'assets/images/rock.webp',
  burr: 'assets/images/burr.webp',
  gameover: 'assets/images/gameover.webp',
  clear: 'assets/images/clear.webp',
  result: 'assets/images/result.webp',
};
                const SFX = {
                    catch: 'assets/audio/catch.mp3',
                    defend: 'assets/audio/defend.mp3',
                    damage: 'assets/audio/damage.mp3',
                    gold: 'assets/audio/gold.mp3',
                    combo: 'assets/audio/catch.mp3',
                    combo_milestone: 'assets/audio/combo_milestone.mp3',
                    time_warning: 'assets/audio/time_warning.mp3',
                    result: 'assets/audio/result.mp3',
                    button: 'assets/audio/button.mp3',
                    miss: 'assets/audio/miss.mp3'
                };
                const BGM_ASSETS = {
                    title: 'assets/audio/title.mp3',
                    normal: 'assets/audio/normal.mp3',
                    hard: 'assets/audio/hard.mp3',
                    result: 'assets/audio/result_2.mp3'
                };
                const SFX_VOLUME = { catch:.95, defend:.72, miss:.95, damage:.82, gold:.78, time_warning:.68, result:.76, button:.5 };
                // モバイル向け：起動時にはSEを再生せず、ユーザー操作後にWeb Audioへデコード。
                // 再生時はAudioBufferSourceNodeを生成するだけなので、キャッチ瞬間の負荷を最小化する。
                const SFX_POOL_SIZE = 2;
                const SFX_POOL = {};
                const SFX_POOL_INDEX = {};
                Object.entries(SFX).forEach(([name, src]) => {
                    SFX_POOL[name] = Array.from({length: SFX_POOL_SIZE}, () => {
                        const a = new Audio();
                        a.preload = 'auto';
                        a.src = src;
                        a.volume = SFX_VOLUME[name] ?? .75;
                        return a;
                    });
                    SFX_POOL_INDEX[name] = 0;
                });
                let audioUnlocked = false;
                let sfxCtx = null;
                const sfxBuffers = {};
                let sfxLoadingStarted = false;
                function unlockAudio() {
                    audioUnlocked = true;
                    try {
                        if (!sfxCtx) sfxCtx = new (window.AudioContext || window.webkitAudioContext)();
                        if (sfxCtx.state === 'suspended') sfxCtx.resume().catch(() => {});
                    } catch (e) {}
                    if (!sfxLoadingStarted) {
                        sfxLoadingStarted = true;
                        // キャッチ音を最優先。その後ほかのSEをアイドル時に順次デコード。
                        loadSfxBuffer('catch').then(() => {
                            const rest = Object.keys(SFX).filter(k => k !== 'catch');
                            let i = 0;
                            const next = () => {
                                if (i >= rest.length) return;
                                loadSfxBuffer(rest[i++]).finally(() => {
                                    if ('requestIdleCallback' in window) requestIdleCallback(next, {timeout: 1200});
                                    else setTimeout(next, 120);
                                });
                            };
                            next();
                        });
                    }
                }
                async function loadSfxBuffer(name) {
                    if (!sfxCtx || sfxBuffers[name] || !SFX[name]) return;
                    try {
                        const res = await fetch(SFX[name], {cache:'force-cache'});
                        const data = await res.arrayBuffer();
                        sfxBuffers[name] = await sfxCtx.decodeAudioData(data);
                    } catch (e) {}
                }
                function playSfx(name) {
                    if (!audioUnlocked) return;
                    const buffer = sfxBuffers[name];
                    if (buffer && sfxCtx) {
                        try {
                            if (sfxCtx.state === 'suspended') sfxCtx.resume().catch(() => {});
                            const source = sfxCtx.createBufferSource();
                            const gain = sfxCtx.createGain();
                            source.buffer = buffer;
                            gain.gain.value = SFX_VOLUME[name] ?? .75;
                            source.connect(gain);
                            gain.connect(sfxCtx.destination);
                            source.start(0);
                            return;
                        } catch (e) {}
                    }
                    // デコード完了前だけ従来のプールを使用。通常プレイ時はWeb Audio側へ移行する。
                    const pool = SFX_POOL[name];
                    if (!pool) return;
                    const index = SFX_POOL_INDEX[name] ?? 0;
                    const a = pool[index];
                    SFX_POOL_INDEX[name] = (index + 1) % pool.length;
                    try { a.currentTime = 0; } catch (e) {}
                    const p = a.play();
                    if (p && p.catch) p.catch(() => {});
                }
                const IMG = Object.fromEntries(Object.entries(ASSETS).map(([k,src]) => { const im = new Image(); im.src = src; return [k, im]; }));
                const ui = {
                    hud: $('#hud'),
                    score: $('#score'),
                    time: $('#time'),
                    level: $('#level'),
                    hearts: $('#hearts'),
                    combo: $('#combo'),
                    mode: $('#mode'),
                    toast: $('#toast'),
                    title: $('#title'),
                    howto: $('#howto'),
                    result: $('#result'),
                    rank: $('#rank'),
                    finalScore: $('#finalScore'),
                    maxCombo: $('#maxCombo'),
                    saved: $('#saved'),
                    message: $('#message'),
                    recordBox: $('#recordBox'),
                    endingImage: $('#endingImage'),
                    resultArt: $('#resultArt'),
                    shareX: $('#shareX'),
                    shareCopy: $('#shareCopy'),
                    titleVisual: $('#titleVisual'),
                    bgmToggle: $('#bgmToggle')
                };
                ui.titleVisual.src = ASSETS.titleArt;
                ui.bgmToggle.onclick = () => { playSfx('button'); toggleBgm(); };
                const SWING_SPEED = 700;
                let gameDifficulty = 'normal'
                  , lastRecordUpdate = false
                  , W = 0
                  , H = 0
                  , dpr = 1
                  , state = 'title'
                  , last = 0
                  , time = 60
                  , score = 0
                  , lives = 3
                  , combo = 0
                  , maxCombo = 0
                  , saved = 0
                  , spawn = 0
                  , shake = 0
                  , difficultyLevel = 1
                  , tailSpeed = 0
                  , tailVX = 0
                  , tailVY = 0
                  , items = []
                  , particles = []
                  , pointer = {
                    x: 0,
                    y: 0,
                    active: false
                }
                  , tail = {
                    x: 0,
                    y: 0,
                    tx: 0,
                    ty: 0
                }
                  , toastTimer = 0
                  , characterState = 'normal'
                  , characterStateUntil = 0
                  , manaHitUntil = 0
                  , mokaHitUntil = 0
                  , endingTimer = 0
                  , bgmEnabled = true
                  , audioCtx = null
                  , bgmGain = null
                  , bgmTimer = null
                  , bgmStep = 0
                  , timeWarningPlayed = false;
                const rnd = (a, b) => a + Math.random() * (b - a)
                  , clamp = (v, a, b) => Math.max(a, Math.min(b, v));
                function setCharacterState(s, ms=500) {
                    characterState = s;
                    characterStateUntil = performance.now() + ms;
                }
                function currentCharacter() {
                    if (performance.now() < characterStateUntil) return IMG[characterState];
                    characterState = 'normal';
                    return IMG.normal;
                }
                function showEnding(kind) {
                    state = 'ending';
                    ui.hud.classList.add('hidden');
                    ui.combo.classList.remove('show','combo-hot');
                    ui.endingImage.src = kind === 'clear' ? ASSETS.clear : ASSETS.gameover;
                    ui.endingImage.classList.toggle('gameover-art', kind !== 'clear');
                    ui.endingImage.classList.remove('hidden');
                    clearTimeout(endingTimer);
                    endingTimer = setTimeout(() => {
                        ui.endingImage.classList.add('hidden');
                        showResult();
                    }, 1300);
                }
                function showResult() {
                    state = 'result';
                    setBgmTrack('result');
                    playSfx('result');
                    ui.resultArt.src = ASSETS.result;
                    const recordResult = registerRecord();
                    lastRecordUpdate = recordResult.scoreNew || recordResult.comboNew;
                    const record = recordResult.current;
                    let rank, msg;
                    if (lives === 3 && score >= 900) {
                        rank = '鉄壁のモフモフ';
                        msg = 'なかまは全員無事！ しっぽさばきは伝説級です。'
                    } else if (maxCombo >= 15) {
                        rank = 'しっぽブンブン丸';
                        msg = '止まらない連続防御！ 秋の森にモフモフ旋風が吹きました。'
                    } else if (score >= 600) {
                        rank = '森の守護者';
                        msg = '木の実も安全もばっちり。頼れる防衛隊長です！'
                    } else if (score >= 300) {
                        rank = 'やさしい尻尾';
                        msg = 'あと少しで一人前。ねむぱんも尻尾も誇らしげです。'
                    } else {
                        rank = 'モフモフ見習い';
                        msg = '最初はみんな見習いです。もう一度、秋の森へ！'
                    }
                    ui.rank.textContent = rank;
                    ui.finalScore.textContent = score;
                    ui.maxCombo.textContent = maxCombo;
                    ui.saved.textContent = saved;
                    ui.message.textContent = msg;
                    if (recordResult.scoreNew || recordResult.comboNew) {
                        const parts = [];
                        if (recordResult.scoreNew) parts.push(`スコア ${score} pt`);
                        if (recordResult.comboNew) parts.push(`最大コンボ ${maxCombo}`);
                        ui.recordBox.textContent = `🏆 NEW RECORD！ ${parts.join(' / ')}`;
                        ui.recordBox.classList.add('new-record');
                    } else {
                        ui.recordBox.textContent = `自己ベスト：${record.score} pt　/　最大コンボ ${record.combo}`;
                        ui.recordBox.classList.remove('new-record');
                    }
                    ui.result.classList.remove('hidden');
                }
                function drawImageFit(img, x, y, w, h, alpha=1) {
                    if (!img || !img.complete || !img.naturalWidth) return;
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    const r = Math.min(w / img.naturalWidth, h / img.naturalHeight);
                    const dw = img.naturalWidth * r, dh = img.naturalHeight * r;
                    ctx.drawImage(img, x + (w-dw)/2, y + (h-dh)/2, dw, dh);
                    ctx.restore();
                }

                let bgmAudio = null;
                let currentBgm = 'title';
                function ensureBgm() {
                    if (!bgmEnabled) return;
                    if (!bgmAudio) {
                        bgmAudio = new Audio();
                        bgmAudio.loop = true;
                        bgmAudio.preload = 'auto';
                        bgmAudio.volume = 0.42;
                    }
                    const src = BGM_ASSETS[currentBgm];
                    if (bgmAudio.getAttribute('src') !== src) {
                        bgmAudio.src = src;
                        bgmAudio.load();
                    }
                    const p = bgmAudio.play();
                    if (p && p.catch) p.catch(() => {});
                }
                function setBgmTrack(track) {
                    currentBgm = track;
                    if (!bgmEnabled) return;
                    ensureBgm();
                }
                function stopBgm() {
                    if (bgmAudio) {
                        bgmAudio.pause();
                        bgmAudio.currentTime = 0;
                    }
                }

                function toggleBgm() {
                    bgmEnabled = !bgmEnabled;
                    ui.bgmToggle.textContent = bgmEnabled ? '♫ BGM ON' : '♫ BGM OFF';
                    ui.bgmToggle.classList.toggle('off', !bgmEnabled);
                    if (bgmEnabled) ensureBgm(); else stopBgm();
                }

                function resize() {
                    const r = canvas.getBoundingClientRect();
                    dpr = Math.min(matchMedia('(pointer: coarse)').matches ? 1.5 : 2, devicePixelRatio || 1);
                    W = r.width;
                    H = r.height;
                    canvas.width = W * dpr;
                    canvas.height = H * dpr;
                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                    if (!pointer.active) {
                        pointer.x = W * .72;
                        pointer.y = H * .73
                    }
                }
                addEventListener('resize', resize);
                resize();
                const RECORD_KEY = 'nemupan_tail_defense_records_v1';
                function getRecords() {
                    try {
                        return JSON.parse(localStorage.getItem(RECORD_KEY)) || { normal: { score: 0, combo: 0 }, hard: { score: 0, combo: 0 } };
                    } catch (e) {
                        return { normal: { score: 0, combo: 0 }, hard: { score: 0, combo: 0 } };
                    }
                }
                function saveRecords(records) {
                    try { localStorage.setItem(RECORD_KEY, JSON.stringify(records)); } catch (e) {}
                }
                function currentRecord() {
                    const records = getRecords();
                    return records[gameDifficulty] || { score: 0, combo: 0 };
                }
                function registerRecord() {
                    const records = getRecords();
                    const old = records[gameDifficulty] || { score: 0, combo: 0 };
                    const scoreNew = score > old.score;
                    const comboNew = maxCombo > old.combo;
                    records[gameDifficulty] = { score: Math.max(old.score, score), combo: Math.max(old.combo, maxCombo) };
                    if (scoreNew || comboNew) saveRecords(records);
                    return { scoreNew, comboNew, previous: old, current: records[gameDifficulty] };
                }
                function showComboMilestone() {
                    if (combo < 5 || combo % 5 !== 0) return;
                    ui.combo.classList.remove('milestone');
                    void ui.combo.offsetWidth;
                    ui.combo.classList.add('milestone');
                    showToast(`🔥 ${combo} COMBO！`);
                    setTimeout(() => ui.combo.classList.remove('milestone'), 450);
                }

                function reset() {
                    time = 60;
                    score = 0;
                    lives = 3;
                    combo = maxCombo = saved = 0;
                    timeWarningPlayed = false;
                    spawn = .5;
                    difficultyLevel = 1;
                    tailSpeed = tailVX = tailVY = 0;
                    items = [];
                    particles = [];
                    tail.x = tail.tx = W * .72;
                    tail.y = tail.ty = H * .72;
                    pointer.x = tail.x;
                    pointer.y = tail.y;
                    characterState = 'normal';
                    characterStateUntil = 0;
                    manaHitUntil = mokaHitUntil = 0;
                    ui.endingImage.classList.add('hidden');
                    ui.endingImage.classList.remove('gameover-art');
                    ui.level.textContent = 'TIME · LV1';
                    setMode(false);
                    updateUI()
                }
                function showHowTo() {
                    state = 'howto';
                    setBgmTrack('title');
                    ui.title.classList.add('hidden');
                    ui.result.classList.add('hidden');
                    ui.howto.classList.remove('hidden');
                    ui.hud.classList.add('hidden');
                    for (const img of ui.howto.querySelectorAll('[data-asset]')) img.src = ASSETS[img.dataset.asset];
                }
                function start(mode = gameDifficulty) {
                    gameDifficulty = mode;
                    setBgmTrack(gameDifficulty);
                    reset();
                    state = 'play';
                    ui.endingImage.classList.add('hidden');
                    ui.endingImage.classList.remove('gameover-art');
                    ui.title.classList.add('hidden');
                    ui.howto.classList.add('hidden');
                    ui.result.classList.add('hidden');
                    ui.hud.classList.remove('hidden');
                    showToast(gameDifficulty === 'hard' ? 'HARD！4秒だけ練習。ここから一気に忙しくなるよ！' : 'まずは木の実をゆっくりキャッチ！');
                    last = performance.now();
                    requestAnimationFrame(loop)
                }
                let titleBgmUnlocked = false;
                function unlockTitleBgmFromFirstGesture() {
                    unlockAudio();
                    if (titleBgmUnlocked || state !== 'title' || !bgmEnabled) return;
                    titleBgmUnlocked = true;
                    setBgmTrack('title');
                }
                document.addEventListener('pointerdown', unlockTitleBgmFromFirstGesture, { once: false });
                document.addEventListener('click', unlockTitleBgmFromFirstGesture, { once: false });

                $('#start').onclick = () => { playSfx('button'); showHowTo(); };
                $('#normalStart').onclick = () => { playSfx('button'); start('normal'); };
                $('#hardStart').onclick = () => { playSfx('button'); start('hard'); };
                $('#backTitle').onclick = () => { playSfx('button'); setBgmTrack('title'); state = 'title'; ui.howto.classList.add('hidden'); ui.title.classList.remove('hidden'); };
                function buildShareText() {
                    const difficultyLabel = gameDifficulty === 'hard' ? 'HARD' : 'NORMAL';
                    const recordLine = lastRecordUpdate ? '\n🏆 自己ベスト更新！' : '';
                    return `『ねむぱんの モフモフしっぽ防衛隊！』\n${difficultyLabel}でプレイしました🐾${recordLine}\n\nスコア：${score} pt\n称号：${ui.rank.textContent}\n最大コンボ：${maxCombo}\n守った数：${saved}\n\n#モフモフしっぽ防衛隊 #ねむぱんGAMES`;
                }
                function shareToX() {
                    const postText = buildShareText();
                    const params = new URLSearchParams({ text: postText });
                    const pageUrl = location.href;
                    if (/^https?:$/.test(location.protocol)) params.set('url', pageUrl);
                    window.open(`https://twitter.com/intent/tweet?${params.toString()}`, '_blank', 'noopener,noreferrer');
                }
                async function copyShareText() {
                    const postText = buildShareText();
                    try {
                        if (navigator.clipboard && window.isSecureContext) {
                            await navigator.clipboard.writeText(postText);
                        } else {
                            const ta = document.createElement('textarea');
                            ta.value = postText;
                            ta.setAttribute('readonly', '');
                            ta.style.position = 'fixed';
                            ta.style.opacity = '0';
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            ta.remove();
                        }
                        showToast('📋 投稿文をコピーしました！');
                    } catch (e) {
                        showToast('コピーできませんでした。もう一度お試しください。');
                    }
                }
                ui.shareX.onclick = () => { playSfx('button'); shareToX(); };
                ui.shareCopy.onclick = () => { playSfx('button'); copyShareText(); };
                $('#again').onclick = () => { playSfx('button'); showHowTo(); };
                function pos(e) {
                    const r = canvas.getBoundingClientRect()
                      , p = e.touches ? e.touches[0] : e;
                    pointer.x = clamp(p.clientX - r.left, 18, W - 18);
                    pointer.y = clamp(p.clientY - r.top, H * .2, H - 62);
                    pointer.active = true
                }
                canvas.addEventListener('pointerdown', e => {
                    canvas.setPointerCapture?.(e.pointerId);
                    pos(e)
                }
                );
                canvas.addEventListener('pointermove', e => {
                    if (state === 'play')
                        pos(e)
                }
                );
                canvas.addEventListener('touchstart', e => {
                    pos(e);
                    e.preventDefault()
                }
                , {
                    passive: false
                });
                canvas.addEventListener('touchmove', e => {
                    pos(e);
                    e.preventDefault()
                }
                , {
                    passive: false
                });
                addEventListener('keydown', e => {
                    if (state === 'title' && (e.key === 'Enter' || e.key === ' ')) {
                        playSfx('button');
                        setBgmTrack('title');
                        ensureBgm();
                        showHowTo();
                    }
                    if (state === 'result' && (e.key === 'Enter' || e.key === ' ')) {
                        playSfx('button');
                        showHowTo();
                    }
                    if (state === 'play') {
                        if (e.key === 'ArrowLeft')
                            pointer.x -= 32;
                        if (e.key === 'ArrowRight')
                            pointer.x += 32;
                        if (e.key === 'ArrowUp')
                            pointer.y -= 32;
                        if (e.key === 'ArrowDown')
                            pointer.y += 32;
                        pointer.x = clamp(pointer.x, 20, W - 20);
                        pointer.y = clamp(pointer.y, H * .2, H - 60)
                    }
                }
                );
                let uiScoreCache = null, uiTimeCache = null, uiLivesCache = null, uiLowTimeCache = null;
                function updateUI(force = false) {
                    const nextScore = score;
                    const nextTime = Math.ceil(time);
                    const nextLives = lives;
                    const nextLowTime = state === 'play' && time <= 10 && time > 0;
                    if (force || nextScore !== uiScoreCache) {
                        ui.score.textContent = nextScore;
                        uiScoreCache = nextScore;
                    }
                    if (force || nextTime !== uiTimeCache) {
                        ui.time.textContent = nextTime;
                        uiTimeCache = nextTime;
                    }
                    if (force || nextLowTime !== uiLowTimeCache) {
                        ui.time.classList.toggle('low-time', nextLowTime);
                        uiLowTimeCache = nextLowTime;
                    }
                    if (force || nextLives !== uiLivesCache) {
                        ui.hearts.textContent = '♥'.repeat(nextLives) + '♡'.repeat(3 - nextLives);
                        uiLivesCache = nextLives;
                    }
                }
                function showToast(t) {
                    ui.toast.textContent = t;
                    ui.toast.classList.remove('toast-alert','toast-success');
                    if (/イガ栗|危険|ブンッ|はじく/.test(t)) ui.toast.classList.add('toast-alert');
                    else if (/キャッチ|成功|守った|金のどんぐり/.test(t)) ui.toast.classList.add('toast-success');
                    ui.toast.classList.add('show');
                    clearTimeout(toastTimer);
                    toastTimer = setTimeout(() => ui.toast.classList.remove('show','toast-alert','toast-success'), 700)
                }
                function difficulty() {
                    if (gameDifficulty === 'hard') {
                        // v10 HARD: speed and density remain high, but readable/fair.
                        const progress = clamp(((60 - time) - 4) / 56, 0, 1);
                        return {
                            progress,
                            acorn: .56 - progress * .08,
                            minSpeed: 126 + progress * 54,
                            maxSpeed: 158 + progress * 62,
                            interval: .72 - progress * .22
                        }
                    }
                    // NORMAL: restore the original v6 difficulty curve.
                    const progress = clamp(((60 - time) - 6) / 54, 0, 1);
                    return {
                        progress,
                        acorn: .64 - progress * .12,
                        minSpeed: 88 + progress * 52,
                        maxSpeed: 118 + progress * 57,
                        interval: 1.00 - progress * .42
                    }
                }
                function canSpawnFairly(x, y, r) {
                    const minDist = Math.max(54, r + 24);
                    for (const it of items) {
                        // Only check items that are still near the spawn corridor.
                        if (it.y < 170) {
                            const dx = x - it.x;
                            const dy = y - it.y;
                            if (dx * dx + dy * dy < minDist * minDist)
                                return false;
                        }
                    }
                    return true;
                }
                function addItem() {
                    const d = difficulty();
                    const r = Math.random();

                    // NORMAL: restore v6 item mix and spawn placement.
                    if (gameDifficulty !== 'hard') {
                        let type = time > 54 ? 'acorn' : r < d.acorn ? 'acorn' : r < d.acorn + .18 ? 'rock' : 'burr';
                        if (time < 38 && Math.random() < .08)
                            type = 'gold';
                        const rad = type === 'burr' ? 18 : type === 'rock' ? 16 : 14;
                        const margin = Math.max(62, W * .16);
                        items.push({
                            type,
                            x: rnd(margin, W - margin),
                            y: -25,
                            vx: rnd(-12, 12),
                            vy: rnd(d.minSpeed, d.maxSpeed),
                            r: rad,
                            rot: rnd(0, 6.28),
                            spin: rnd(-2.4, 2.4),
                            hit: false,
                            wrong: false
                        });
                        return;
                    }

                    // HARD: keep v10's fair-spawn rules.
                    let type = time > 56 ? 'acorn' : r < d.acorn ? 'acorn' : r < d.acorn + .22 ? 'rock' : 'burr';
                    if (time < 42 && Math.random() < .055)
                        type = 'gold';
                    const rad = type === 'burr' ? 18 : type === 'rock' ? 16 : 14;
                    const margin = Math.max(70, W * .18);
                    // Re-roll the X position so newly spawned items never visually overlap.
                    let x = rnd(margin, W - margin);
                    for (let tries = 0; tries < 18 && !canSpawnFairly(x, -25, rad); tries++)
                        x = rnd(margin, W - margin);
                    if (!canSpawnFairly(x, -25, rad)) {
                        // If the spawn corridor is temporarily busy, delay rather than force an unfair overlap.
                        spawn = Math.min(.22, Math.max(.08, d.interval * .28));
                        return;
                    }
                    items.push({
                        type,
                        x,
                        y: -25,
                        vx: rnd(-8, 8),
                        vy: rnd(d.minSpeed, d.maxSpeed),
                        r: rad,
                        rot: rnd(0, 6.28),
                        spin: rnd(-2.0, 2.0),
                        hit: false,
                        wrong: false
                    })
                }
                function burst(x, y, color, n=8) {
                    for (let i = 0; i < n; i++)
                        particles.push({
                            x,
                            y,
                            vx: rnd(-100, 100),
                            vy: rnd(-130, 20),
                            life: rnd(.35, .75),
                            c: color,
                            s: rnd(2, 5)
                        })
                }
                function tailSegments() {
                    // リファレンスシート準拠：大きく・ふわふわ・太い縞模様のしっぽ。
                    // 根元はねむぱんのお尻の後ろ側に入り、先端へ向かって少し細くする。
                    const root = {
                        x: W * .5 + 25,
                        y: H - 128
                    }
                      , dx = tail.x - root.x
                      , dy = tail.y - root.y;
                    return Array.from({
                        length: 13
                    }, (_, i) => {
                        const t = i / 12;
                        const curve = Math.sin(t * Math.PI) * (-Math.sign(dx || 1)) * 28;
                        const lift = Math.sin(t * Math.PI) * -8;
                        return {
                            x: root.x + dx * t + curve,
                            y: root.y + dy * t + lift,
                            r: 38 - 13 * t
                        };
                    });
                }
                function hitTail(it, segs) {
                    for (const s of segs) {
                        const dx = it.x - s.x
                          , dy = it.y - s.y;
                        if (dx * dx + dy * dy < (it.r + s.r - 4) ** 2)
                            return s
                    }
                    return null
                }
                function setMode(swing) {
                    ui.mode.classList.toggle('swing', swing);
                    ui.mode.textContent = swing ? '💨 ブンッ！ はじく' : '☁️ ふんわりキャッチ'
                }
                function breakCombo() {
                    combo = 0;
                    ui.combo.classList.remove('show','combo-hot')
                }
                function success(it) {
                    it.hit = true;
                    playSfx(it.type === 'gold' ? 'gold' : 'catch');
                    saved++;
                    combo++;
                    maxCombo = Math.max(maxCombo, combo);
                    const mult = 1 + Math.floor(combo / 5)
                      , base = it.type === 'gold' ? 50 : it.type === 'acorn' ? 12 : 18;
                    score += base * mult;
                    // キャッチ直後の描画負荷を分散。スコア計算は即時、演出だけ次フレームへ。
                    const burstX = it.x, burstY = it.y;
                    const burstColor = it.type === 'acorn' || it.type === 'gold' ? '#ffd34d' : '#fff3d4';
                    const burstCount = it.type === 'gold' ? 8 : 4;
                    requestAnimationFrame(() => {
                        if (state === 'play') burst(burstX, burstY, burstColor, burstCount);
                    });
                    if (combo >= 2) {
                        ui.combo.textContent = `×${combo}`;
                        ui.combo.classList.toggle('combo-hot', combo > 0 && combo % 5 === 0);
                        ui.combo.classList.add('show');
                    }
                    requestAnimationFrame(() => {
                        if (state !== 'play') return;
                        showComboMilestone();
                        setCharacterState('smile', 420);
                        if (it.type === 'gold') showToast('金のどんぐり！ +' + base * mult);
                        updateUI();
                    });
                }
                function fling(it, h, correct) {
                    const dx = tailVX || it.x - h.x
                      , dy = tailVY || it.y - h.y
                      , d = Math.hypot(dx, dy) || 1;
                    it.hit = true;
                    it.flying = !correct;
                    it.flyLife = correct ? 0 : .95;
                    it.vx = dx / d * (correct ? 330 : 390);
                    it.vy = dy / d * (correct ? 250 : 285) - (correct ? 130 : 175);
                    if (!correct) it.spin = (it.spin || 1) * 1.8;
                    burst(it.x, it.y, correct ? '#fff3d4' : '#e8a441', correct ? 10 : 14)
                }
                function wrongNut(it, h) {
                    fling(it, h, false);
                    playSfx('miss');
                    score = Math.max(0, score - (it.type === 'gold' ? 25 : 8));
                    breakCombo();
                    shake = 4;
                    setCharacterState('mistake', 650);
                    showToast(it.type === 'gold' ? '金のどんぐりを飛ばした！' : '木の実を飛ばしちゃった！');
                    updateUI()
                }
                function wrongHazard(it) {
                    it.wrong = true;
                    playSfx('miss');
                    score = Math.max(0, score - 8);
                    breakCombo();
                    shake = 5;
                    burst(it.x, it.y, '#db583d', 10);
                    setCharacterState('mistake', 650);
                    showToast(it.type === 'rock' ? '石は素早くはじこう！' : 'イガ栗は素早くはじこう！');
                    updateUI()
                }
                function defend(it, h) {
                    fling(it, h, true);
                    playSfx('defend');
                    saved++;
                    combo++;
                    maxCombo = Math.max(maxCombo, combo);
                    score += 18 * (1 + Math.floor(combo / 5));
                    if (combo >= 2) {
                        ui.combo.textContent = `COMBO ×${combo}`;
                        ui.combo.classList.add('show');
                    }
                    showComboMilestone();
                    setCharacterState('serious', 480);
                    showToast('ナイススイング！');
                    updateUI()
                }
                function damage(it) {
                    it.hit = true;
                    playSfx('damage');
                    lives--;
                    breakCombo();
                    shake = 10;
                    burst(it.x, it.y, '#db583d', 14);
                    setCharacterState('mistake', 700);
                    if (it.x < W * .5) manaHitUntil = performance.now() + 900; else mokaHitUntil = performance.now() + 900;
                    showToast(it.type === 'rock' ? '石がなかまに！' : 'イガ栗がなかまに！');
                    updateUI();
                    if (lives <= 0)
                        finish()
                }
                function update(dt) {
                    time = Math.max(0, time - dt);
                    if (time <= 10 && time > 0 && !timeWarningPlayed) {
                        timeWarningPlayed = true;
                        playSfx('time_warning');
                    }
                    const elapsed = 60 - time
                      , nextLevel = gameDifficulty === 'hard' ? (elapsed >= 32 ? 3 : elapsed >= 12 ? 2 : 1) : (elapsed >= 40 ? 3 : elapsed >= 20 ? 2 : 1);
                    if (nextLevel !== difficultyLevel) {
                        difficultyLevel = nextLevel;
                        ui.level.textContent = `TIME · LV${difficultyLevel}`;
                        showToast(difficultyLevel === 2 ? 'LEVEL 2　少しスピードUP！' : 'LEVEL 3　ラストスパート！')
                    }
                    spawn -= dt;
                    const interval = difficulty().interval;
                    if (spawn <= 0) {
                        addItem();
                        // v6 timing for NORMAL; v10 fair timing for HARD.
                        spawn = gameDifficulty === 'hard'
                            ? interval * rnd(.78, 1.12)
                            : interval * rnd(.82, 1.18)
                    }
                    tail.tx = pointer.x;
                    tail.ty = pointer.y;
                    const oldX = tail.x
                      , oldY = tail.y;
                    tail.x += (tail.tx - tail.x) * Math.min(1, dt * 13);
                    tail.y += (tail.ty - tail.y) * Math.min(1, dt * 13);
                    tailVX = (tail.x - oldX) / Math.max(dt, .001);
                    tailVY = (tail.y - oldY) / Math.max(dt, .001);
                    tailSpeed = Math.hypot(tailVX, tailVY);
                    const swinging = tailSpeed >= SWING_SPEED;
                    setMode(swinging);
                    const segs = tailSegments();
                    for (const it of items) {
                        it.x += it.vx * dt;
                        it.y += it.vy * dt;
                        it.rot += it.spin * dt;
                        if (it.flying) {
                            it.flyLife -= dt;
                            it.vy += 520 * dt;
                            it.vx *= Math.pow(0.985, dt * 60);
                        }
                        const h = !it.hit && !it.wrong && hitTail(it, segs);
                        if (h) {
                            const nut = it.type === 'acorn' || it.type === 'gold';
                            if (nut && !swinging)
                                success(it);
                            else if (nut && swinging)
                                wrongNut(it, h);
                            else if (!nut && swinging)
                                defend(it, h);
                            else
                                wrongHazard(it)
                        }
                        if (!it.hit && it.y > H - 98) {
                            if (it.type === 'rock' || it.type === 'burr')
                                damage(it);
                            else {
                                it.hit = true;
                                breakCombo()
                            }
                        }
                    }
                    items = items.filter(it =>
                        it.y < H + 90 && it.y > -140 && it.x > -140 && it.x < W + 140 &&
                        (!((it.type === 'acorn' || it.type === 'gold') && it.hit && !it.flying) || (it.flying && it.flyLife > 0))
                    );
                    for (const p of particles) {
                        p.x += p.vx * dt;
                        p.y += p.vy * dt;
                        p.vy += 220 * dt;
                        p.life -= dt
                    }
                    particles = particles.filter(p => p.life > 0);
                    shake *= .86;
                    if (time <= 0)
                        finish();
                    updateUI()
                }
                function finish(cleared = time <= 0) {
                    if (state !== 'play') return;
                    showEnding(cleared ? 'clear' : 'gameover');
                }
                function roundRect(x, y, w, h, r, fill) {
                    ctx.beginPath();
                    ctx.roundRect(x, y, w, h, r);
                    ctx.fillStyle = fill;
                    ctx.fill()
                }
                function drawBackground(t) {
                    const img = IMG.background;
                    if (img && img.complete && img.naturalWidth) {
                        const r = Math.max(W / img.naturalWidth, H / img.naturalHeight);
                        const dw = img.naturalWidth * r, dh = img.naturalHeight * r;
                        ctx.drawImage(img, (W - dw) * .5, (H - dh) * .5, dw, dh);
                    } else {
                        ctx.fillStyle = '#d8c48d';
                        ctx.fillRect(0, 0, W, H);
                    }
                    const g = ctx.createLinearGradient(0, 0, 0, H);
                    g.addColorStop(0, 'rgba(255,248,220,.04)');
                    g.addColorStop(.58, 'rgba(255,248,220,.02)');
                    g.addColorStop(1, 'rgba(72,38,18,.10)');
                    ctx.fillStyle = g;
                    ctx.fillRect(0, 0, W, H);
                }
                function drawFriends() {
                    const now = performance.now();
                    const fw = Math.min(150, W * .28);
                    drawImageFit(now < manaHitUntil ? IMG.manaHit : IMG.manaNormal, 4, H - 156, fw, 150, .95);
                    drawImageFit(now < mokaHitUntil ? IMG.mokaHit : IMG.mokaNormal, W - fw - 4, H - 156, fw, 150, .95);
                }
                function drawNemupan() {
                    const img = currentCharacter();
                    const w = Math.min(340, W * .72);
                    const h = Math.min(330, H * .42);
                    drawImageFit(img, W * .5 - w * .5, H - h - 2, w, h, .99);
                }
                function drawTail() {
                    const segs = tailSegments();
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    // スイング時の風圧エフェクト
                    if (tailSpeed >= SWING_SPEED) {
                        const tip = segs[12], d = Math.hypot(tailVX, tailVY) || 1, nx = tailVX / d, ny = tailVY / d;
                        ctx.strokeStyle = '#fff9dbbb';
                        ctx.lineWidth = 5;
                        for (let i = -1; i <= 1; i++) {
                            ctx.beginPath();
                            ctx.moveTo(tip.x - nx * (34 + i * 8) - ny * i * 12, tip.y - ny * (34 + i * 8) + nx * i * 12);
                            ctx.lineTo(tip.x - nx * (82 + i * 12) - ny * i * 12, tip.y - ny * (82 + i * 12) + nx * i * 12);
                            ctx.stroke();
                        }
                    }

                    // 外周の濃い茶色。リファレンスの「大きくてふわふわ」の輪郭を強調。
                    ctx.strokeStyle = '#5a301f';
                    ctx.lineWidth = 72;
                    ctx.beginPath();
                    ctx.moveTo(segs[0].x, segs[0].y);
                    for (const s of segs.slice(1)) ctx.lineTo(s.x, s.y);
                    ctx.stroke();

                    // しっぽ本体：温かい茶系オレンジ。
                    ctx.strokeStyle = '#d76b28';
                    ctx.lineWidth = 60;
                    ctx.stroke();

                    // リファレンスシートの特徴である、太く明瞭なクリーム色の横縞。
                    const stripeAt = [0.16, 0.38, 0.60, 0.82];
                    for (const t of stripeAt) {
                        const idx = t * 12;
                        const lo = Math.floor(idx), hi = Math.min(12, lo + 1), f = idx - lo;
                        const p = {
                            x: segs[lo].x + (segs[hi].x - segs[lo].x) * f,
                            y: segs[lo].y + (segs[hi].y - segs[lo].y) * f
                        };
                        const prev = segs[Math.max(0, lo - 1)], next = segs[Math.min(12, hi + 1)];
                        const tx = next.x - prev.x, ty = next.y - prev.y, td = Math.hypot(tx, ty) || 1;
                        const nx = -ty / td, ny = tx / td;
                        const radius = 58 * (1 - t * .24) * .47;
                        const thickness = 13 * (1 - t * .12);
                        ctx.fillStyle = '#f2c28c';
                        ctx.beginPath();
                        ctx.moveTo(p.x + nx * radius + tx / td * thickness, p.y + ny * radius + ty / td * thickness);
                        ctx.lineTo(p.x - nx * radius + tx / td * thickness, p.y - ny * radius + ty / td * thickness);
                        ctx.lineTo(p.x - nx * radius - tx / td * thickness, p.y - ny * radius - ty / td * thickness);
                        ctx.lineTo(p.x + nx * radius - tx / td * thickness, p.y + ny * radius - ty / td * thickness);
                        ctx.closePath();
                        ctx.fill();
                    }

                    // ふわふわした毛並み感を出す細いハイライト。
                    ctx.strokeStyle = '#e9944b';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(segs[1].x, segs[1].y - 5);
                    for (const s of segs.slice(2, 11)) ctx.lineTo(s.x, s.y - 5);
                    ctx.stroke();
                }
                function drawItem(it) {
                    const img = IMG[it.type];
                    const size = it.type === 'burr' ? 52 : it.type === 'rock' ? 44 : it.type === 'gold' ? 48 : 44;
                    ctx.save();
                    ctx.translate(it.x, it.y);
                    ctx.rotate(it.rot);
                    if (it.flying) {
                        ctx.globalAlpha = clamp(it.flyLife / .95, 0, 1);
                        ctx.strokeStyle = '#ffd34d';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(-18, 12);
                        ctx.lineTo(-42, 28);
                        ctx.stroke();
                        ctx.globalAlpha = 1;
                    }
                    if (img && img.complete && img.naturalWidth) {
                        const r = Math.min(size / img.naturalWidth, size / img.naturalHeight);
                        const w = img.naturalWidth * r, h = img.naturalHeight * r;
                        ctx.drawImage(img, -w/2, -h/2, w, h);
                    }
                    ctx.restore();
                }
                function draw(t) {
                    ctx.save();
                    if (shake)
                        ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
                    drawBackground(t);
                    drawFriends();
                    drawTail();
                    drawNemupan();
                    for (const it of items)
                        drawItem(it);
                    for (const p of particles) {
                        ctx.globalAlpha = clamp(p.life * 2, 0, 1);
                        ctx.fillStyle = p.c;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.s, 0, 7);
                        ctx.fill();
                        ctx.globalAlpha = 1
                    }
                    ctx.restore()
                }
                function loop(now) {
                    if (state !== 'play')
                        return;
                    const dt = Math.min(.033, (now - last) / 1000 || 0);
                    last = now;
                    update(dt);
                    draw(now);
                    requestAnimationFrame(loop)
                }
                drawBackground(0);
                drawFriends();
                tail.x = tail.tx = W * .72;
                tail.y = tail.ty = H * .72;
                drawTail();
                drawNemupan();
            }
            )();
        