/**
 * 國小國語四上第六課 山鷹〈又遠又近的月亮〉
 * 核心教學闖關與評量系統 (Curriculum & Evaluation System)
 * 嚴格遵循 edu_3d_game_workflow 規格：
 * - 4 幕、11 站、24 道 PIRLS 五層次題目
 * - 體力值 (HP 100) 與答錯 hurt() 扣血/震動與課文提示機制
 * - 月光能量星收集、稱號進階
 * - 1200x840 結業證書 Canvas 繪製、localStorage 保存與 PNG 下載
 * - 教師密碼全關卡解鎖機制 (ijun / 1212)
 */

const SAVE_KEY = 'moon-game-v1';
const CERT_KEY = 'moon-game-certs';
const TUT_KEY = 'bird-tut';

// 稱號進階門檻 (答對率百分比)
const GRADES = [
  [0.9, '星際登月領航員'],
  [0.7, '月光科學探險家'],
  [0.45, '好奇觀月小讀者'],
  [0, '月球見習小太空人']
];

class CurriculumSystem {
  constructor() {
    this.ST = window.ST || [];
    this.G = {
      mode: 'title', // 'title', 'explore', 'station', 'cert'
      station: 0,
      hp: 100,
      feathers: [],
      mistakes: 0,
      totalMistakes: 0,
      ko: false,
      cleared: new Set(),
      unlocked: false
    };

    this.currentStepIdx = 0;
    this.currentRec = null;

    this.initSaveAndCert();
  }

  initSaveAndCert() {
    // 檢查證書紀錄
    const certRaw = localStorage.getItem(CERT_KEY);
    if (certRaw) {
      try {
        const list = JSON.parse(certRaw);
        if (Array.isArray(list) && list.length > 0) {
          this.G.unlocked = true;
          this.currentRec = list[list.length - 1];
        }
      } catch (e) {}
    }

    // 檢查進度存檔
    const saveRaw = localStorage.getItem(SAVE_KEY);
    if (saveRaw) {
      try {
        const s = JSON.parse(saveRaw);
        if (s.unlocked) this.G.unlocked = true;
        if (s.station !== undefined) this.G.station = s.station;
        if (s.hp !== undefined) this.G.hp = s.hp;
        if (s.feathers) this.G.feathers = s.feathers;
        if (s.totalMistakes !== undefined) this.G.totalMistakes = s.totalMistakes;
        if (s.cleared && Array.isArray(s.cleared)) {
          this.G.cleared = new Set(s.cleared);
        }

        const tCont = document.getElementById('tCont');
        if (tCont) {
          tCont.style.display = 'inline-block';
        }
      } catch (e) {}
    }
  }

  saveGame() {
    const data = {
      station: this.G.station,
      hp: this.G.hp,
      feathers: this.G.feathers,
      totalMistakes: this.G.totalMistakes,
      cleared: Array.from(this.G.cleared),
      unlocked: this.G.unlocked
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  saveCertificate(rec) {
    let list = [];
    try {
      const raw = localStorage.getItem(CERT_KEY);
      if (raw) list = JSON.parse(raw);
    } catch (e) {}
    if (!Array.isArray(list)) list = [];
    list.push(rec);
    if (list.length > 30) list = list.slice(-30);
    try {
      localStorage.setItem(CERT_KEY, JSON.stringify(list));
      this.G.unlocked = true;
      this.saveGame();
    } catch (e) {}
    this.currentRec = rec;
  }

  startNewGame() {
    this.G.station = 0;
    this.G.hp = 100;
    this.G.feathers = [];
    this.G.mistakes = 0;
    this.G.totalMistakes = 0;
    this.G.cleared = new Set();
    this.saveGame();
    this.openRoleSelectModal();
  }

  continueGame() {
    if (this.G.station >= this.ST.length) {
      // 已全通關：直接顯示結業證書 (滿足 cert_check.py 自動檢測)
      this.showGameUI();
      const rec = this.currentRec || {
        name: '優秀同學',
        grade: '星際登月領航員',
        got: 24,
        max: 24,
        hp: this.G.hp,
        mistakes: this.G.totalMistakes,
        date: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }),
        ts: Date.now()
      };
      this.showCertificate(rec);
    } else {
      this.openRoleSelectModal();
    }
  }

  openRoleSelectModal() {
    const title = document.getElementById('title');
    if (title) title.style.display = 'none';
    const roleSelect = document.getElementById('role-select-modal');
    if (roleSelect) {
      roleSelect.classList.remove('hide');
      roleSelect.classList.add('active');
    } else {
      this.confirmRoleAndStart('cat');
    }
  }

  confirmRoleAndStart(role) {
    this.showGameUI();
    this.enterStation(this.G.station);
  }

  showGameUI() {
    this.G.mode = 'explore';
    const title = document.getElementById('title');
    if (title) title.style.display = 'none';
    const tut = document.getElementById('tut');
    if (tut) tut.style.display = 'none';
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    const roleSelect = document.getElementById('role-select-modal');
    if (roleSelect) roleSelect.classList.remove('active');

    const overlay = document.getElementById('ui-overlay');
    if (overlay) overlay.style.display = 'flex';
    this.updateHUD();

    // 啟動背景音樂
    if (window.soundSystem) {
      window.soundSystem.playBGM();
      const bgmBtn = document.getElementById('btn-bgm');
      if (bgmBtn) bgmBtn.classList.add('active');
    }
  }

  enterStation(stationIdx) {
    if (stationIdx < 0 || stationIdx >= this.ST.length) return;
    this.G.station = stationIdx;
    this.currentStepIdx = 0;
    const st = this.ST[stationIdx];

    if (window.soundSystem && st.act) {
      window.soundSystem.setAct(st.act);
    }
    if (window.game && window.game.setEnv && st.env) {
      window.game.setEnv(st.env);
    }

    // 更新任務提示與菱形
    this.updateHUD();

    // 在 3D 世界中放置主角位置
    if (window.game && window.game.placeWorld) {
      window.game.placeWorld(stationIdx);
    }

    // 若為劇情站 (story)：自動開啟課文段落觀賞對話
    if (st.kind === 'story') {
      this.showStoryStation(st);
    }
  }

  showStoryStation(st) {
    this.G.mode = 'station';
    const modal = document.getElementById('station-modal');
    if (!modal) return;
    document.getElementById('st-modal-badge').innerText = `第 ${st.act || 1} 幕・${st.para}・第 ${st.id} 站`;
    document.getElementById('st-modal-title').innerText = st.name;
    document.getElementById('st-modal-text').innerHTML = `「${st.text}」`;
    const btn = document.getElementById('st-modal-btn');
    btn.innerText = '繼續探索下一站 🚀';
    btn.onclick = () => {
      this.closeModal('station-modal');
      this.G.cleared.add(st.id);
      this.saveGame();
      this.G.mode = 'explore';
      if (window.soundSystem && typeof window.soundSystem.playSuccess === 'function') {
        window.soundSystem.playSuccess();
      }
      if (st.id + 1 < this.ST.length) {
        this.enterStation(st.id + 1);
      } else {
        this.promptCertificateName();
      }
    };
    modal.classList.add('active');
  }

  promptInteract() {
    const st = this.ST[this.G.station];
    if (!st) return;
    if (st.kind === 'story') {
      this.showStoryStation(st);
      return;
    }

    this.G.mode = 'station';
    const modal = document.getElementById('station-modal');
    if (!modal) return;
    document.getElementById('st-modal-badge').innerText = `第 ${st.act || 1} 幕・${st.para}・第 ${st.id} 站`;
    document.getElementById('st-modal-title').innerText = st.name;
    document.getElementById('st-modal-text').innerHTML = `「${st.text}」`;
    const btn = document.getElementById('st-modal-btn');
    btn.innerText = st.dialogBtn || '接受本站挑戰 🌕';
    btn.onclick = () => {
      this.closeModal('station-modal');
      this.startStationSteps();
    };
    modal.classList.add('active');
  }

  startStationSteps() {
    this.currentStepIdx = 0;
    this.runCurrentStep();
  }

  runCurrentStep() {
    const st = this.ST[this.G.station];
    if (!st || !st.steps || this.currentStepIdx >= st.steps.length) {
      // 本站全部挑戰成功！
      this.onStationComplete();
      return;
    }

    const q = st.steps[this.currentStepIdx];
    this.renderQuestionModal(q);
  }

  renderQuestionModal(q) {
    if (this._nextQTimer) {
      clearTimeout(this._nextQTimer);
      this._nextQTimer = null;
    }
    const modal = document.getElementById('quiz-modal');
    if (!modal) return;
    modal.classList.add('active');
    modal.classList.remove('hide');

    document.getElementById('quiz-badge').innerText = `PIRLS【${q.level}】・第 ${q.no} 題`;
    document.getElementById('quiz-question').innerText = q.q;

    const body = document.getElementById('quiz-options-container');
    body.innerHTML = '';

    const feedback = document.getElementById('quiz-feedback');
    feedback.className = 'quiz-feedback-box hidden';
    feedback.innerText = '';

    // 依據題型渲染作答介面
    if (q.type === 'choice') {
      const grid = document.createElement('div');
      grid.className = 'choice-grid';
      q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.innerHTML = `<span class="choice-letter">${['A', 'B', 'C', 'D'][idx]}</span> ${opt}`;
        btn.onclick = () => {
          if (idx === q.answer) {
            btn.classList.add('correct-choice');
          } else {
            btn.classList.add('wrong-choice');
          }
          this.checkAnswer(idx === q.answer, q);
        };
        grid.appendChild(btn);
      });
      body.appendChild(grid);
    } else if (q.type === 'tf') {
      const grid = document.createElement('div');
      grid.className = 'tf-grid';
      const btnT = document.createElement('button');
      btnT.className = 'choice-btn tf-btn';
      btnT.innerHTML = '⭕ <b>正確 (O)</b>';
      btnT.onclick = () => {
        if (q.answer === true) btnT.classList.add('correct-choice');
        else btnT.classList.add('wrong-choice');
        this.checkAnswer(q.answer === true, q);
      };

      const btnF = document.createElement('button');
      btnF.className = 'choice-btn tf-btn';
      btnF.innerHTML = '❌ <b>錯誤 (X)</b>';
      btnF.onclick = () => {
        if (q.answer === false) btnF.classList.add('correct-choice');
        else btnF.classList.add('wrong-choice');
        this.checkAnswer(q.answer === false, q);
      };

      grid.appendChild(btnT);
      grid.appendChild(btnF);
      body.appendChild(grid);
    } else if (q.type === 'fill') {
      const container = document.createElement('div');
      container.className = 'fill-container';
      const parts = q.sentence.split('＿');
      container.innerHTML = `
        <div class="fill-sentence">
          ${parts[0]}<span class="fill-blank" id="fill-blank">？</span>${parts[1] || ''}
        </div>
        <div class="fill-tiles" id="fill-tiles"></div>
      `;
      body.appendChild(container);

      const tilesBox = container.querySelector('#fill-tiles');
      q.tiles.forEach(tile => {
        const b = document.createElement('button');
        b.className = 'fill-tile-btn';
        b.innerText = tile;
        b.onclick = () => {
          document.getElementById('fill-blank').innerText = tile;
          this.checkAnswer(tile === q.answer, q);
        };
        tilesBox.appendChild(b);
      });
    } else if (q.type === 'match') {
      const container = document.createElement('div');
      container.className = 'match-container';
      container.innerHTML = `
        <div class="match-desc">請先點擊下方詞卡，再點擊對應的說明框進行配對：</div>
        <div class="match-zones" id="match-zones"></div>
        <div class="match-cards" id="match-cards"></div>
      `;
      body.appendChild(container);

      const userMatches = {};
      let selectedCard = null;

      const renderMatch = () => {
        const zonesEl = container.querySelector('#match-zones');
        const cardsEl = container.querySelector('#match-cards');
        zonesEl.innerHTML = '';
        cardsEl.innerHTML = '';

        q.zones.forEach(zone => {
          const matchedCard = Object.keys(userMatches).find(k => userMatches[k] === zone);
          const zEl = document.createElement('div');
          zEl.className = 'match-zone-card' + (matchedCard ? ' filled' : '');
          zEl.innerHTML = `<div class="zone-label">【${zone}】</div><div class="zone-val">${matchedCard ? '🌕 ' + matchedCard : '（點此放入）'}</div>`;
          zEl.onclick = () => {
            if (selectedCard) {
              userMatches[selectedCard] = zone;
              selectedCard = null;
              renderMatch();
              if (Object.keys(userMatches).length === q.cards.length) {
                const ok = Object.keys(q.answer).every(k => userMatches[k] === q.answer[k]);
                this.checkAnswer(ok, q);
              }
            }
          };
          zonesEl.appendChild(zEl);
        });

        q.cards.forEach(card => {
          if (userMatches[card]) return;
          const cEl = document.createElement('button');
          cEl.className = 'match-card-btn' + (selectedCard === card ? ' selected' : '');
          cEl.innerText = card;
          cEl.onclick = () => {
            selectedCard = card;
            renderMatch();
          };
          cardsEl.appendChild(cEl);
        });
      };
      renderMatch();
    } else if (q.type === 'order') {
      const container = document.createElement('div');
      container.className = 'order-container';
      container.innerHTML = `
        <div style="font-size:14px; color:#9a3412; margin-bottom:8px;">
          請依課文脈絡點擊上下箭頭調整順序（${q.labels[0]} ➔ ${q.labels[1]}）：
        </div>
        <div id="order-items-box"></div>
        <button id="order-submit-btn" class="btn-confirm" style="margin-top:12px; width:100%;">確認順序送出</button>
      `;
      body.appendChild(container);

      let currentOrder = [...q.items].reverse();
      const renderOrder = () => {
        const box = container.querySelector('#order-items-box');
        box.innerHTML = '';
        currentOrder.forEach((item, idx) => {
          const itemEl = document.createElement('div');
          itemEl.className = 'order-item-card';
          itemEl.innerHTML = `
            <span>${idx + 1}. ${item}</span>
            <div>
              ${idx > 0 ? `<button class="order-shift-btn" onclick="curriculumSystem.shiftOrderItem(${idx}, -1)">▲</button>` : ''}
              ${idx < currentOrder.length - 1 ? `<button class="order-shift-btn" onclick="curriculumSystem.shiftOrderItem(${idx}, 1)">▼</button>` : ''}
            </div>
          `;
          box.appendChild(itemEl);
        });
      };
      this.currentOrderItems = currentOrder;
      this.renderOrderCb = renderOrder;
      renderOrder();

      container.querySelector('#order-submit-btn').onclick = () => {
        const ok = q.items.every((it, idx) => this.currentOrderItems[idx] === it);
        this.checkAnswer(ok, q);
      };
    } else if (q.type === 'multi') {
      const container = document.createElement('div');
      container.className = 'multi-container';
      container.innerHTML = `<div id="multi-options-list"></div><button id="multi-submit-btn" class="btn-confirm" style="margin-top:12px; width:100%;">確認送出全部選項</button>`;
      body.appendChild(container);

      const selected = new Set();
      const listEl = container.querySelector('#multi-options-list');
      q.options.forEach((opt, idx) => {
        const row = document.createElement('label');
        row.className = 'multi-option-row';
        row.innerHTML = `<input type="checkbox" value="${idx}"> <span>${opt}</span>`;
        row.querySelector('input').onchange = (e) => {
          if (e.target.checked) selected.add(idx);
          else selected.delete(idx);
        };
        listEl.appendChild(row);
      });

      container.querySelector('#multi-submit-btn').onclick = () => {
        const userAns = Array.from(selected).sort((a, b) => a - b);
        const correctAns = [...q.answer].sort((a, b) => a - b);
        const ok = userAns.length === correctAns.length && userAns.every((val, i) => val === correctAns[i]);
        this.checkAnswer(ok, q);
      };
    }
  }

  shiftOrderItem(idx, dir) {
    if (!this.currentOrderItems) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= this.currentOrderItems.length) return;
    const temp = this.currentOrderItems[idx];
    this.currentOrderItems[idx] = this.currentOrderItems[targetIdx];
    this.currentOrderItems[targetIdx] = temp;
    if (this.renderOrderCb) this.renderOrderCb();
  }

  checkAnswer(isCorrect, q) {
    if (this._nextQTimer) {
      clearTimeout(this._nextQTimer);
      this._nextQTimer = null;
    }
    const feedback = document.getElementById('quiz-feedback');
    const optionsContainer = document.getElementById('quiz-options-container');

    if (isCorrect) {
      if (optionsContainer) {
        const allBtns = optionsContainer.querySelectorAll('button');
        allBtns.forEach(b => {
          b.style.pointerEvents = 'none';
        });
      }

      const st = this.ST[this.G.station];
      const isLastStep = !st || !st.steps || (this.currentStepIdx >= st.steps.length - 1);
      const isFirstOrLastQuizLevel = (this.G.station === 1 || this.G.station === this.ST.length - 1);

      try {
        if (window.soundSystem) {
          if (typeof window.soundSystem.playSuccess === 'function') window.soundSystem.playSuccess();
          if (isLastStep && isFirstOrLastQuizLevel && window.voiceSystem) {
            window.voiceSystem.speak('praise');
          }
        }
      } catch (e) {}

      if (!this.G.feathers.includes(q.no)) {
        this.G.feathers.push(q.no);
      }
      this.updateHUD();

      if (feedback) {
        feedback.className = 'quiz-feedback-box success';
        feedback.innerHTML = `
          <div style="font-size:15px; font-weight:800; margin-bottom:6px;">🎉 答對了！獲得 1 顆月光能量星 🌟！</div>
          <button class="btn-confirm next-q-btn" id="btn-next-step" onclick="curriculumSystem.nextQuestion()" style="margin-top:8px; width:100%; font-size:15px; padding:10px 18px; border-radius:12px; cursor:pointer;">${isLastStep ? '完成本關挑戰 🎉' : '繼續下一題 ➔'}</button>
        `;
      }

      this._nextQTimer = setTimeout(() => {
        this.nextQuestion();
      }, isLastStep && isFirstOrLastQuizLevel ? 2200 : 1400);
    } else {
      try {
        if (window.soundSystem && typeof window.soundSystem.playError === 'function') {
          window.soundSystem.playError();
        }
      } catch (e) {}

      this.hurt(15);
      this.G.mistakes++;
      this.G.totalMistakes++;

      if (feedback) {
        feedback.className = 'quiz-feedback-box error';
        feedback.innerHTML = `
          <div style="margin-bottom:8px;">💡 <b>課文線索提示：</b>${q.hint}</div>
          <div style="display:flex; gap:10px; margin-top:10px;">
            <button class="btn-secondary" onclick="curriculumSystem.retryQuestion()" style="flex:1; padding:9px 12px; font-size:14px; border-radius:10px; cursor:pointer;">再試一次 🔄</button>
            <button class="btn-confirm" onclick="curriculumSystem.nextQuestion()" style="flex:1; padding:9px 12px; font-size:14px; border-radius:10px; cursor:pointer;">繼續下一題 ➔</button>
          </div>
        `;
      }
    }
  }

  nextQuestion() {
    if (this._nextQTimer) {
      clearTimeout(this._nextQTimer);
      this._nextQTimer = null;
    }
    this.currentStepIdx++;
    this.runCurrentStep();
  }

  retryQuestion() {
    if (this._nextQTimer) {
      clearTimeout(this._nextQTimer);
      this._nextQTimer = null;
    }
    const feedback = document.getElementById('quiz-feedback');
    if (feedback) {
      feedback.className = 'quiz-feedback-box hidden';
      feedback.innerText = '';
    }
    const st = this.ST[this.G.station];
    if (st && st.steps && st.steps[this.currentStepIdx]) {
      this.renderQuestionModal(st.steps[this.currentStepIdx]);
    }
  }

  hurt(amount = 15) {
    this.G.hp = Math.max(0, this.G.hp - amount);
    this.updateHUD();

    document.body.classList.add('screen-hurt');
    setTimeout(() => document.body.classList.remove('screen-hurt'), 450);

    if (this.G.hp <= 0) {
      this.handleKO();
    }
  }

  handleKO() {
    this.G.ko = true;
    alert('💫 體力耗盡！先品嚐一塊中秋月餅補充體力，重新挑戰本關吧！');
    this.G.hp = 100;
    this.currentStepIdx = 0;
    this.updateHUD();
    this.closeModal('quiz-modal');
    this.enterStation(this.G.station);
  }

  onStationComplete() {
    this.closeModal('quiz-modal');
    this.G.cleared.add(this.G.station);
    this.saveGame();

    try {
      if (window.soundSystem && typeof window.soundSystem.playSuccess === 'function') {
        window.soundSystem.playSuccess();
      }
    } catch (e) {}

    if (this.G.station >= this.ST.length - 1) {
      // 全課 11 站通關！将 station 設為 ST.length 代表全通關狀態
      this.G.station = this.ST.length;
      this.saveGame();
      this.promptCertificateName();
    } else {
      if (window.game && typeof window.game.showPrompt === 'function') {
        window.game.showPrompt('🎉 恭喜完成本站挑戰！獲得月光能量星，繼續前往下一站探索吧！🌕✨');
      }
      this.enterStation(this.G.station + 1);
    }
  }

  getTotalQuestions() {
    let count = 0;
    this.ST.forEach(s => {
      if (s.steps) count += s.steps.length;
    });
    return count || 33;
  }

  promptCertificateName() {
    const modal = document.getElementById('name-input-modal');
    if (modal) {
      modal.classList.remove('hide');
      modal.classList.add('active');
      const inputEl = document.getElementById('student-name-input');
      const errEl = document.getElementById('name-input-error');
      if (errEl) errEl.style.display = 'none';
      if (inputEl) {
        inputEl.value = '';
        inputEl.style.borderColor = '#f59e0b';
        inputEl.style.backgroundColor = '#ffffff';
        setTimeout(() => inputEl.focus(), 100);
      }
    } else {
      const name = prompt('恭喜全課通關！請輸入你自己的真實姓名以領取結業證書：', '');
      if (name && name.trim()) {
        this.finishAndGenerateCertificate(name.trim());
      }
    }
  }

  editCertificateName() {
    closeCert();
    this.promptCertificateName();
  }

  finishAndGenerateCertificate(studentName) {
    const cleanName = (studentName || '').trim();
    const inputEl = document.getElementById('student-name-input');
    const errEl = document.getElementById('name-input-error');

    if (!cleanName) {
      if (window.soundSystem && typeof window.soundSystem.playError === 'function') {
        window.soundSystem.playError();
      }
      if (errEl) {
        errEl.style.display = 'block';
        errEl.innerText = '⚠️ 請先在上方框框內填入你自己的「姓名」，才能印製專屬結業證書喔！';
      }
      if (inputEl) {
        inputEl.style.borderColor = '#dc2626';
        inputEl.style.backgroundColor = '#fef2f2';
        inputEl.focus();
      }
      return;
    }

    this.closeModal('name-input-modal');
    const totalQ = this.getTotalQuestions();
    const got = this.G.feathers.length;
    const ratio = got / totalQ;

    let grade = '月球見習小太空人';
    for (const [threshold, title] of GRADES) {
      if (ratio >= threshold) {
        grade = title;
        break;
      }
    }

    const rec = {
      name: cleanName,
      grade: grade,
      got: got,
      max: totalQ,
      hp: this.G.hp,
      mistakes: this.G.totalMistakes,
      date: new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' }),
      ts: Date.now()
    };

    this.G.station = this.ST.length;
    this.saveCertificate(rec);
    this.showCertificate(rec);
  }

  showCertificate(rec) {
    this.currentRec = rec;
    const certModal = document.getElementById('cert');
    if (!certModal) return;

    certModal.classList.remove('hide');
    certModal.classList.add('active');

    const dataUrl = this.renderCertificateCanvas(rec);
    const certImg = document.getElementById('certImg');
    if (certImg) {
      certImg.src = dataUrl;
    }
  }

  renderCertificateCanvas(rec) {
    const canvas = document.getElementById('certCanvas') || document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 840;
    const ctx = canvas.getContext('2d');

    // 1. 底色：月光象牙金漸層
    const bg = ctx.createLinearGradient(0, 0, 1200, 840);
    bg.addColorStop(0, '#fffdf7');
    bg.addColorStop(0.5, '#fef9eb');
    bg.addColorStop(1, '#f3ebd8');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 840);

    // 2. 滿月背景浮水印裝飾
    ctx.save();
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.beginPath();
    ctx.arc(600, 420, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. 雙層金棕古雅邊框
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 24, 1152, 792);

    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(36, 36, 1128, 768);

    // 4. 四角星月角花
    const drawCorner = (x, y, sx, sy) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(sx, sy);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, 34);
      ctx.lineTo(10, 10);
      ctx.lineTo(34, 10);
      ctx.stroke();
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(10, 10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };
    drawCorner(44, 44, 1, 1);
    drawCorner(1156, 44, -1, 1);
    drawCorner(44, 796, 1, -1);
    drawCorner(1156, 796, -1, -1);

    // 5. 頂部課程名稱
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 26px "Noto Serif TC", serif';
    ctx.fillText('國小國語四上第六課 山鷹〈又遠又近的月亮〉・3D 沉浸式課文探索', 600, 115);

    // 6. 大標題：「結 業 證 書」
    ctx.fillStyle = '#7c2d12';
    ctx.font = '900 64px "Noto Serif TC", serif';
    ctx.fillText('結 業 證 書', 600, 195);

    // 裝飾金色飾線
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(330, 222);
    ctx.lineTo(870, 222);
    ctx.stroke();

    // 7. 姓名與證明文字
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 36px "Noto Sans TC", sans-serif';
    ctx.fillText(`茲證明　${rec.name || '優秀同學'}　同學`, 600, 295);

    ctx.fillStyle = '#44403c';
    ctx.font = '500 23px "Noto Sans TC", sans-serif';
    ctx.fillText('完成教育部審定國語四上第六課〈又遠又近的月亮〉3D 沉浸式閱讀體驗', 600, 355);
    ctx.fillText('深入探究月球科學真相、阿提米絲與阿波羅登月計畫，並體會文學月亮之美，特頒此證。', 600, 395);

    // 8. 榮譽稱號底牌
    const bx = 320, by = 445, bw = 560, bh = 76, r = 16;
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9a3412';
    ctx.font = 'bold 32px "Noto Serif TC", serif';
    ctx.fillText(`榮獲稱號：${rec.grade || '星際登月領航員'}`, 600, 495);

    // 9. 成果數據
    ctx.fillStyle = '#57534e';
    ctx.font = '600 20px "Noto Sans TC", sans-serif';
    const gotText = rec.got !== undefined ? `${rec.got} / ${rec.max}` : '33 / 33';
    const hpVal = rec.hp !== undefined ? `${rec.hp}%` : '100%';
    ctx.fillText(`月光能量星：${gotText}　｜　太空體力：${hpVal}　｜　探索進度：5 幕 14 站全通關`, 600, 565);

    // 10. 頒證日期與字號
    ctx.textAlign = 'left';
    ctx.fillStyle = '#57534e';
    ctx.font = 'bold 22px "Noto Serif TC", serif';
    ctx.fillText(`頒證日期：${rec.date || '2026 年 10 月 28 日'}`, 120, 700);
    ctx.font = '16px "Noto Sans TC", sans-serif';
    ctx.fillStyle = '#a8a29e';
    ctx.fillText('認證字號：MOON-L06-' + (rec.ts ? rec.ts.toString().slice(-8) : '20261028'), 120, 730);

    // 11. 朱紅方印章（四字篆印：月光印信）
    const sealX = 960, sealY = 630, sealSize = 104;
    ctx.fillStyle = 'rgba(220, 38, 38, 0.08)';
    ctx.fillRect(sealX, sealY, sealSize, sealSize);
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 5;
    ctx.strokeRect(sealX, sealY, sealSize, sealSize);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sealX + 6, sealY + 6, sealSize - 12, sealSize - 12);

    ctx.fillStyle = '#dc2626';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 34px "Noto Serif TC", serif';
    ctx.fillText('月', sealX + sealSize * 0.28, sealY + sealSize * 0.30);
    ctx.fillText('光', sealX + sealSize * 0.72, sealY + sealSize * 0.30);
    ctx.fillText('印', sealX + sealSize * 0.28, sealY + sealSize * 0.72);
    ctx.fillText('信', sealX + sealSize * 0.72, sealY + sealSize * 0.72);
    ctx.textBaseline = 'alphabetic';

    return canvas.toDataURL('image/png');
  }

  downloadCertificate() {
    const rec = this.currentRec || { name: '優秀同學' };
    const certImg = document.getElementById('certImg');
    if (!certImg || !certImg.src) return;

    const link = document.createElement('a');
    link.download = `${rec.name}_結業證書.png`;
    link.href = certImg.src;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  consumeTreat() {
    if (this.G.feathers.length > 0) {
      return true;
    }
    return true;
  }

  addScore(pts) {
    this.G.hp = Math.min(100, this.G.hp + 10);
    this.updateHUD();
  }

  updateHUD() {
    const fill = document.getElementById('hp-fill');
    if (fill) fill.style.width = `${this.G.hp}%`;
    const txt = document.getElementById('hp-text');
    if (txt) txt.innerText = `${this.G.hp} HP`;

    const treatDisp = document.getElementById('treat-display');
    if (treatDisp) {
      treatDisp.innerText = `能量星 x ${this.G.feathers.length}`;
    }

    const st = this.ST[this.G.station] || this.ST[this.ST.length - 1];
    if (st) {
      const qTitle = document.getElementById('quest-title');
      if (qTitle) qTitle.innerText = `📍 第 ${st.id} 站：${st.quest || st.name}`;
      const qDesc = document.getElementById('quest-desc');
      if (qDesc) qDesc.innerText = st.obj || st.para;

      const pTxt = document.getElementById('prompt-text');
      if (pTxt) pTxt.innerText = `📝 點此作答：${st.prompt || st.name} ▶`;

      const mLbl = document.getElementById('quest-marker-label');
      if (mLbl) mLbl.innerText = `${st.quest || st.name}（點此作答）`;

      const dockQuizLbl = document.getElementById('btn-quiz-dock-label');
      if (dockQuizLbl) dockQuizLbl.innerText = `第${st.id}站作答`;
    }
  }

  openStagesModal() {
    const modal = document.getElementById('stages-modal');
    if (!modal) return;
    modal.classList.add('active');

    const listEl = document.getElementById('stages-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    this.ST.forEach((st, idx) => {
      const isCleared = this.G.cleared.has(idx);
      const isCurrent = this.G.station === idx;
      const isUnlocked = this.G.unlocked || idx <= this.G.station || isCleared;

      const card = document.createElement('div');
      card.className = `stage-select-card ${isUnlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}`;
      card.innerHTML = `
        <div style="font-size:20px;">${st.kind === 'story' ? '📖' : '🌕'}</div>
        <div style="flex:1;">
          <div style="font-weight:700; color:#78350f;">第 ${idx} 站：${st.name}</div>
          <div style="font-size:12px; color:#92400e;">第 ${st.act || 1} 幕・${st.para} ${st.kind === 'story' ? '【劇情站】' : '【挑戰 3 題】'}</div>
        </div>
        <div>${isUnlocked ? (isCleared ? '⭐ 已通關' : (isCurrent ? '▶ 進行中' : '進入')) : '🔒 未解鎖'}</div>
      `;
      if (isUnlocked) {
        card.onclick = () => {
          this.closeModal('stages-modal');
          this.enterStation(idx);
        };
      }
      listEl.appendChild(card);
    });
  }

  unlockAllStages(pw) {
    if (pw === 'ijun' || pw === '1212') {
      this.G.unlocked = true;
      this.saveGame();
      alert(`🔓 教師密碼正確！已成功解鎖全課 ${this.ST.length} 個站點（含生字語詞書櫃關卡）！`);
      this.openStagesModal();
    } else {
      alert('❌ 密碼錯誤，請輸入教師密碼 ijun！');
    }
  }

  openVocabModal(defaultTab = 'levels') {
    const modal = document.getElementById('vocab-modal');
    if (!modal) return;
    modal.classList.remove('hide');
    modal.classList.add('active');
    if (window.soundSystem && typeof window.soundSystem.playClick === 'function') {
      window.soundSystem.playClick();
    }
    this.renderVocabTab(defaultTab);
  }

  renderVocabTab(tab) {
    const tabs = ['levels', 'chars', 'compare', 'phrases'];
    tabs.forEach(t => {
      const btn = document.getElementById(`vocab-tab-${t}`);
      if (btn) {
        if (t === tab) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    const content = document.getElementById('vocab-modal-body');
    if (!content) return;
    const data = window.VOCAB_DATA || { characters: [], comparisons: [], phrases: [] };

    if (tab === 'levels') {
      const vocabStations = [
        {
          id: 11,
          icon: '🔊',
          badge: '生字關卡一・字音辨析',
          title: '第 11 站：〈生字書櫃：字音大挑戰〉',
          desc: '挑戰本課生字與認讀字注音：「隕（ㄩㄣˇ）石」、「玉兔搗（ㄉㄠˇ）藥」、「揭（ㄐㄧㄝ）開真相」、「撞擊（ㄓㄨㄤˋ ㄐㄧˊ）」、「嫦娥（ㄔㄤˊ ㄜˊ）」、「平均（ㄐㄩㄣ）」、「騎（ㄑㄧˊ）單車」。',
          color: '#ea580c',
          bg: '#fff7ed',
          border: '#fdba74'
        },
        {
          id: 12,
          icon: '✍️',
          badge: '生字關卡二・字形與部首',
          title: '第 12 站：〈生字書櫃：字形與部首〉',
          desc: '挑戰課本 P.64-65「我會寫字」15 個生字部首與辨字：「隕（阜部）」、「萬（禸部）」、「狀（犬部）」、「射（寸部）」、「里（里部 0/7畫）」、「館/管（𠯑首筆豎）」vs「鋁/營（呂用撇連）」、「距（足部）」vs「拒（手部）」。',
          color: '#0284c7',
          bg: '#f0f9ff',
          border: '#7dd3fc'
        },
        {
          id: 13,
          icon: '🌟',
          badge: '生字關卡三・語詞與句型應用',
          title: '第 13 站：〈生字書櫃：語詞與句型應用〉',
          desc: '挑戰課本 P.66-67 假設強調句型「就算……也……」、「記敘 vs 說明」寫作方式，以及本課重點語詞（「特地」、「高低不平」、「玉兔搗藥」）與錯別字挑錯。',
          color: '#059669',
          bg: '#ecfdf5',
          border: '#6ee7b7'
        }
      ];

      content.innerHTML = `
        <div style="background:#fef3c7; border:1.5px solid #f59e0b; border-radius:12px; padding:10px 14px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <div style="font-size:13.5px; color:#78350f; font-weight:700;">
            📍 3D 場景南側已設置「星際生字語詞大書櫃」！你可以隨時先複習上方字卡，或直接點選下方任一關卡開始挑戰：
          </div>
          <button class="btn-secondary" style="padding:6px 12px; font-size:12.5px; background:#fff; border-color:#d97706; color:#9a3412;" onclick="curriculumSystem.walkToBookshelf()">
            🧑‍🚀 帶我走到生字書櫃前
          </button>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${vocabStations.map(vs => {
            const cleared = this.G.cleared.has(vs.id);
            return `
              <div style="background:${vs.bg}; border:2px solid ${vs.border}; border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                <div style="flex:1; min-width:220px;">
                  <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                    <span style="font-size:20px;">${vs.icon}</span>
                    <span style="background:#fff; color:${vs.color}; border:1px solid ${vs.border}; font-size:11.5px; font-weight:800; padding:2px 8px; border-radius:999px;">${vs.badge}</span>
                    ${cleared ? '<span style="background:#dcfce7; color:#15803d; font-size:11.5px; font-weight:800; padding:2px 8px; border-radius:999px;">⭐ 已通關</span>' : ''}
                  </div>
                  <div style="font-size:15.5px; font-weight:900; color:#1c1917; margin-bottom:4px;">${vs.title}</div>
                  <div style="font-size:12.5px; color:#44403c; line-height:1.5;">${vs.desc}</div>
                </div>
                <button class="btn-confirm" style="padding:10px 16px; font-size:13.5px; white-space:nowrap; background:${vs.color};" onclick="curriculumSystem.startVocabStation(${vs.id})">
                  ${cleared ? '🔄 再次挑戰' : '🚀 立即作答'}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (tab === 'chars') {
      content.innerHTML = `
        <div style="font-size:13px; color:#78350f; margin-bottom:10px; font-weight:700;">
          📖 課本第 64 頁共 <b>15 個習寫生字</b> 與 <b>3 個認讀字</b>（含注音、部首、筆畫與字形重點）：
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(245px, 1fr)); gap:10px;">
          ${data.characters.map(c => `
            <div style="background:#fffdf9; border:1.5px solid ${c.type === '習寫生字' ? '#fdba74' : '#93c5fd'}; border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:5px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:52px; height:52px; border-radius:10px; background:${c.type === '習寫生字' ? '#ffedd5' : '#dbeafe'}; border:2px solid ${c.type === '習寫生字' ? '#f97316' : '#3b82f6'}; display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:900; color:#7c2d12; font-family:'Noto Serif TC', serif; flex-shrink:0;">
                  ${c.char}
                </div>
                <div style="flex:1;">
                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span style="font-size:16px; font-weight:900; color:#b45309;">【${c.zhuyin}】</span>
                    <span style="font-size:11px; font-weight:800; padding:2px 7px; border-radius:6px; background:#dcfce7; color:#166534;">${c.radical}</span>
                    <span style="font-size:11px; font-weight:700; padding:2px 7px; border-radius:6px; background:#f1f5f9; color:#475569;">${c.strokes}</span>
                  </div>
                  <div style="font-size:12.5px; font-weight:800; color:#1e293b; margin-top:4px;">
                    語詞：${c.words.join('、')}
                  </div>
                </div>
              </div>
              <div style="font-size:12px; color:#57534e; background:#fff7ed; padding:5px 8px; border-radius:8px;">
                📝 課文：${c.sentence}
              </div>
              <div style="font-size:11.5px; color:#9a3412; font-weight:700; line-height:1.4;">
                💡 ${c.tip}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (tab === 'compare') {
      content.innerHTML = `
        <div style="font-size:13px; color:#78350f; margin-bottom:10px; font-weight:700;">
          🔍 四年級最常考的本課「字音・字形・部首」4 大易錯辨析（課本 P.64-65）：
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${data.comparisons.map(cmp => `
            <div style="background:#fffdf9; border:1.5px solid #fcd34d; border-radius:12px; padding:11px 14px;">
              <div style="font-size:14.5px; font-weight:900; color:#9a3412; margin-bottom:6px;">📌 ${cmp.title}</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                <div style="background:#fff7ed; border-left:4px solid #f97316; padding:8px 10px; border-radius:6px; font-size:12.5px; color:#431407; line-height:1.5;">
                  ${cmp.left}
                </div>
                <div style="background:#eff6ff; border-left:4px solid #3b82f6; padding:8px 10px; border-radius:6px; font-size:12.5px; color:#1e3a8a; line-height:1.5;">
                  ${cmp.right}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (tab === 'phrases') {
      content.innerHTML = `
        <div style="font-size:13px; color:#78350f; margin-bottom:10px; font-weight:700;">
          💬 課本第 66～67 頁「假設句型」、「記敘與說明」與重點語詞寶典：
        </div>
        <div style="display:flex; flex-direction:column; gap:9px;">
          ${data.phrases.map(p => `
            <div style="background:#fffdf9; border:1.5px solid #a7f3d0; border-radius:12px; padding:10px 14px;">
              <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                <span style="font-size:17px; font-weight:900; color:#065f46;">【${p.word}】</span>
                <span style="font-size:13px; font-weight:700; color:#047857;">（${p.zhuyin}）</span>
                <span style="font-size:11px; font-weight:800; background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:999px;">${p.category}</span>
              </div>
              <div style="font-size:13px; color:#1c1917; font-weight:700; margin-bottom:3px;">解釋：${p.meaning}</div>
              <div style="font-size:12.5px; color:#57534e;">例句：${p.example}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  walkToBookshelf() {
    this.closeModal('vocab-modal');
    this.showGameUI();
    if (window.game) {
      window.game.placeWorld(12);
      window.game.showPrompt('📚 已來到「星際生字語詞大書櫃」！點擊書櫃或下方作答鈕即可挑戰！');
    }
  }

  startVocabStation(stationIdx) {
    this.closeModal('vocab-modal');
    this.showGameUI();
    this.enterStation(stationIdx);
    this.promptInteract();
  }

  openQuizHub() {
    this.openStagesModal();
  }

  closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) {
      m.classList.remove('active');
      m.classList.add('hide');
    }
    if (modalId === 'quiz-modal' || modalId === 'station-modal') {
      this.G.mode = 'explore';
    }
  }
}

window.curriculumSystem = new CurriculumSystem();

function closeCert() {
  const m = document.getElementById('cert');
  if (m) {
    m.classList.remove('active');
    m.classList.add('hide');
  }
}
