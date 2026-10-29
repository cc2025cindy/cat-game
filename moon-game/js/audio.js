/**
 * 《又遠又近的月亮：3D 登月奇航》
 * Web Audio API 太空與月夜配樂合成器、互動音效與語音導覽系統
 * 遵循 edu_3d_game_workflow 音效與配樂規範：
 * - 四幕專屬動態配樂（圖書館午後、月球表面、阿波羅奇想、中秋月夜），預設音量 0.2
 * - 播放重點語音或太空通訊音效時自動暫停/降低背景音樂 (MUSIC.duck(true/false))
 * - 零外部音檔依賴，雙擊 file:// 與線上網址皆可 100% 正常發聲
 */

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.isMuted = false;
    this.bgmPlaying = false;
    this.isDucked = false;
    this.currentAct = 1;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.sfxLockUntil = 0;
    this.bgmAudio = null;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    this.bgmGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);
  }

  initAudioElement() {
    if (this.bgmAudio) return;
    try {
      this.bgmAudio = new Audio('audio/bgm.mp3');
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.isMuted ? 0 : (this.isDucked ? 0.05 : 0.35);
    } catch (e) {
      this.bgmAudio = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.init();
    this.isMuted = !this.isMuted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = this.isMuted;
      this.bgmAudio.volume = this.isMuted ? 0 : (this.isDucked ? 0.05 : 0.35);
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
    }
    if (window.voiceSystem) {
      window.voiceSystem.isMuted = this.isMuted;
      if (this.isMuted && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
    return this.isMuted;
  }

  duck(enable) {
    this.isDucked = !!enable;
    if (this.bgmAudio) {
      this.bgmAudio.volume = (this.isMuted || !this.bgmPlaying) ? 0 : (this.isDucked ? 0.05 : 0.35);
    }
    if (!this.bgmGain || !this.ctx) return;
    const targetVol = (this.isMuted || !this.bgmPlaying) ? 0 : (this.isDucked ? 0.03 : 0.2);
    this.bgmGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.15);
  }

  setAct(act) {
    this.currentAct = act || 1;
  }

  playBGM() {
    this.init();
    this.resume();
    if (this.bgmPlaying) return true;
    this.bgmPlaying = true;
    this.initAudioElement();

    let playedExternal = false;
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.isMuted ? 0 : (this.isDucked ? 0.05 : 0.35);
      const playPromise = this.bgmAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          playedExternal = true;
        }).catch((err) => {
          // If browser policy blocks audio element or file missing, fallback to synth
          this.scheduleBGMLoop();
        });
      }
    } else {
      this.scheduleBGMLoop();
    }
    return true;
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }
    if (this.bgmTimer) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    }
    return false;
  }

  toggleBGM() {
    if (this.bgmPlaying) {
      return this.stopBGM();
    } else {
      return this.playBGM();
    }
  }

  scheduleBGMLoop() {
    if (!this.bgmPlaying) return;
    if (!this.ctx || this.isMuted) {
      this.bgmTimer = setTimeout(() => this.scheduleBGMLoop(), 900);
      return;
    }

    // 依四幕切換五聲音階與太空音色
    const scales = {
      1: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25], // 第一幕：C 大調五聲（溫暖圖書館）
      2: [220.00, 261.63, 293.66, 329.63, 392.00, 440.00], // 第二幕：A 小調五聲（神秘四十五億歲月球）
      3: [293.66, 329.63, 369.99, 440.00, 493.88, 587.33], // 第三幕：D 大調五聲（輕快奇想與阿波羅趣聞）
      4: [349.23, 392.00, 440.00, 523.25, 587.33, 698.46]  // 第四幕：F 大調五聲（溫馨中秋月夜）
    };

    const scale = scales[this.currentAct] || scales[1];
    const pattern = [0, 2, 4, 5, 4, 2, 3, 1];
    const freq = scale[pattern[this.bgmStep % pattern.length]];
    this.bgmStep++;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    osc.type = (this.currentAct === 2) ? 'sine' : (this.currentAct === 4 ? 'triangle' : 'sine');
    osc.frequency.setValueAtTime(freq, now);

    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    osc.connect(g);
    g.connect(this.bgmGain);
    osc.start(now);
    osc.stop(now + 0.9);

    const intervalMs = (this.currentAct === 2) ? 950 : (this.currentAct === 3 ? 680 : 800);
    this.bgmTimer = setTimeout(() => this.scheduleBGMLoop(), intervalMs);
  }

  playClick() {
    this.init();
    this.resume();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.07);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playQuindarBeep(isIntro = true) {
    this.init();
    this.resume();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    // NASA Apollo Quindar Tone: Intro 2525 Hz, Outro 2475 Hz
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isIntro ? 2525 : 2475, t);

    // 短促清脆的 220ms 太空無線電發射開關音
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.02);
    g.gain.setValueAtTime(0.2, t + 0.18);
    g.gain.linearRampToValueAtTime(0.001, t + 0.22);

    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.23);
  }

  playSuccess() {
    this.init();
    this.resume();
    if (this.isMuted || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      const t = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  }

  playError() {
    this.init();
    this.resume();
    if (this.isMuted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(150, t + 0.28);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  playMistake() {
    this.playError();
  }

  /**
   * 太空通訊 Quindar Beep（阿波羅登月任務經典通訊提示音）
   */
  playApolloBeep() {
    this.init();
    this.resume();
    if (this.isMuted || !this.ctx) return;
    const now = Date.now();
    if (now < this.sfxLockUntil) return;
    this.sfxLockUntil = now + 900;

    this.duck(true);
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2525, t);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.25);

    setTimeout(() => this.duck(false), 1200);
  }

  /**
   * 隕石撞擊坑洞低頻音效
   */
  playMeteorImpact() {
    this.init();
    this.resume();
    if (this.isMuted || !this.ctx) return;
    const now = Date.now();
    if (now < this.sfxLockUntil) return;
    this.sfxLockUntil = now + 900;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    g.gain.setValueAtTime(0.45, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  /**
   * 玉兔搗藥／中秋月夜仙樂鈴聲
   */
  playJadeRabbitChime() {
    this.init();
    this.resume();
    if (this.isMuted || !this.ctx) return;
    const notes = [587.33, 659.25, 783.99, 880.0, 1174.66];
    notes.forEach((f, i) => {
      const t = this.ctx.currentTime + i * 0.09;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.46);
    });
  }

  /**
   * 相容舊版呼叫介面
   */
  playRealMeow(type) {
    if (type === 'alert' || type === 'calling') {
      this.playApolloBeep();
    } else if (type === 'growl') {
      this.playMeteorImpact();
    } else {
      this.playJadeRabbitChime();
    }
  }

  stopPurr() {}
  startPurr() {}
}

/**
 * 課文情境語音導覽與字幕氣泡系統
 * 支援雙重音效優化：
 * 1. NASA Apollo Quindar Beeps 太空無線電發射開關提示音 (2525Hz / 2475Hz)
 * 2. 14 站站點課文導讀與情境對話 AI 神經網路臺灣親切語音 (高音質立體聲 MP3，並保留 TTS 備援)
 */
class VoiceSystem {
  constructor() {
    this.isMuted = false;
    this.lockUntil = 0;
    this.activeAudio = null;
    this._hideTimer = null;
    this.lines = {
      newspaper: {
        speaker: '📰 小小天文探險家',
        avatar: '🧢🧒',
        file: 'audio/voice/voice_newspaper.mp3',
        text: '哇！《○○日報》寫著：NASA「阿提米絲計畫」預計將首位女性太空人送上月球，還要探索稀有資源呢！'
      },
      crater: {
        speaker: '🧑‍🚀 登月探測員',
        avatar: '🧑‍🚀',
        file: 'audio/voice/voice_crater.mp3',
        text: '月球已經四十五億歲了！因為沒有水和大氣保護，每天受到無數隕石撞擊，到處都是高低不平的坑洞！'
      },
      rabbit: {
        speaker: '🐇 月亮神話導覽',
        avatar: '🐇',
        file: 'audio/voice/voice_rabbit.mp3',
        text: '高低不平的坑洞在陽光照射下產生各種形狀的黑影，古人看著黑影，就想像出可愛的「玉兔搗藥」囉！'
      },
      distance: {
        speaker: '🔭 天文觀測站',
        avatar: '🔭',
        file: 'audio/voice/voice_distance.mp3',
        text: '月球距離地球最近三十六萬公里、最遠四十萬公里！平均三十八萬公里，就算搭飛機去也要花上半個月，騎單車更要騎三年呢！'
      },
      apollo: {
        speaker: '👨‍🏫 自然科學老師',
        avatar: '👨‍🏫',
        file: 'audio/voice/voice_apollo.mp3',
        text: '當年阿姆斯壯登月時，管制中心還開玩笑要他找找看，有沒有一位漂亮的姑娘帶著一隻兔子呢！'
      },
      midautumn: {
        speaker: '🥮 中秋賞月家人',
        avatar: '🥮',
        file: 'audio/voice/voice_midautumn.mp3',
        text: '來吃塊香甜的中秋月餅吧！科學的月球距離地球那麼遠，文學的月亮卻好像近在身邊，真是奇妙哇！'
      },
      praise: {
        speaker: '👨‍🏫 自然科學老師',
        avatar: '👨‍🏫',
        file: 'audio/voice/voice_praise.mp3',
        text: '太棒了，完全答對囉！你對科學的月球和文學的月亮都有深入的了解！'
      }
    };
  }

  speakStation(stationIdx) {
    if (stationIdx < 0 || stationIdx > 13) return;
    const st = (window.ST && window.ST[stationIdx]) ? window.ST[stationIdx] : null;
    if (!st) return;

    // 若當前正有語音播放，再次點擊按鈕則切換為停止
    if (this.activeAudio && !this.activeAudio.paused) {
      this.stop();
      return;
    }

    const file = `audio/voice/station_${stationIdx}.mp3`;
    const speaker = st.kind === 'story' ? '📖 課文朗讀' : '👨‍🏫 課文導讀';
    const avatar = '👩‍🏫';
    this.playVoiceItem(file, st.text, speaker, avatar, 'st-speak-btn');
  }

  stop() {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (e) {}
      this.activeAudio = null;
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    if (window.soundSystem) window.soundSystem.duck(false);
    this.resetSpeakBtn();
  }

  setSpeakBtnActive(btnId, isSpeaking) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    if (isSpeaking) {
      if (!btn.dataset.originHtml) btn.dataset.originHtml = btn.innerHTML;
      btn.innerHTML = '⏹️ 停止朗讀';
      btn.style.background = '#fee2e2';
      btn.style.borderColor = '#ef4444';
      btn.style.color = '#991b1b';
    } else {
      if (btn.dataset.originHtml) {
        btn.innerHTML = btn.dataset.originHtml;
      }
      btn.style.background = '#fef3c7';
      btn.style.borderColor = '#f59e0b';
      btn.style.color = '#92400e';
    }
  }

  resetSpeakBtn() {
    this.setSpeakBtnActive('st-speak-btn', false);
    this.setSpeakBtnActive('quiz-speak-btn', false);
  }

  speak(keyOrText, customSpeaker, sourceBtnId) {
    if (this.activeAudio && !this.activeAudio.paused && sourceBtnId) {
      this.stop();
      return;
    }
    const preset = this.lines[keyOrText];
    if (preset) {
      this.playVoiceItem(preset.file, preset.text, preset.speaker, preset.avatar, sourceBtnId);
    } else {
      this.playVoiceItem(null, keyOrText, customSpeaker || '🌕 月球探索導覽', '🧑‍🚀', sourceBtnId);
    }
  }

  playVoiceItem(audioFile, text, speaker, avatar, sourceBtnId) {
    const now = Date.now();
    if (now < this.lockUntil) return;
    this.lockUntil = now + 1000;

    // 1. 更新 HUD 頂部語音氣泡與逐字字幕
    const bubble = document.getElementById('owner-voice-bubble');
    const avatarEl = document.getElementById('voice-speaker-avatar');
    const nameEl = document.getElementById('voice-speaker-name');
    const subEl = document.getElementById('voice-subtitles');

    if (bubble && avatarEl && nameEl && subEl) {
      avatarEl.textContent = avatar || '🧑‍🚀';
      nameEl.textContent = speaker || '🌕 月球探索導覽';
      subEl.textContent = text;
      bubble.classList.remove('hidden');

      if (this._hideTimer) clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        bubble.classList.add('hidden');
      }, 5500);
    }

    if (this.isMuted) return;

    // 2. 暫停先前音訊與語音合成
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch (e) {}
      this.activeAudio = null;
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }

    // 3. 背景音樂平滑壓低 (Audio Ducking)
    if (window.soundSystem) window.soundSystem.duck(true);
    if (sourceBtnId) this.setSpeakBtnActive(sourceBtnId, true);

    // 4. 第一步：若身處「登月太空人」視角，播發 NASA 阿波羅 Quindar 2525Hz 開頭提示嗶聲！
    const isAstronaut = (window.game && window.game.viewMode === 'cat');
    if (isAstronaut && window.soundSystem) {
      window.soundSystem.playQuindarBeep(true);
    }

    const onPlaybackEnd = () => {
      // 結束通話：播發 NASA Quindar 2475Hz 閉口提示嗶聲
      if (isAstronaut && window.soundSystem) {
        window.soundSystem.playQuindarBeep(false);
      }
      if (window.soundSystem) window.soundSystem.duck(false);
      if (sourceBtnId) this.setSpeakBtnActive(sourceBtnId, false);
      this.activeAudio = null;
    };

    // 5. 第二步：優先播放 AI 神經網路臺灣親切語音音檔 (MP3)
    if (audioFile) {
      const audio = new Audio(audioFile);
      this.activeAudio = audio;
      audio.volume = 0.95;
      audio.onended = onPlaybackEnd;
      audio.onerror = () => {
        this.fallbackTTS(text, onPlaybackEnd);
      };
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          this.fallbackTTS(text, onPlaybackEnd);
        });
      }
    } else {
      this.fallbackTTS(text, onPlaybackEnd);
    }
  }

  fallbackTTS(text, onEnd) {
    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }
    try {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-TW';
      utter.rate = 0.96;
      utter.pitch = 1.05;
      utter.onend = onEnd;
      utter.onerror = onEnd;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      if (onEnd) onEnd();
    }
  }
}

window.soundSystem = new SoundSystem();
window.voiceSystem = new VoiceSystem();
