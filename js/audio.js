/**
 * Web Audio API 音效、真實貓叫聲庫與小主人語音合成系統
 * 專為《小女生：膠水貓大冒險》設計
 * 整合：
 * 1. 22 種來自 YouTube 影片的真實貓叫聲（涵蓋撒嬌、討食、雀躍、呼嚕咕嚕、奶音、長音呼喚等）
 * 2. Web Audio API 零延遲多音軌播放與隨機微調音高
 * 3. 臺灣國語小主人語音系統 (VoiceSystem) 呈現溫暖對話
 */

const MEOW_CATALOG = [
  // 1. 幼貓稚嫩奶萌 (Sweet / Kitten)
  { id: "cat10_kitten_01", file: "audio/meows/cat10_kitten_01.mp3", label: "小奶貓初啼", category: "sweet", desc: "幼貓剛睡醒稚嫩清脆的短喵", duration: 0.9 },
  { id: "cat10_kitten_02", file: "audio/meows/cat10_kitten_02.mp3", label: "幼貓撒嬌點頭", category: "sweet", desc: "高音萌感小奶貓撒嬌", duration: 1.3 },
  { id: "cat10_kitten_03", file: "audio/meows/cat10_kitten_03.mp3", label: "黏人小奶貓", category: "sweet", desc: "輕柔綿密的討抱抱叫聲", duration: 1.05 },
  { id: "cat10_kitten_04", file: "audio/meows/cat10_kitten_04.mp3", label: "奶萌輕喚", category: "sweet", desc: "好奇探頭時的小聲輕喵", duration: 0.9 },
  { id: "cat10_kitten_05", file: "audio/meows/cat10_kitten_05.mp3", label: "小女生尋找主人", category: "sweet", desc: "小步跑向主人時的連續輕快短鳴", duration: 0.85 },

  // 2. 委屈討抱與深情呼喚 (Calling / Plaintive)
  { id: "cat10_cry_01", file: "audio/meows/cat10_cry_01.mp3", label: "委屈討抱長音", category: "calling", desc: "尾音上揚的甜美渴望叫聲", duration: 1.45 },
  { id: "cat10_cry_02", file: "audio/meows/cat10_cry_02.mp3", label: "黏人找主人", category: "calling", desc: "充滿依賴感的情感呼喚", duration: 1.8 },
  { id: "cat10_cry_03", file: "audio/meows/cat10_cry_03.mp3", label: "大聲尋求陪伴", category: "calling", desc: "悠長婉轉的撒嬌哀鳴", duration: 3.05 },
  { id: "cat10_cry_04", file: "audio/meows/cat10_cry_04.mp3", label: "門外深情呼喚", category: "calling", desc: "深切渴望靠近主人的聲音", duration: 2.3 },

  // 3. 肚子餓討食渴望 (Hungry)
  { id: "cat10_hungry_01", file: "audio/meows/cat10_hungry_01.mp3", label: "急促討小魚乾", category: "hungry", desc: "聞到魚乾香味時迫不及待的催促叫聲", duration: 1.9 },
  { id: "cat10_hungry_02", file: "audio/meows/cat10_hungry_02.mp3", label: "大口要點心", category: "hungry", desc: "節奏分明、清脆有力的討吃聲", duration: 2.8 },
  { id: "cat10_hungry_03", file: "audio/meows/cat10_hungry_03.mp3", label: "肚子咕嚕嚕催飯", category: "hungry", desc: "尾音加重的飢餓抗議", duration: 1.9 },
  { id: "cat10_hungry_04", file: "audio/meows/cat10_hungry_04.mp3", label: "碗空了提醒主人", category: "hungry", desc: "直盯著空碗發出的提醒喵聲", duration: 1.65 },

  // 4. 沉穩成熟雄厚喵鳴 (Alert / Powerful)
  { id: "cat10_loud_01", file: "audio/meows/cat10_loud_01.mp3", label: "沉穩霸氣公貓鳴", category: "alert", desc: "共鳴極深、穿透力十足的嘹亮長鳴", duration: 2.7 },
  { id: "cat10_loud_02", file: "audio/meows/cat10_loud_02.mp3", label: "雄厚宣告主權", category: "alert", desc: "低沉厚重的大貓威嚴喵叫", duration: 3.6 },
  { id: "cat10_loud_03", file: "audio/meows/cat10_loud_03.mp3", label: "高聲巡視領地", category: "alert", desc: "在客廳最高處發出的宣告長嘯", duration: 2.7 },

  // 5. 看到獵物牙齒打顫/雀躍鳥鳴碎叫 (Playful / Chattering)
  { id: "cat10_chatter_01", file: "audio/meows/cat10_chatter_01.mp3", label: "窗外小鳥牙齒打顫", category: "playful", desc: "看到窗外飛動目標時牙齒快速雀躍碎鳴", duration: 0.85 },
  { id: "cat10_chatter_02", file: "audio/meows/cat10_chatter_02.mp3", label: "興奮鳥鳴碎叫", category: "playful", desc: "極度激動時喉嚨發出的顫音 (Chatter)", duration: 0.85 },
  { id: "cat10_chatter_03", file: "audio/meows/cat10_chatter_03.mp3", label: "鎖定羽毛蓄勢待發", category: "playful", desc: "緊盯逗貓棒羽毛時的短促連鎖顫叫", duration: 0.7 },
  { id: "cat10_chatter_04", file: "audio/meows/cat10_chatter_04.mp3", label: "撲爪前的碎鳴", category: "playful", desc: "撲向毛線球時興奮的咔噠聲", duration: 1.25 },

  // 6. 戲劇化波浪歌唱/碎碎念 (Growl / Whining)
  { id: "cat10_opera_01", file: "audio/meows/cat10_opera_01.mp3", label: "戲劇化波浪歌唱", category: "growl", desc: "起伏如歌劇般浮誇的戲劇性長音", duration: 3.1 },
  { id: "cat10_opera_02", file: "audio/meows/cat10_opera_02.mp3", label: "深情高低音轉折", category: "growl", desc: "從高音滑向低音的幽默抱怨叫聲", duration: 3.0 },
  { id: "cat10_opera_03", file: "audio/meows/cat10_opera_03.mp3", label: "不服氣的碎碎唸", category: "growl", desc: "宛如跟主人頂嘴講道理的長串喵嗚", duration: 3.0 },

  // 7. 喉音呼嚕親親鳴/摸下巴 (Happy / Trill)
  { id: "cat10_trill_01", file: "audio/meows/cat10_trill_01.mp3", label: "喉音呼嚕親親鳴", category: "happy", desc: "伴隨喉部微震的溫暖呼嚕喵 (Trill)", duration: 2.0 },
  { id: "cat10_trill_02", file: "audio/meows/cat10_trill_02.mp3", label: "摸摸下巴滿足呢喃", category: "happy", desc: "舒服閉眼時發出的軟綿綿咕嚕聲", duration: 2.3 },
  { id: "cat10_trill_03", file: "audio/meows/cat10_trill_03.mp3", label: "翻肚伸懶腰輕哼", category: "happy", desc: "四腳朝天露出白肚子時的放鬆哼鳴", duration: 2.0 },

  // 8. 清脆利落的互動回應 (Response / Dialogue)
  { id: "cat10_response_01", file: "audio/meows/cat10_response_01.mp3", label: "一聲清脆回應", category: "response", desc: "主人叫「小女生」時立刻回答的「喵！」", duration: 0.9 },
  { id: "cat10_response_02", file: "audio/meows/cat10_response_02.mp3", label: "活潑應答「我在這」", category: "response", desc: "節奏明快的乾脆肯定聲", duration: 0.9 },
  { id: "cat10_response_03", file: "audio/meows/cat10_response_03.mp3", label: "跟主人對話點頭", category: "response", desc: "尾音輕快短促的對話叫聲", duration: 0.8 },
  { id: "cat10_response_04", file: "audio/meows/cat10_response_04.mp3", label: "一唱一和「好唷」", category: "response", desc: "開心答應主人指令的默契喵叫", duration: 0.65 }
];

window.MEOW_CATALOG = MEOW_CATALOG;

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.isMuted = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;

    // 真實貓叫聲快取庫
    this.catalog = MEOW_CATALOG;
    this.audioBuffers = new Map();
    this.audioElements = new Map();
    this.isPurring = false;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    this.bgmGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.sfxGain.connect(this.masterGain);

    // 啟動時非阻塞式預載入真實貓叫聲
    this.preloadRealMeows();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.init();
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.85, this.ctx.currentTime);
    }
    if (window.voiceSystem) {
      window.voiceSystem.isMuted = this.isMuted;
    }
    return this.isMuted;
  }

  preloadRealMeows() {
    // 預先以 fetch 加載 AudioBuffer
    this.catalog.forEach(item => {
      fetch(item.file)
        .then(res => {
          if (!res.ok) throw new Error('Fetch failed');
          return res.arrayBuffer();
        })
        .then(buf => this.ctx.decodeAudioData(buf))
        .then(decoded => {
          this.audioBuffers.set(item.id, decoded);
        })
        .catch(() => {
          // 降級以 HTML5 Audio Element 支援
          try {
            const audio = new Audio(item.file);
            audio.preload = 'auto';
            this.audioElements.set(item.id, audio);
          } catch (e) {}
        });
    });
  }

  /**
   * 播放真實貓叫聲 (支援類別篩選或指定 ID)
   * @param {string} categoryOrId - 類別 ('sweet', 'hungry', 'chirp', etc.) 或具體 id
   * @returns {object} 被播放的叫聲中繼資料
   */
  playRealMeow(categoryOrId = 'random') {
    this.init();
    this.resume();
    if (this.isMuted) return null;

    let candidates = this.catalog;
    if (categoryOrId && categoryOrId !== 'random') {
      const byId = this.catalog.find(m => m.id === categoryOrId);
      if (byId) {
        candidates = [byId];
      } else {
        const byCat = this.catalog.filter(m => m.category === categoryOrId);
        if (byCat.length > 0) candidates = byCat;
      }
    }

    const item = candidates[Math.floor(Math.random() * candidates.length)] || this.catalog[0];

    // 優先使用 Web Audio API 解碼 Buffer 播放（具備隨機微幅 pitch 變奏）
    if (this.audioBuffers.has(item.id)) {
      try {
        const buffer = this.audioBuffers.get(item.id);
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        // 隨機微調播放速率 0.96 ~ 1.04，使同一段叫聲每次聽起來都有細膩真實感
        source.playbackRate.value = 0.96 + Math.random() * 0.08;
        source.connect(this.sfxGain);
        source.start(0);
        return item;
      } catch (e) {}
    }

    // 備用方案：使用 HTML5 Audio 物件
    try {
      const audio = new Audio(item.file);
      audio.volume = 0.8;
      audio.play().catch(() => {
        // 若完全不支援音訊檔案則降級為程式合成
        this.playSyntheticMeow(item.category);
      });
      return item;
    } catch (e) {
      this.playSyntheticMeow('cute');
      return item;
    }
  }

  /**
   * 貓咪喵喵叫主入口（全面對接真實音頻庫）
   */
  playMeow(type = 'cute') {
    const catMap = {
      'cute': 'sweet',
      'loud': 'alert',
      'high': 'sweet',
      'low': 'calling',
      'happy': 'happy',
      'playful': 'playful',
      'sleepy': 'sweet',
      'chirp': 'playful',
      'drama': 'growl',
      'hungry': 'hungry',
      'calling': 'calling',
      'response': 'response',
      'alert': 'alert',
      'growl': 'growl'
    };
    const targetCategory = catMap[type] || type || 'sweet';
    return this.playRealMeow(targetCategory);
  }

  /**
   * 純代碼即時合成喵叫聲（作為無網路或解碼異常時的底層保證）
   */
  playSyntheticMeow(category = 'cute') {
    if (this.isMuted) return;
    const t = this.ctx.currentTime;
    let startFreq = 480, peakFreq = 680, endFreq = 400, duration = 0.6;

    if (category === 'hungry' || category === 'loud') {
      startFreq = 420; peakFreq = 780; endFreq = 460; duration = 0.9;
    } else if (category === 'kitten' || category === 'high') {
      startFreq = 540; peakFreq = 860; endFreq = 500; duration = 0.55;
    }

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(peakFreq, t + duration * 0.35);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(700, t);
    filter.frequency.exponentialRampToValueAtTime(1400, t + duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(600, t + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.6, t + 0.08);
    gain.gain.setValueAtTime(0.48, t + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  /**
   * 貓咪舒服呼嚕聲 (Cat Purring Rumble)
   */
  startPurr() {
    this.init();
    this.resume();
    // 嚴格單一實例防重疊保護：若已在呼嚕中，絕不重複創建音頻節點
    if (this.isMuted || this.isPurring || this.purrSource) return;

    const t = this.ctx.currentTime;
    // 使用調製的低頻噪聲產生呼嚕聲
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // 低通濾波 (過濾掉尖銳高頻，保留溫暖厚實的喉間震動)
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(90, t);

    // LFO 調製呼嚕節奏 (約 22Hz 貓科自然呼嚕震顫頻率)
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(22, t);

    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.5, t);

    const purrGain = this.ctx.createGain();
    purrGain.gain.setValueAtTime(0.001, t);
    purrGain.gain.linearRampToValueAtTime(0.4, t + 0.12);

    lfo.connect(purrGain.gain);
    whiteNoise.connect(filter);
    filter.connect(purrGain);
    purrGain.connect(this.sfxGain);

    whiteNoise.start(t);
    lfo.start(t);

    this.isPurring = true;
    this.purrSource = whiteNoise;
    this.purrLfo = lfo;
    this.purrGain = purrGain;
    this.purrFilter = filter;
  }

  stopPurr() {
    this.isPurring = false;
    const src = this.purrSource;
    const lfo = this.purrLfo;
    const gain = this.purrGain;
    const filter = this.purrFilter;

    this.purrSource = null;
    this.purrLfo = null;
    this.purrGain = null;
    this.purrFilter = null;

    if (gain && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.08); // 平滑漸出，杜絕任何爆音
      } catch (e) {}
    }

    setTimeout(() => {
      try {
        if (src) { src.stop(); src.disconnect(); }
        if (lfo) { lfo.stop(); lfo.disconnect(); }
        if (gain) { gain.disconnect(); }
        if (filter) { filter.disconnect(); }
      } catch (e) {}
    }, 90);
  }

  /**
   * 答對/過關 成功和弦 (Victory Chime)
   */
  playSuccess() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = this.ctx.currentTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  /**
   * 點擊/選擇 UI 音效
   */
  playClick() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.04);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * 答錯提示音 (Soft boop)
   */
  playError() {
    this.init();
    this.resume();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.18);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  /**
   * 溫馨 Lo-Fi 背景音樂合成器 (Cmaj7 - Am7 - Dm7 - G7 循環和弦)
   */
  toggleBGM() {
    this.init();
    this.resume();
    this.bgmPlaying = !this.bgmPlaying;

    if (this.bgmPlaying) {
      this.startBGMProgression();
    } else {
      if (this.bgmTimer) clearInterval(this.bgmTimer);
    }
    return this.bgmPlaying;
  }

  startBGMProgression() {
    // 溫暖和弦進行：Cmaj7 -> Am7 -> Dm7 -> G7
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // C, E, G, B (Cmaj7)
      [220.00, 261.63, 329.63, 392.00], // A, C, E, G (Am7)
      [293.66, 349.23, 440.00, 523.25], // D, F, A, C (Dm7)
      [196.00, 246.94, 293.66, 349.23], // G, B, D, F (G7)
    ];

    let chordIdx = 0;
    const playChord = () => {
      if (!this.bgmPlaying || this.isMuted) return;
      const now = this.ctx.currentTime;
      const currentNotes = chords[chordIdx];

      currentNotes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.2 + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmGain);

        osc.start(now + i * 0.05);
        osc.stop(now + 2.3);
      });

      chordIdx = (chordIdx + 1) % chords.length;
    };

    playChord();
    this.bgmTimer = setInterval(playChord, 2400);
  }
}

// 導出全域音效系統實例
window.soundSystem = new SoundSystem();

/**
 * 臺灣國語小主人語音合成系統 (VoiceSystem)
 * 呼應教材鍾怡雯散文溫暖、知性的作者/小主人語調
 */
class VoiceSystem {
  constructor() {
    this.synth = (typeof window !== 'undefined' && window.speechSynthesis) ? window.speechSynthesis : null;
    this.voices = [];
    this.selectedVoice = null;
    this.isMuted = false;
    this.subtitleTimer = null;
    this.currentAudio = null;

    // 預先母帶製作之溫柔自然女聲真實音軌庫（消除機械合成音）
    this.clipMap = {
      'call': { file: 'audio/voice/call.mp3', text: '小女生——！快過來～' },
      'pet': { file: 'audio/voice/pet.mp3', text: '真乖～摸摸下巴，好享受呢！' },
      'feed': { file: 'audio/voice/feed.mp3', text: '來吃香噴噴的小魚乾囉！多吃一點～' },
      'wand': { file: 'audio/voice/wand.mp3', text: '看這邊！抓得到羽毛嗎？跳得真高！' },
      'sofa': { file: 'audio/voice/sofa.mp3', text: '小女生快來，一起坐在沙發上休息吧！' },
      'chat': { file: 'audio/voice/chat.mp3', text: '小女生，今天心情好嗎？' },
      'tv': { file: 'audio/voice/tv.mp3', text: '小女生你看，電視水族館的小魚游得多開心！' },
      'tree': { file: 'audio/voice/tree.mp3', text: '小女生，要不要爬上貓跳台看風景呀？' },
      'belly': { file: 'audio/voice/belly.mp3', text: '摸摸毛茸茸的白肚子，像蓋了一條白色小被子呢！' },
      'treat_empty': { file: 'audio/voice/treat_empty.mp3', text: '點心吃光囉！快回答國語題目賺小魚乾吧～' },
      'praise': { file: 'audio/voice/praise.mp3', text: '太棒了，答對囉！小女生好崇拜你！' }
    };

    this.audioPool = {};
    Object.keys(this.clipMap).forEach(k => {
      try {
        const aud = new Audio(this.clipMap[k].file);
        aud.preload = 'auto';
        this.audioPool[k] = aud;
      } catch (e) {}
    });

    this.init();
  }

  init() {
    if (!this.synth) return;
    const findVoice = () => {
      this.voices = this.synth.getVoices();
      // 優先挑選繁體中文 (zh-TW) 自然女聲
      this.selectedVoice = this.voices.find(v => (v.lang === 'zh-TW' || v.lang === 'zh_TW') && (v.name.includes('Mei-Jia') || v.name.includes('Sandy') || v.name.includes('Female') || v.name.includes('女') || v.name.includes('Sin-Ji') || v.name.includes('Yating')))
        || this.voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh_TW')
        || this.voices.find(v => v.lang && v.lang.toLowerCase().startsWith('zh'))
        || null;
    };
    findVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = findVoice;
    }
  }

  speak(textOrKey, subtitleTitle = '小主人（鍾怡雯老師）', callback = null) {
    if (this.isMuted) {
      if (callback) callback();
      return;
    }

    // 尋找匹配的高音質自然語音檔案
    let foundEntry = this.clipMap[textOrKey];
    if (!foundEntry) {
      // 比對文字前綴或關鍵字
      const k = Object.keys(this.clipMap).find(key => {
        const t = this.clipMap[key].text;
        return textOrKey.includes(t.slice(0, 4)) || t.includes(textOrKey.slice(0, 4));
      });
      if (k) foundEntry = this.clipMap[k];
    }

    const displayText = foundEntry ? foundEntry.text : textOrKey;
    this.showSubtitle(displayText, subtitleTitle);

    if (foundEntry) {
      // 停止先前播放的語音
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }
      const audio = new Audio(foundEntry.file + '?v=user_voice_1');
      this.currentAudio = audio;
      audio.volume = 0.95;
      if (callback) audio.onended = callback;
      audio.play().catch(() => {
        this.speakFallback(displayText, callback);
      });
      return;
    }

    this.speakFallback(displayText, callback);
  }

  speakFallback(text, callback) {
    if (this.isMuted || !this.synth) {
      if (callback) callback();
      return;
    }

    try {
      this.synth.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) utter.voice = this.selectedVoice;
      utter.lang = 'zh-TW';
      utter.rate = 0.95;
      utter.pitch = 1.15;
      utter.volume = 0.95;
      if (callback) utter.onend = callback;
      this.synth.speak(utter);
    } catch (e) {
      if (callback) callback();
    }
  }

  showSubtitle(text, title = '小主人') {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('owner-voice-bubble');
    if (!el) return;
    el.innerHTML = `
      <div class="speech-avatar">🧑‍🎨</div>
      <div class="speech-body">
        <div class="speech-name">${title}</div>
        <div class="speech-content">${text}</div>
      </div>
    `;
    el.classList.remove('hidden');
    el.classList.add('pop-in');
    clearTimeout(this.subtitleTimer);
    this.subtitleTimer = setTimeout(() => {
      el.classList.remove('pop-in');
      el.classList.add('hidden');
    }, 4200);
  }
}

// 導出全域小主人語音系統實例
window.voiceSystem = new VoiceSystem();

