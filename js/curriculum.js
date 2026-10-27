/**
 * 國語三上第六課〈小女生〉擴充題庫與貓咪點心獎勵系統
 * 包含 5 大主題、共 24 道精美互動關卡：
 * 1. 詞語拆解與理解篇 (5題)
 * 2. 標點符號：分號篇 (4題)
 * 3. 成語與慣用語篇 (5題)
 * 4. 生字部首與形近字篇 (6題)
 * 5. 課文深究與閱讀理解篇 (4題)
 * 答對題目可獲得【小魚乾】、【特級貓罐頭】點心，可在 3D 世界中餵食貓咪！
 */

class CurriculumSystem {
  constructor() {
    this.score = 0;
    this.treatCount = 3; // 開局贈送 3 包小魚乾供試玩餵食
    this.completedTasks = new Set();
    this.currentModal = null;

    // 建立 24 道精美題目庫
    this.quizBank = [
      // 主題 A：詞語拆解篇
      {
        id: 'w1', cat: 'word', title: '解釋「柔細」',
        desc: '「我過去摸小貓<b style="color:#ea580c;">柔細</b>的毛。」利用拆詞法，怎麼解釋柔細？',
        options: ['柔軟細微', '溫柔仔細', '柔和精細', '柔軟細長'],
        correct: 0,
        tip: '「柔」是指柔軟，「細」是指細微，合起來是柔軟細微！',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 'w2', cat: 'word', title: '解釋「平整」',
        desc: '「這條道路十分<b style="color:#ea580c;">平整</b>。」運用拆詞法，句中的平整是什麼意思？',
        options: ['平靜整齊', '平坦整齊', '平常齊整', '平安完整'],
        correct: 1,
        tip: '「平」是指平坦，「整」是指整齊，道路平整就是平坦整齊！',
        reward: '🥫 特級貓罐頭'
      },
      {
        id: 'w3', cat: 'word', title: '解釋「享受」',
        desc: '「小女生輕搖著尾巴，一副很<b style="color:#ea580c;">享受</b>的樣子。」',
        options: ['在物質或精神上得到滿足與樂趣', '忍受辛苦的事情', '接受別人的批評', '想念以前的回憶'],
        correct: 0,
        tip: '「享受」是指享用安適、得到滿足舒適的樂趣！',
        reward: '🥩 柔細肉泥條'
      },
      {
        id: 'w4', cat: 'word', title: '解釋「陪伴」',
        desc: '「像個可愛的小孩，<b style="color:#ea580c;">陪伴</b>我和家人說話。」陪伴的意思是？',
        options: ['在旁陪同相伴', '互相爭吵對立', '代替別人做事情', '偷偷跟在後面看'],
        correct: 0,
        tip: '「陪伴」是指隨同在旁做伴。',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 'w5', cat: 'word', title: '解釋「睡得香甜」',
        desc: '「哪怕正在角落<b style="color:#ea580c;">睡得香甜</b>」，句中的「香甜」是指？',
        options: ['身上散發出甜甜的味道', '睡得很熟、很安穩安適', '正在做吃糖果的夢', '在有花香的地方睡覺'],
        correct: 1,
        tip: '睡得香甜形容睡得很熟、很安穩舒服！',
        reward: '🥫 特級貓罐頭'
      },

      // 主題 B：標點符號篇 (分號)
      {
        id: 's1', cat: 'semi', title: '分號的使用時機',
        desc: '「我上洗手間，牠會喵喵叫<span style="color:#ea580c;">【 ？ 】</span>我關門洗澡，牠就叫得更大聲。」方框應填入？',
        options: ['，（逗號）', '；（分號）', '。（句號）', '、（頓號）'],
        correct: 1,
        tip: '兩個句子相互獨立又彼此關聯對照，中間要用分號（；）！',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 's2', cat: 'semi', title: '三並列排比句',
        desc: '「小魚在水池裡游泳<span style="color:#ea580c;">【 ？ 】</span>馬匹在草原上奔跑<span style="color:#ea580c;">【 ？ 】</span>鳥兒在空中飛翔。」',
        options: ['都用逗號 ，', '都用分號 ；', '都用頓號 、', '都用冒號 ：'],
        correct: 1,
        tip: '分開並列的三個分句群，中間均應使用分號（；）稍作停頓！',
        reward: '🥫 特級貓罐頭'
      },
      {
        id: 's3', cat: 'semi', title: '分號口訣記憶',
        desc: '「分號這個小標點，分開句群站中間。稍作停頓好<span style="color:#ea580c;">【 ？ 】</span>，相互獨立又關聯。」',
        options: ['排隊', '對照', '休息', '閱讀'],
        correct: 1,
        tip: '課本口訣：「稍作停頓好對照，相互獨立又關聯」！',
        reward: '🥩 柔細肉泥條'
      },
      {
        id: 's4', cat: 'semi', title: '哪一個句子分號使用正確？',
        desc: '請選出分號使用最恰當的句子：',
        options: [
          '今天的天氣；非常好。',
          '太陽升起來了；照亮了整座城市；微風輕輕吹拂著。',
          '哥哥喜歡打籃球；弟弟喜歡踢足球。',
          '桌上有蘋果；香蕉；和西瓜。'
        ],
        correct: 2,
        tip: '「哥哥喜歡打籃球；弟弟喜歡踢足球」是結構對稱的並列句子，使用分號最適當！',
        reward: '🐟 脆脆小魚乾'
      },

      // 主題 C：成語與慣用語篇
      {
        id: 'i1', cat: 'idiom', title: '成語：七嘴八舌',
        desc: '一家人圍在客廳開心地聊天出主意，形容「人多且話多紛雜」，應該使用？',
        options: ['七上八下', '七手八腳', '七嘴八舌', '三言兩語'],
        correct: 2,
        tip: '大家都在講話，話多且紛雜，使用「七嘴八舌」！',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 'i2', cat: 'idiom', title: '成語：七手八腳',
        desc: '放學了，大家匆匆忙忙收拾教室，手忙腳亂、動作紛亂沒條理，應該用？',
        options: ['七嘴八舌', '七手八腳', '七拼八湊', '十全十美'],
        correct: 1,
        tip: '形容人多且動作紛亂、手忙腳亂就是「七手八腳」！',
        reward: '🥫 特級貓罐頭'
      },
      {
        id: 'i3', cat: 'idiom', title: '成語：七上八下',
        desc: '在公布月考成績之前，小明的心裡忐忑不安、心情起伏不定，應該用？',
        options: ['七嘴八舌', '七上八下', '七扭八歪', '四平八穩'],
        correct: 1,
        tip: '形容心神不定、忐忑不安就是「七上八下」！',
        reward: '🥩 柔細肉泥條'
      },
      {
        id: 'i4', cat: 'idiom', title: '成語：一唱一和',
        desc: '課文中說：「我叫一聲，牠喵一下，<b style="color:#ea580c;">一唱一和</b>，高高低低」，意思是？',
        options: ['兩個人在比賽大聲唱歌', '聲音彼此呼應配合、很有默契', '一個人在唱歌，一個人在生氣', '唱歌走音很不和諧'],
        correct: 1,
        tip: '一唱一和比喻彼此呼應、互相配合。',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 'i5', cat: 'idiom', title: '成語：四腳朝天',
        desc: '「小女生喜歡<b style="color:#ea580c;">四腳朝天</b>的躺在沙發上」，這個詞生動形容了？',
        options: ['貓咪跌倒受傷起不來', '貓咪放鬆翻過身、露出白肚子的可愛仰臥姿態', '貓咪伸懶腰準備跳躍', '貓咪生氣想抓人'],
        correct: 1,
        tip: '四腳朝天形容仰面躺臥、四隻腳都朝向天空的極度放鬆姿態！',
        reward: '🥫 特級貓罐頭'
      },

      // 主題 D：生字部首與形近字篇
      {
        id: 'h1', cat: 'hanzi', title: '形近字辨析：柔 vs. 揉',
        desc: '「我會過去摸摸牠<span style="color:#ea580c;">【甲】</span>細的毛，<span style="color:#ea580c;">【乙】</span>牠又圓又胖的肚子。」甲、乙應填？',
        options: ['甲：柔，乙：揉', '甲：揉，乙：柔', '甲：柔，乙：柔', '甲：揉，乙：揉'],
        correct: 0,
        tip: '毛髮柔軟是木部「柔」；動手揉搓肚子是手部「揉」！',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 'h2', cat: 'hanzi', title: '量詞與形近字：副 vs. 幅',
        desc: '「小女生半睜著眼睛，一<span style="color:#ea580c;">【 ？ 】</span>很享受的樣子。」形容神情態度應填？',
        options: ['副（刀部）', '幅（巾部）', '福（示部）', '富（宀部）'],
        correct: 0,
        tip: '形容態度、表情、神情用「副」；形容畫作或布料用「幅」！',
        reward: '🥫 特級貓罐頭'
      },
      {
        id: 'h3', cat: 'hanzi', title: '部首特輯：「肚」和「膠」',
        desc: '本課生字「肚」與「膠」的部首是什麼？',
        options: ['月部', '肉部', '日部', '夕部'],
        correct: 1,
        tip: '在國語字典中，「肚」和「膠」在左側看似月字旁，實際上代表身體部位，部首皆為「肉部」！',
        reward: '🥩 柔細肉泥條'
      },
      {
        id: 'h4', cat: 'hanzi', title: '多音字：「應」的讀音',
        desc: '「牠會邊走邊回<b style="color:#ea580c;">應</b>」中的「應」應讀作？',
        options: ['ㄧㄥ（一聲，如：應該）', 'ㄧㄥˋ（四聲，如：回應、答應）', 'ㄧㄥˇ（三聲）', 'ㄧㄥˊ（二聲）'],
        correct: 1,
        tip: '回應、反應、答應中的「應」都讀四聲「ㄧㄥˋ」！',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 'h5', cat: 'hanzi', title: '生字筆畫：關門的「關」',
        desc: '「我<b style="color:#ea580c;">關</b>門洗澡」的「關」字，部首是什麼？總筆畫是多少？',
        options: ['門部，19 畫', '八部，15 畫', '大部，18 畫', '木部，19 畫'],
        correct: 0,
        tip: '「關」部首為「門部」，門部 11 畫，扣除部首後 8 畫，總筆畫 19 畫！',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 'h6', cat: 'hanzi', title: '生字結構：奮力的「奮」',
        desc: '「牠也會<b style="color:#ea580c;">奮</b>力睜開眼睛」的「奮」字，部首是什麼？',
        options: ['田部', '隹部', '大部', '十部'],
        correct: 2,
        tip: '「奮」最上方為「大」，部首為「大部」，總筆畫 16 畫！',
        reward: '🥫 特級貓罐頭'
      },

      // 主題 E：課文深究與閱讀理解篇
      {
        id: 'r1', cat: 'read', title: '為什麼叫「膠水貓」？',
        desc: '課文中作者為什麼稱小女生是一隻「膠水貓」？',
        options: [
          '因為牠不小心踩翻了桌上的膠水瓶',
          '因為牠特別黏人，作者走到哪牠就緊緊跟到哪',
          '因為牠的毛摸起來黏黏的',
          '因為牠最喜歡玩有黏性的玩具'
        ],
        correct: 1,
        tip: '膠水貓是作者生動的借喻，形容小女生非常黏人、隨時形影不離！',
        reward: '🐟 脆脆小魚乾'
      },
      {
        id: 'r2', cat: 'read', title: '貓咪心情不好時的舉動',
        desc: '當主人大叫小女生，如果小女生「心情不好」，牠會怎麼做？',
        options: [
          '大聲哈氣逃跑藏起來',
          '邊走邊高興的一唱一和回應',
          '安安靜靜走來，用雪亮的大眼睛不高興看著，心想「到底什麼事啊？」',
          '躺在沙發上裝睡完全不理人'
        ],
        correct: 2,
        tip: '課文細緻描寫：心情不好時會安靜走來，用雪亮大眼看著，像在說到底什麼事啊！',
        reward: '🥫 特級貓罐頭'
      },
      {
        id: 'r3', cat: 'read', title: '修辭技巧：白色小被子',
        desc: '「毛茸茸的肚子，看起來像蓋上了一條白色小被子。」這句話使用了哪一種修辭？',
        options: ['排比法', '擬人法', '譬喻法（明喻）', '設問法'],
        correct: 2,
        tip: '句子中有比喻詞「像」，將白肚子比喻為白色小被子，是標準的譬喻法！',
        reward: '🥩 柔細肉泥條'
      },
      {
        id: 'r4', cat: 'read', title: '課文主旨與情感',
        desc: '課文最後一句「也是我重要的家人，我們的故事，說也說不完。」傳達了什麼情感？',
        options: [
          '抱怨養寵物花費太多時間和金錢',
          '人與動物之間真摯的愛、陪伴與家人般的情感連結',
          '作者想把小女生送給親戚飼養',
          '貓咪太吵鬧讓家裡沒辦法安靜'
        ],
        correct: 1,
        tip: '整篇課文洋溢著人與寵物相互信賴、溫暖陪伴的生命關懷！',
        reward: '🥫 特級貓罐頭'
      }
    ];
  }

  init() {
    this.bindEvents();
    this.updateScoreUI();
  }

  bindEvents() {
    const closeBtn = document.getElementById('modal-close');
    const overlay = document.getElementById('modal-overlay');
    if (closeBtn && overlay) {
      closeBtn.addEventListener('click', () => this.closeModal());
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal();
      });
    }
  }

  addScore(points, taskId) {
    this.score += points;
    if (taskId) this.completedTasks.add(taskId);
    this.updateScoreUI();
    if (window.soundSystem) window.soundSystem.playSuccess();
  }

  addTreat(amount = 1, treatName = '🐟 脆脆小魚乾') {
    this.treatCount += amount;
    this.updateScoreUI();
    this.showFloatingNotice(`獲得獎勵：${treatName} +${amount}！✨`);
  }

  consumeTreat() {
    if (this.treatCount > 0) {
      this.treatCount--;
      this.updateScoreUI();
      return true;
    }
    return false;
  }

  updateScoreUI() {
    const scoreEl = document.getElementById('score-display');
    const treatEl = document.getElementById('treat-display');
    const progressEl = document.getElementById('progress-bar');

    if (scoreEl) scoreEl.textContent = `${this.score} 分`;
    if (treatEl) treatEl.textContent = `🐟 點心 x ${this.treatCount}`;
    if (progressEl) {
      const percentage = Math.min(100, Math.round((this.completedTasks.size / this.quizBank.length) * 100));
      progressEl.style.width = `${Math.max(12, percentage)}%`;
    }
  }

  showFloatingNotice(text) {
    const prompt = document.getElementById('center-prompt');
    const promptText = document.getElementById('prompt-text');
    if (prompt && promptText) {
      promptText.innerHTML = text;
      prompt.classList.remove('hidden');
      setTimeout(() => prompt.classList.add('hidden'), 2600);
    }
  }

  openModal(title, tag, desc, contentHtml, footerHtml = '') {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const tagEl = document.getElementById('modal-tag');
    const descEl = document.getElementById('modal-desc');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');

    if (titleEl) titleEl.innerHTML = title;
    if (tagEl) tagEl.textContent = tag;
    if (descEl) descEl.innerHTML = desc;
    if (bodyEl) bodyEl.innerHTML = contentHtml;
    if (footerEl) footerEl.innerHTML = footerHtml;

    if (overlay) overlay.classList.add('active');
  }

  closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
    if (window.soundSystem) window.soundSystem.stopPurr();
  }

  /* ==========================================================================
     百寶箱闖關題庫總覽 (Quiz Hub / Quest Browser)
     ========================================================================== */
  openQuizHub(selectedCategory = 'all') {
    const title = '📖 國語第六課〈小女生〉百寶箱大考驗';
    const tag = `共 24 道精美關卡・已完成 ${this.completedTasks.size} 題`;
    const desc = '回答各單元問題，累積<b>學習積分</b>並收集<b>貓咪小魚乾點心</b>，可以用來餵食小女生喔！';

    const categories = [
      { id: 'all', name: '全部挑戰' },
      { id: 'word', name: '🧶 詞語探索' },
      { id: 'semi', name: '✨ 標點分號' },
      { id: 'idiom', name: '💬 成語狀況' },
      { id: 'hanzi', name: '📖 生字部首' },
      { id: 'read', name: '💖 課文深究' }
    ];

    let tabsHtml = `<div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:14px;">`;
    categories.forEach(cat => {
      const activeStyle = cat.id === selectedCategory ? 'background:#f97316; color:white; font-weight:800;' : 'background:#f1f5f9; color:#475569;';
      tabsHtml += `<button style="padding:6px 14px; border-radius:20px; border:none; cursor:pointer; font-size:13px; white-space:nowrap; ${activeStyle}" onclick="curriculumSystem.openQuizHub('${cat.id}')">${cat.name}</button>`;
    });
    tabsHtml += `</div>`;

    let listHtml = `<div style="display:grid; grid-template-columns:1fr; gap:10px; max-height:48vh; overflow-y:auto; padding-right:6px;">`;
    const filtered = selectedCategory === 'all' ? this.quizBank : this.quizBank.filter(q => q.cat === selectedCategory);

    filtered.forEach((q, idx) => {
      const isDone = this.completedTasks.has(q.id);
      const doneBadge = isDone ? `<span style="background:#dcfce7; color:#166534; font-size:11px; padding:2px 8px; border-radius:10px; font-weight:800;">✓ 已過關</span>` : `<span style="background:#fef3c7; color:#b45309; font-size:11px; padding:2px 8px; border-radius:10px;">⭐ 待挑戰</span>`;
      listHtml += `
        <div style="background:white; border:2px solid ${isDone ? '#86efac' : '#e2e8f0'}; border-radius:16px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'" onclick="curriculumSystem.startSingleQuiz('${q.id}')">
          <div>
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <b style="color:#334155; font-size:15px;">${q.title}</b>
              ${doneBadge}
            </div>
            <div style="font-size:12px; color:#64748b;">通關獎勵：${q.reward} + 15積分</div>
          </div>
          <button style="background:${isDone ? '#f1f5f9' : '#ea580c'}; color:${isDone ? '#475569' : 'white'}; border:none; padding:6px 14px; border-radius:14px; font-weight:700; font-size:12px; cursor:pointer;">${isDone ? '再次複習' : '開始挑戰'}</button>
        </div>
      `;
    });
    listHtml += `</div>`;

    this.openModal(title, tag, desc, tabsHtml + listHtml, '');
  }

  /* ==========================================================================
     單題闖關互動
     ========================================================================== */
  startSingleQuiz(quizId) {
    const q = this.quizBank.find(item => item.id === quizId);
    if (!q) return;

    const title = q.title;
    const tag = '課文重點問答';
    const desc = q.desc;

    let optionsHtml = `<div class="options-grid" style="grid-template-columns:1fr; gap:10px; margin-top:14px;">`;
    q.options.forEach((opt, idx) => {
      optionsHtml += `
        <button class="option-btn" style="text-align:left; padding:14px 18px; font-size:15px;" onclick="curriculumSystem.submitQuizAnswer('${q.id}', ${idx}, this)">
          <b>${['A', 'B', 'C', 'D'][idx]}.</b> ${opt}
        </button>
      `;
    });
    optionsHtml += `</div><div id="quiz-feedback" class="feedback-msg"></div>`;

    const footerHtml = `
      <button class="btn-confirm" style="background:#64748b;" onclick="curriculumSystem.openQuizHub('${q.cat}')">返回題目列表</button>
    `;

    this.openModal(title, tag, desc, optionsHtml, footerHtml);
  }

  submitQuizAnswer(quizId, userChoice, btn) {
    const q = this.quizBank.find(item => item.id === quizId);
    const fb = document.getElementById('quiz-feedback');
    if (!q || !fb) return;

    if (userChoice === q.correct) {
      fb.className = 'feedback-msg success';
      fb.innerHTML = `🎉 答對了！${q.tip}<br><b>獲得通關獎勵：${q.reward} +1！</b>`;
      btn.style.borderColor = '#22c55e';
      btn.style.background = '#f0fdf4';

      if (!this.completedTasks.has(q.id)) {
        this.addScore(15, q.id);
        this.addTreat(1, q.reward);
      } else {
        if (window.soundSystem) window.soundSystem.playSuccess();
      }

      setTimeout(() => {
        this.openQuizHub(q.cat);
      }, 1800);
    } else {
      fb.className = 'feedback-msg error';
      fb.innerHTML = '答案不太對喔！再讀一次題目，仔細想一想！';
      btn.style.borderColor = '#ef4444';
      btn.style.background = '#fef2f2';
      if (window.soundSystem) window.soundSystem.playError();
    }
  }

  /* ==========================================================================
     保留特殊互動：撫摸白肚子、拆詞法、分號星光橋
     ========================================================================== */
  startBellyRubInteraction() {
    if (window.game) {
      window.game.setCatAIState('sleep_belly_up');
    }
    const title = '摸摸<ruby>小<rt>ㄒㄧㄠˇ</rt>女<rt>ㄋㄩˇ</rt>生<rt>ㄕㄥ</rt></ruby>的白肚子';
    const tag = '課文情境互動';
    const desc = '「毛茸茸的肚子，看起來像蓋上了一條白色小被子。我會過去摸摸牠柔細的毛，揉揉牠又圓又胖的肚子。」<br><small style="color:#d97706;">★ 請用滑鼠或手指在貓咪肚皮上畫圈揉揉！</small>';

    const contentHtml = `
      <div class="belly-rub-area" id="belly-rub-zone">
        <div class="belly-target" id="belly-target">🐱</div>
        <div style="position: absolute; bottom: 12px; font-weight:700; color:#b45309; font-size:14px;" id="rub-status-text">
          滑鼠按住肚子，輕輕揉揉牠...
        </div>
      </div>
      <div class="progress-bar-bg" style="width:100%; height:16px; margin-top:16px; border-radius:8px;">
        <div class="progress-bar-fill" id="belly-fill" style="width: 0%; background: linear-gradient(90deg, #f6ad55, #ed8936);"></div>
      </div>
      <div id="belly-feedback" class="feedback-msg"></div>
    `;

    const footerHtml = `
      <button class="btn-confirm" id="btn-belly-done" style="display:none;" onclick="curriculumSystem.finishBellyRub()">完成互動 (+20分、獲得小魚乾)</button>
    `;

    this.openModal(title, tag, desc, contentHtml, footerHtml);
    this.initBellyRubEvents();
  }

  initBellyRubEvents() {
    const zone = document.getElementById('belly-rub-zone');
    const fill = document.getElementById('belly-fill');
    const feedback = document.getElementById('belly-feedback');
    const statusText = document.getElementById('rub-status-text');
    const doneBtn = document.getElementById('btn-belly-done');
    let rubCount = 0;

    if (!zone) return;

    const onRub = (e) => {
      rubCount += 1.8;
      const progress = Math.min(100, Math.round(rubCount));
      if (fill) fill.style.width = `${progress}%`;

      if (Math.random() > 0.6) {
        this.spawnHeart(zone, e.clientX || (e.touches && e.touches[0].clientX), e.clientY || (e.touches && e.touches[0].clientY));
      }

      if (window.soundSystem && progress > 15) {
        window.soundSystem.startPurr();
      }

      if (progress >= 100) {
        zone.removeEventListener('mousemove', onRub);
        zone.removeEventListener('touchmove', onRub);
        if (window.soundSystem) window.soundSystem.stopPurr();
        if (statusText) statusText.textContent = '小女生半睜著眼睛，輕搖尾巴，一「副」很享受的樣子！🥰';
        if (feedback) {
          feedback.className = 'feedback-msg success';
          feedback.innerHTML = '太棒了！小女生感到非常幸福，發出了舒服的呼嚕聲！';
        }
        if (doneBtn) doneBtn.style.display = 'inline-block';
        if (window.soundSystem) window.soundSystem.playMeow('cute');
      }
    };

    zone.addEventListener('mousedown', () => zone.addEventListener('mousemove', onRub));
    window.addEventListener('mouseup', () => {
      zone.removeEventListener('mousemove', onRub);
      if (window.soundSystem) window.soundSystem.stopPurr();
    });
    zone.addEventListener('mouseleave', () => {
      zone.removeEventListener('mousemove', onRub);
      if (window.soundSystem) window.soundSystem.stopPurr();
    });

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      zone.addEventListener('touchmove', onRub);
    });
    zone.addEventListener('touchend', () => {
      zone.removeEventListener('touchmove', onRub);
      if (window.soundSystem) window.soundSystem.stopPurr();
    });
    zone.addEventListener('touchcancel', () => {
      zone.removeEventListener('touchmove', onRub);
      if (window.soundSystem) window.soundSystem.stopPurr();
    });
  }

  spawnHeart(parent, clientX, clientY) {
    const rect = parent.getBoundingClientRect();
    const heart = document.createElement('div');
    heart.className = 'floating-heart';
    heart.textContent = ['❤️', '✨', '🐾', '💖'][Math.floor(Math.random() * 4)];
    const x = clientX ? (clientX - rect.left) : (Math.random() * rect.width);
    const y = clientY ? (clientY - rect.top) : (Math.random() * rect.height);
    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;
    parent.appendChild(heart);
    setTimeout(() => heart.remove(), 1000);
  }

  finishBellyRub() {
    this.addScore(20, 'belly_rub');
    this.addTreat(1, '🐟 脆脆小魚乾');
    this.closeModal();
    if (window.game) {
      window.game.makeCatHappy();
    }
  }

  startWordSplitGame() {
    this.openQuizHub('word');
  }

  startSemicolonGame() {
    this.openQuizHub('semi');
  }

  startIdiomGame() {
    this.openQuizHub('idiom');
  }

  startHanziMuseum() {
    this.openQuizHub('hanzi');
  }
}

// 導出教學實例
window.curriculumSystem = new CurriculumSystem();
