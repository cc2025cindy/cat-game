/**
 * 《又遠又近的月亮：3D 登月奇航》
 * 國小國語四上第六課 山鷹〈又遠又近的月亮〉
 * Three.js 3D 沉浸式場景與角色渲染系統
 *
 * 四幕場景與課文 100% 呼應：
 * 1. 第一幕【圖書館登月新知區】：高聳木書架、天文望遠鏡、火箭模型、《○○日報：阿提米絲計畫》展架
 * 2. 第二幕【四十五億歲月球隕石坑區】：無水無大氣保護的隕石撞擊坑洞、動態墜落流星、陽光斜射黑影與「玉兔搗藥」雕塑
 * 3. 第三幕【三十八萬公里航道與阿波羅區】：地月距離望遠鏡（36萬～40萬公里）、搭飛機半個月 vs 騎單車三年動態展台、阿波羅登月艇與自然科學老師
 * 4. 第四幕【中秋月夜賞月庭院區】：中秋月餅茶席、嫦娥與玉兔花燈、天際巨型滿月與星象儀
 */

class GameEngine {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // 視角模式: 'cat' (登月太空人視角) 或 'human' (好奇小讀者視角)
    this.viewMode = 'cat';

    // 360° 空間自由旋轉與縮放相機參數
    this.cameraYaw = 0;
    this.cameraPitch = 0.34;
    this.cameraDistance = 3.8;
    this.isDragging = false;
    this.prevMouse = { x: 0, y: 0 };

    // 角色與環境物件
    this.cat = null;       // 主角1：登月太空人 (腳底 y = 0)
    this.player = null;    // 主角2 / NPC：自然科學老師與小讀者 (腳底 y = 0)
    this.catShadow = null;
    this.playerShadow = null;
    this.interactiveSpots = [];

    // 動態場景元件
    this.skyMoon = null;
    this.fallingMeteor = null;
    this.planeModel = null;
    this.bikeModel = null;
    this.starField = null;
    this.hemiLight = null;
    this.sunLight = null;

    // 輸入控制與手機虛擬搖桿
    this.keys = {};
    this.joystickVector = { x: 0, z: 0 };
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // 角色座標與物理狀態 (原點為腳底 y = 0)
    this.playerPos = new THREE.Vector3(2.5, 0, 2.1);
    this.playerRot = 0;
    this.playerNodes = {};
    this.isSitting = false;

    this.catPos = new THREE.Vector3(-2.4, 0, -1.5);
    this.catRot = 0;
    this.catVelocityY = 0;
    this.catIsGrounded = true;
    this.catSpeed = 3.5;
    this.catState = 'walk';
    this.catNodes = {};
    this.catMeshGroup = null;
    this.bellyUpFactor = 0;

    this.nearbySpot = null;
    this.proxCard = null;
  }

  init() {
    this.initFurnitureData();
    this.setupScene();
    this.setupLights();
    this.buildMoonWorld();
    this.createContactShadows();
    this.createAstronautAvatar();
    this.createTeacherAvatar();
    this.loadGLBModels();
    this.setupInputs();
    this.setupOrbitCameraControls();
    this.setupMobileControls();
    this.setupFloatingMarkers();
    this.setupRaycasterClicks();

    this.proxCard = document.getElementById('proximity-card');
    this.setRole('cat');

    // 綁定動態視窗高度 (--appH)，確保直橫向零溢出
    const setAppH = () => {
      const h = window.innerHeight;
      document.documentElement.style.setProperty('--appH', `${h}px`);
    };
    setAppH();
    window.addEventListener('resize', () => {
      setAppH();
      this.onResize();
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        setAppH();
        this.onResize();
      }, 100);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        setAppH();
        this.onResize();
      });
    }

    // 載入完成信號 (滿足 quality_check.py #loading.done 檢查)
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('done');
      setTimeout(() => { loading.style.display = 'none'; }, 400);
    }

    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.018);

    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 150);
    this.camera.position.set(0, 2.5, 5.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.container.appendChild(this.renderer.domElement);
  }

  setupLights() {
    this.hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.92);
    this.hemiLight.position.set(0, 12, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfffbeb, 1.25);
    this.sunLight.position.set(6, 9, 4);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 25;
    this.sunLight.shadow.camera.left = -6.5;
    this.sunLight.shadow.camera.right = 6.5;
    this.sunLight.shadow.camera.top = 6.5;
    this.sunLight.shadow.camera.bottom = -6.5;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    const warmPoint = new THREE.PointLight(0xfde68a, 0.65, 12);
    warmPoint.position.set(-2.5, 3.2, -2.0);
    this.scene.add(warmPoint);
  }

  createContactShadows() {
    const shadowGeo = new THREE.CircleGeometry(0.34, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x090d16,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });

    this.playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.y = 0.004;
    this.scene.add(this.playerShadow);

    this.catShadow = new THREE.Mesh(shadowGeo.clone(), shadowMat.clone());
    this.catShadow.rotation.x = -Math.PI / 2;
    this.catShadow.position.y = 0.004;
    this.scene.add(this.catShadow);
  }

  /* ==========================================================================
     3D 場景建造：月光圖書館與月球探險奇境 (4 大主題區 + 天際巨型滿月)
     ========================================================================== */
  buildMoonWorld() {
    // 1. 地面：結合「圖書館暖木地板（西側）」與「月球灰白隕石地表（東側）」加上中央金色月光星軌
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const ctx = floorCanvas.getContext('2d');

    // 左半：圖書館與中秋庭院暖色木石地磚；右半：月球灰白表面
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, '#d6b288');
    grad.addColorStop(0.45, '#cbd5e1');
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // 繪製月球環形坑紋理與星軌格線
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.28)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 512; i += 64) {
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75, metalness: 0.08 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 中央月光羅盤圓毯 (科學的月球 ↔ 文學的月亮)
    const centerRing = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 48),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    centerRing.rotation.x = -Math.PI / 2;
    centerRing.position.set(0, 0.005, 0);
    this.scene.add(centerRing);

    const innerGold = new THREE.Mesh(
      new THREE.RingGeometry(1.55, 1.75, 48),
      new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
    );
    innerGold.rotation.x = -Math.PI / 2;
    innerGold.position.set(0, 0.008, 0);
    this.scene.add(innerGold);

    // 2. 天空巨型立體月球、土星環與璀璨星海（呼應課本第58頁封面與全課意象）
    this.buildSkyMoonAndStars();

    // 3. 第一幕（西北區）：圖書館書架、火箭、地球儀與《○○日報：阿提米絲登月計畫》展架
    this.buildLibraryZone();

    // 4. 第二幕（東北區）：四十五億歲月球表面、隕石撞擊坑洞、陽光斜射黑影與「玉兔搗藥」雕塑
    this.buildLunarCratersAndJadeRabbit();

    // 5. 第三幕（正北與西側、東南側）：高倍數天文望遠鏡、飛機(半個月)vs單車(三年)展台、阿波羅登月艇
    this.buildTelescopeAndDistanceArch();
    this.buildTransportComparisonStage();
    this.buildApolloLanderZone();

    // 6. 第四幕（南側與西南側）：中秋賞月月餅圓桌、嫦娥與玉兔花燈、語文百寶箱互動機
    this.buildMidAutumnCourtyard();
    this.buildTreasureBoxStation();

    // 7. 第五幕（南側中央 z = 3.1）：3D 生字與語詞書櫃（18字生字卡＋字音／字形／語詞 3 大闖關）
    this.buildVocabBookshelf();

    // 8. 散落在月球各處的 6 大 3D 神秘太空寶箱（生字、隕石、太空任務、文學月餅補給）
    this.buildMoonChests();
  }

  buildSkyMoonAndStars() {
    // 巨型立體月球 (含黑影「玉兔搗藥」紋理)
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = 512;
    moonCanvas.height = 256;
    const mCtx = moonCanvas.getContext('2d');
    mCtx.fillStyle = '#fef08a';
    mCtx.fillRect(0, 0, 512, 256);

    // 月球表面高低不平坑洞的黑影（古人想像玉兔搗藥的形狀）
    mCtx.fillStyle = '#ca8a04';
    const spots = [
      [220, 110, 38], [250, 140, 45], [195, 85, 22],
      [210, 75, 18], [285, 115, 28], [140, 150, 25], [350, 90, 30]
    ];
    spots.forEach(([x, y, r]) => {
      mCtx.beginPath();
      mCtx.arc(x, y, r, 0, Math.PI * 2);
      mCtx.fill();
    });

    const moonTex = new THREE.CanvasTexture(moonCanvas);
    this.skyMoon = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 36, 36),
      new THREE.MeshStandardMaterial({
        map: moonTex,
        emissive: 0xfde047,
        emissiveIntensity: 0.35,
        roughness: 0.6
      })
    );
    this.skyMoon.position.set(0, 6.2, -9.5);
    this.scene.add(this.skyMoon);

    // 課本第58頁插圖中的橘色土星環星球
    const saturnGroup = new THREE.Group();
    const saturn = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.2 })
    );
    const sRing = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.25, 32),
      new THREE.MeshBasicMaterial({ color: 0xfde68a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    sRing.rotation.x = Math.PI / 2.4;
    saturnGroup.add(saturn, sRing);
    saturnGroup.position.set(-5.5, 5.8, -8.0);
    this.scene.add(saturnGroup);

    // 星空粒子
    const starGeo = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 260; i++) {
      starPositions.push(
        (Math.random() - 0.5) * 45,
        2.5 + Math.random() * 18,
        (Math.random() - 0.5) * 45
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.starField = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xfef9c3, size: 0.14, transparent: true, opacity: 0.85 })
    );
    this.scene.add(this.starField);
  }

  buildLibraryZone() {
    this.libraryGroup = new THREE.Group();
    this.libraryGroup.userData = { id: 'newspaper' };

    // 課本第58頁同款木質大書架
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 0.45), shelfMat);
    shelf.position.set(-3.2, 1.3, -3.4);
    shelf.castShadow = true;
    this.libraryGroup.add(shelf);

    // 彩色書籍列
    const bookColors = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899];
    for (let row = 0; row < 3; row++) {
      for (let b = 0; b < 6; b++) {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.42, 0.32),
          new THREE.MeshStandardMaterial({ color: bookColors[(row + b) % bookColors.length] })
        );
        book.position.set(-3.95 + b * 0.3, 0.55 + row * 0.72, -3.32);
        this.libraryGroup.add(book);
      }
    }

    // 書架頂部的小火箭模型（課本第58頁插圖細節！支援載入真實 RocketShip.glb）
    this.libraryRocketHolder = new THREE.Group();
    this.libraryRocketHolder.position.set(-3.8, 2.6, -3.4);
    const rocketBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.55, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc })
    );
    rocketBody.position.set(0, 0.28, 0);
    const rocketNose = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.28, 16),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    rocketNose.position.set(0, 0.68, 0);
    this.libraryRocketHolder.add(rocketBody, rocketNose);
    this.libraryGroup.add(this.libraryRocketHolder);

    // 圖書館閱覽桌與《○○日報：NASA發布登月計畫成員》立體報紙展板
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.72, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.55 })
    );
    desk.position.set(-2.6, 0.36, -2.3);
    desk.castShadow = true;
    this.libraryGroup.add(desk);

    // 繪製課本第59頁《○○日報》紋理
    const newsCanvas = document.createElement('canvas');
    newsCanvas.width = 512;
    newsCanvas.height = 384;
    const nCtx = newsCanvas.getContext('2d');
    nCtx.fillStyle = '#f8fafc';
    nCtx.fillRect(0, 0, 512, 384);
    nCtx.strokeStyle = '#334155';
    nCtx.lineWidth = 6;
    nCtx.strokeRect(12, 12, 488, 360);

    nCtx.fillStyle = '#0f172a';
    nCtx.font = 'bold 26px sans-serif';
    nCtx.fillText('○○日報｜NASA發布登月計畫成員', 28, 56);
    nCtx.fillStyle = '#1d4ed8';
    nCtx.font = 'bold 20px sans-serif';
    nCtx.fillText('「阿提米絲二號」繞月飛行計畫四名成員', 28, 96);
    nCtx.fillStyle = '#334155';
    nCtx.font = '18px sans-serif';
    nCtx.fillText('• 包含一名女性和非裔男性太空人', 28, 136);
    nCtx.fillText('• 自1970年代後，五十多年未踏上月球', 28, 168);
    nCtx.fillText('• 預計2027年將首位女性送上月球', 28, 200);
    nCtx.fillText('• 展開科學研究、探索月球稀有資源', 28, 232);
    nCtx.fillText('• 做為人類進軍火星的前置作業！', 28, 264);

    // 四名橘色太空衣成員簡圖
    for (let a = 0; a < 4; a++) {
      nCtx.fillStyle = '#ea580c';
      nCtx.fillRect(60 + a * 105, 295, 65, 55);
      nCtx.fillStyle = '#fde68a';
      nCtx.beginPath();
      nCtx.arc(92 + a * 105, 285, 18, 0, Math.PI * 2);
      nCtx.fill();
    }

    const newsBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.95),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(newsCanvas) })
    );
    newsBoard.position.set(-2.6, 1.22, -2.3);
    newsBoard.rotation.x = -0.18;
    this.libraryGroup.add(newsBoard);

    // 地球儀（課本第58頁插圖細節，支援套用 NASA 地球衛星貼圖）
    this.libraryGlobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35, metalness: 0.1 })
    );
    this.libraryGlobe.position.set(-1.95, 0.96, -2.25);
    this.libraryGroup.add(this.libraryGlobe);

    this.scene.add(this.libraryGroup);
  }

  buildLunarCratersAndJadeRabbit() {
    this.craterGroup = new THREE.Group();
    this.craterGroup.userData = { id: 'craters' };

    // 月球四十五億歲坑洞地貌區 (東北側)
    const craterData = [
      { x: 2.8, z: -2.4, r: 0.85, h: 0.24 },
      { x: 3.9, z: -1.5, r: 0.55, h: 0.18 },
      { x: 1.9, z: -3.1, r: 0.48, h: 0.16 },
      { x: 3.5, z: -3.2, r: 0.42, h: 0.15 }
    ];

    craterData.forEach(c => {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(c.r, c.h, 16, 32),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 })
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(c.x, c.h * 0.4, c.z);
      rim.castShadow = true;
      rim.receiveShadow = true;
      this.craterGroup.add(rim);

      // 陽光照射下產生的深色坑洞黑影
      const darkPit = new THREE.Mesh(
        new THREE.CircleGeometry(c.r * 0.82, 28),
        new THREE.MeshBasicMaterial({ color: 0x1e293b })
      );
      darkPit.rotation.x = -Math.PI / 2;
      darkPit.position.set(c.x, 0.02, c.z);
      this.craterGroup.add(darkPit);
    });

    // 動態落下的隕石模型（支援載入真實 NASA 1999 RQ36 asteroid.glb）
    this.fallingMeteor = new THREE.Group();
    const meteorCore = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22, 1),
      new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xdc2626,
        emissiveIntensity: 0.9,
        roughness: 0.4
      })
    );
    this.fallingMeteor.add(meteorCore);
    this.fallingMeteor.position.set(2.8, 2.2, -2.4);
    this.craterGroup.add(this.fallingMeteor);

    this.scene.add(this.craterGroup);

    // 「玉兔搗藥」光影觀測台 (東側 x: 3.5, z: 0.2) — 精細立體玉兔與雕花藥臼
    this.lanternGroup = new THREE.Group();
    this.lanternGroup.userData = { id: 'lantern' };

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.78, 0.25, 32),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55, metalness: 0.2 })
    );
    pedestal.position.set(3.5, 0.125, 0.2);
    this.lanternGroup.add(pedestal);

    // 雙層雕花藥臼與發光仙丹、搗藥杵
    const mortarBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.28, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4, metalness: 0.3 })
    );
    mortarBase.position.set(3.26, 0.31, 0.2);
    const mortarBowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.29, 0.19, 0.28, 24),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.4 })
    );
    mortarBowl.position.set(3.26, 0.48, 0.2);
    const elixirGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 20, 12),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfde047, emissiveIntensity: 0.85 })
    );
    elixirGlow.scale.set(1, 0.35, 1);
    elixirGlow.position.set(3.26, 0.61, 0.2);
    const pestle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.06, 0.52, 16),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, metalness: 0.3, roughness: 0.2 })
    );
    pestle.position.set(3.32, 0.75, 0.2);
    pestle.rotation.z = -0.22;
    this.lanternGroup.add(mortarBase, mortarBowl, elixirGlow, pestle);

    // 精細立體白玉兔雕像（含軀幹、後腿、雙手握杵、長耳粉紅內耳、紅寶石眼、絨毛尾）
    const rabbitMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef9c3,
      emissiveIntensity: 0.28,
      roughness: 0.22
    });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.35 });
    const rubyMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, emissive: 0xbe123c, emissiveIntensity: 0.5 });

    const rBody = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), rabbitMat);
    rBody.scale.set(0.95, 1.25, 0.88);
    rBody.position.set(3.68, 0.52, 0.2);
    rBody.rotation.z = 0.12;

    const rHaunchL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 18), rabbitMat);
    rHaunchL.scale.set(1.1, 0.85, 0.8);
    rHaunchL.position.set(3.72, 0.34, 0.07);
    const rHaunchR = rHaunchL.clone();
    rHaunchR.position.set(3.72, 0.34, 0.33);

    const rPawL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 16), rabbitMat);
    rPawL.scale.set(1.5, 0.65, 0.75);
    rPawL.position.set(3.46, 0.64, 0.11);
    const rPawR = rPawL.clone();
    rPawR.position.set(3.46, 0.64, 0.29);

    const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 24), rabbitMat);
    rHead.scale.set(1.08, 0.96, 0.92);
    rHead.position.set(3.61, 0.84, 0.2);

    const rNose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), pinkMat);
    rNose.position.set(3.42, 0.83, 0.2);
    const rEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 12), rubyMat);
    rEyeL.position.set(3.47, 0.89, 0.11);
    const rEyeR = rEyeL.clone();
    rEyeR.position.set(3.47, 0.89, 0.29);

    const earL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), rabbitMat);
    earL.scale.set(0.65, 3.2, 0.45);
    earL.position.set(3.66, 1.12, 0.11);
    earL.rotation.z = -0.25;
    const earInnerL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), pinkMat);
    earInnerL.scale.set(0.55, 2.7, 0.35);
    earInnerL.position.set(3.64, 1.11, 0.11);
    earInnerL.rotation.z = -0.25;

    const earR = earL.clone();
    earR.position.set(3.66, 1.12, 0.29);
    const earInnerR = earInnerL.clone();
    earInnerR.position.set(3.64, 1.11, 0.29);

    const rTail = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), rabbitMat);
    rTail.position.set(3.91, 0.39, 0.2);

    this.lanternGroup.add(
      rBody, rHaunchL, rHaunchR, rPawL, rPawR,
      rHead, rNose, rEyeL, rEyeR,
      earL, earInnerL, earR, earInnerR, rTail
    );

    this.scene.add(this.lanternGroup);
  }

  buildTelescopeAndDistanceArch() {
    this.telescopeGroup = new THREE.Group();
    this.telescopeGroup.userData = { id: 'telescope' };

    // 觀測望遠鏡腳架與金銅鏡筒 (正北 x: -0.2, z: -3.3)
    const stand = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.1, 4),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 })
    );
    stand.position.set(-0.2, 0.55, -3.3);
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.1, 20),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.5, roughness: 0.3 })
    );
    tube.position.set(-0.2, 1.18, -3.3);
    tube.rotation.x = Math.PI / 3.2;
    this.telescopeGroup.add(stand, tube);

    // 地月距離看板 (最近36萬 / 平均38萬 / 最遠40萬公里)
    const distCanvas = document.createElement('canvas');
    distCanvas.width = 512;
    distCanvas.height = 192;
    const dCtx = distCanvas.getContext('2d');
    dCtx.fillStyle = '#0f172a';
    dCtx.fillRect(0, 0, 512, 192);
    dCtx.strokeStyle = '#38bdf8';
    dCtx.lineWidth = 5;
    dCtx.strokeRect(8, 8, 496, 176);
    dCtx.fillStyle = '#38bdf8';
    dCtx.font = 'bold 26px sans-serif';
    dCtx.fillText('🌍 地月距離天文觀測數據 🌕', 85, 52);
    dCtx.fillStyle = '#f8fafc';
    dCtx.font = 'bold 22px sans-serif';
    dCtx.fillText('最近：36 萬公里 ｜ 最遠：40 萬公里', 65, 105);
    dCtx.fillStyle = '#fde047';
    dCtx.fillText('平均距離：38 萬公里', 145, 152);

    const distBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.64),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(distCanvas) })
    );
    distBoard.position.set(-0.2, 1.85, -3.5);
    this.telescopeGroup.add(distBoard);

    this.scene.add(this.telescopeGroup);
  }

  buildTransportComparisonStage() {
    // 課本第60-61頁：就算搭飛機去月球，也要花上半個月；假如騎單車的話，則要騎三年！
    this.transportGroup = new THREE.Group();
    this.transportGroup.userData = { id: 'transport' };

    const stageBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.15, 0.22, 32),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 })
    );
    stageBase.position.set(-3.1, 0.11, 0.4);
    this.transportGroup.add(stageBase);

    // 1. 精緻民航客機模型（半個月）
    this.planeModel = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.2 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35, metalness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1, metalness: 0.8 });

    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.72, 24), bodyMat);
    fuselage.rotation.z = Math.PI / 2;
    const noseCone = new THREE.Mesh(new THREE.SphereGeometry(0.095, 20, 20), bodyMat);
    noseCone.scale.set(1.6, 1, 1);
    noseCone.position.set(0.36, 0, 0);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 16), glassMat);
    cockpit.scale.set(1.4, 0.7, 0.85);
    cockpit.position.set(0.34, 0.045, 0);
    const mainWings = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.92), wingMat);
    mainWings.position.set(0.02, -0.01, 0);
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.025), wingMat);
    tailFin.position.set(-0.32, 0.11, 0);
    const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.34), wingMat);
    tailWing.position.set(-0.32, 0.02, 0);
    const engGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.18, 16);
    const engL = new THREE.Mesh(engGeo, bodyMat);
    engL.rotation.z = Math.PI / 2;
    engL.position.set(0.05, -0.055, 0.24);
    const engR = engL.clone();
    engR.position.set(0.05, -0.055, -0.24);

    this.planeModel.add(fuselage, noseCone, cockpit, mainWings, tailFin, tailWing, engL, engR);
    this.planeModel.position.set(-3.1, 1.15, 0.1);
    this.transportGroup.add(this.planeModel);

    // 2. 精緻運動單車模型（三年）
    this.bikeModel = new THREE.Group();
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.25 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.35, roughness: 0.3 });

    const w1 = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 16, 32), tireMat);
    w1.position.set(-0.26, 0.2, 0);
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.012, 12, 28), rimMat);
    r1.position.set(-0.26, 0.2, 0);
    const w2 = w1.clone();
    w2.position.set(0.26, 0.2, 0);
    const r2 = r1.clone();
    r2.position.set(0.26, 0.2, 0);

    const topTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 12), frameMat);
    topTube.rotation.z = Math.PI / 2;
    topTube.position.set(0, 0.38, 0);
    const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 12), frameMat);
    downTube.rotation.z = 0.85;
    downTube.position.set(0.06, 0.29, 0);
    const seatTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 12), frameMat);
    seatTube.rotation.z = -0.25;
    seatTube.position.set(-0.14, 0.31, 0);
    const forkTube = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.34, 12), frameMat);
    forkTube.rotation.z = 0.28;
    forkTube.position.set(0.21, 0.32, 0);
    const handlebar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 12), tireMat);
    handlebar.rotation.x = Math.PI / 2;
    handlebar.position.set(0.17, 0.47, 0);
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 0.07), tireMat);
    saddle.position.set(-0.18, 0.46, 0);

    this.bikeModel.add(w1, r1, w2, r2, topTube, downTube, seatTube, forkTube, handlebar, saddle);
    this.bikeModel.position.set(-3.1, 0.24, 0.72);
    this.transportGroup.add(this.bikeModel);

    this.scene.add(this.transportGroup);
  }

  buildApolloLanderZone() {
    // 課本第62頁：阿波羅計畫中，阿姆斯壯登月時，管制中心開玩笑找漂亮姑娘與兔子！
    // 置於 x: 3.2, z: 2.3，支援載入 NASA 官方 Apollo Lunar Module.glb
    this.apolloGroup = new THREE.Group();
    this.apolloGroup.userData = { id: 'apollo' };

    this.apolloLanderHolder = new THREE.Group();
    this.apolloLanderHolder.position.set(3.2, 0, 2.3);

    // 程式化備援底座與艙體（載入 apollo.glb 後將自動替換為 NASA 134 網格真實登月艇！）
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.75, 0.55, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.45, roughness: 0.35 })
    );
    base.position.set(0, 0.45, 0);
    const cabin = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.3, roughness: 0.4 })
    );
    cabin.position.set(0, 0.98, 0);
    this.apolloLanderHolder.add(base, cabin);
    this.apolloGroup.add(this.apolloLanderHolder);

    // 登月旗幟
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 1.35, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc })
    );
    pole.position.set(2.35, 0.68, 2.5);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.35),
      new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide })
    );
    flag.position.set(2.62, 1.15, 2.5);
    this.apolloGroup.add(pole, flag);

    this.scene.add(this.apolloGroup);
  }

  buildMidAutumnCourtyard() {
    // 課本第62-63頁：中秋節大家邊吃月餅邊聊著月亮，體會科學的月球與文學的月亮
    this.mooncakeGroup = new THREE.Group();
    this.mooncakeGroup.userData = { id: 'mooncake' };

    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(0.75, 0.65, 0.58, 28),
      new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.5 })
    );
    table.position.set(-0.4, 0.29, 1.65);
    table.castShadow = true;
    this.mooncakeGroup.add(table);

    // 金色圓盤與四顆精緻月餅
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.32, 0.05, 24),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
    );
    plate.position.set(-0.4, 0.61, 1.65);
    this.mooncakeGroup.add(plate);

    const cakeOffsets = [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]];
    cakeOffsets.forEach(([ox, oz]) => {
      const cake = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.07, 16),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 })
      );
      cake.position.set(-0.4 + ox, 0.66, 1.65 + oz);
      this.mooncakeGroup.add(cake);
    });

    this.scene.add(this.mooncakeGroup);
  }

  buildTreasureBoxStation() {
    // 課本第64-67頁：語文百寶箱（呂/𠯑辨字、拒/距音同義不同、就算……也……、記敘與說明）
    this.treasureGroup = new THREE.Group();
    this.treasureGroup.userData = { id: 'treasure' };

    const chestBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.55, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.45 })
    );
    chestBase.position.set(-3.1, 0.28, 2.2);
    const chestLid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.85, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.35, roughness: 0.3 })
    );
    chestLid.rotation.z = Math.PI / 2;
    chestLid.position.set(-3.1, 0.56, 2.2);
    this.treasureGroup.add(chestBase, chestLid);

    this.scene.add(this.treasureGroup);
  }

  buildVocabBookshelf() {
    // 第五幕（南側邊界 x: 0, z: 3.85）：3D 生字與語詞書櫃（正面朝北 -Z，三格挑戰區，絕不擋道）
    const group = new THREE.Group();
    group.position.set(0, 0, 3.85);
    group.rotation.y = Math.PI;
    group.userData = { id: 'bookshelf' };

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.55,
      transparent: true,
      opacity: 1.0
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.4,
      transparent: true,
      opacity: 1.0
    });
    this.bookshelfMaterials = [woodMat, trimMat];

    // 書櫃背板與外框 (寬 2.4m, 高 2.15m, 深 0.42m)
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.15, 0.06), woodMat);
    backPanel.position.set(0, 1.075, -0.18);
    backPanel.castShadow = true;
    group.add(backPanel);

    const sideGeo = new THREE.BoxGeometry(0.08, 2.15, 0.42);
    const leftSide = new THREE.Mesh(sideGeo, woodMat);
    leftSide.position.set(-1.16, 1.075, 0);
    const rightSide = new THREE.Mesh(sideGeo, woodMat);
    rightSide.position.set(1.16, 1.075, 0);
    group.add(leftSide, rightSide);

    // 2 道中隔板分為「左：字音、中：字形、右：語詞」三格
    const divL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.95, 0.38), trimMat);
    divL.position.set(-0.38, 1.02, 0);
    const divR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.95, 0.38), trimMat);
    divR.position.set(0.38, 1.02, 0);
    group.add(divL, divR);

    // 4 層橫隔板
    [0.12, 0.72, 1.32, 1.98].forEach(y => {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.06, 0.42), trimMat);
      shelf.position.set(0, y, 0);
      group.add(shelf);
    });

    // 頂部發光橫匾：「📚 生字與語詞書櫃（18字・3關卡）」
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 96;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#fef3c7';
    sCtx.fillRect(0, 0, 512, 96);
    sCtx.strokeStyle = '#d97706';
    sCtx.lineWidth = 6;
    sCtx.strokeRect(4, 4, 504, 88);
    sCtx.fillStyle = '#9a3412';
    sCtx.font = 'bold 30px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.fillText('📚 生字與語詞書櫃（字音・字形・語詞）', 256, 58);

    const signMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(signCanvas),
      transparent: true,
      opacity: 1.0
    });
    this.bookshelfMaterials.push(signMat);

    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.38), signMat);
    signMesh.position.set(0, 2.28, 0.12);
    group.add(signMesh);

    // 三格專屬立牌與彩色課本生字書冊
    const zones = [
      { x: -0.76, color: 0xf59e0b, label: '🔊 字音挑戰' },
      { x: 0.0,   color: 0x10b981, label: '🔍 字形部首' },
      { x: 0.76,  color: 0x3b82f6, label: '💬 語詞句型' }
    ];

    zones.forEach((z) => {
      const bookMat = new THREE.MeshStandardMaterial({
        color: z.color,
        roughness: 0.35,
        transparent: true,
        opacity: 1.0
      });
      this.bookshelfMaterials.push(bookMat);

      for (let row = 0; row < 2; row++) {
        for (let b = 0; b < 4; b++) {
          const book = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.42, 0.26), bookMat);
          book.position.set(z.x - 0.21 + b * 0.14, 0.36 + row * 0.6, 0.02);
          group.add(book);
        }
      }
    });

    this.bookshelfGroup = group;
    this.scene.add(group);
  }

  /* ==========================================================================
     散落在月球各處的 6 大 3D 神秘太空寶箱系統（生字・隕石・任務・補給）
     ========================================================================== */
  createTreasureChestMesh(accentColor = 0xf59e0b) {
    const chestGroup = new THREE.Group();

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.3
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      metalness: 0.7,
      roughness: 0.25,
      emissive: accentColor,
      emissiveIntensity: 0.25
    });
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.4,
      roughness: 0.55
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.85
    });

    // 1. 箱體 Base Box (0.46m x 0.26m x 0.34m)
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.34), bodyMat);
    base.position.y = 0.13;
    base.castShadow = true;
    chestGroup.add(base);

    // 金屬加固邊框
    const trimBottom = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.04, 0.36), goldMat);
    trimBottom.position.y = 0.02;
    const trimMid = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.035, 0.36), goldMat);
    trimMid.position.y = 0.24;
    chestGroup.add(trimBottom, trimMid);

    // 2. 鉸鏈蓋 (Lid Group, pivot at back top edge y=0.26, z=-0.17)
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 0.26, -0.17);

    const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.46, 20, 1, false, 0, Math.PI), bodyMat);
    lidMesh.rotation.z = Math.PI * 0.5;
    lidMesh.position.set(0, 0, 0.17);
    lidMesh.castShadow = true;

    const lidTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.48, 20, 1, false, 0, Math.PI), goldMat);
    lidTrim.rotation.z = Math.PI * 0.5;
    lidTrim.position.set(0, 0, 0.17);
    lidTrim.scale.set(1.02, 0.28, 1.02);

    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.03), goldMat);
    lock.position.set(0, 0.01, 0.34);

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), glowMat);
    gem.position.set(0, 0.07, 0.34);

    lidGroup.add(lidMesh, lidTrim, lock, gem);
    chestGroup.add(lidGroup);

    // 3. 浮動旋轉能量水晶 (浮在寶箱上方)
    const floatGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.085, 0), glowMat);
    floatGem.position.set(0, 0.58, 0);
    chestGroup.add(floatGem);

    // 4. 地面微光環
    const groundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.26, 0.42, 24),
      new THREE.MeshBasicMaterial({ color: accentColor, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false })
    );
    groundRing.rotation.x = -Math.PI * 0.5;
    groundRing.position.y = 0.01;
    chestGroup.add(groundRing);

    return { chestGroup, lidGroup, floatGem, groundRing };
  }

  buildMoonChests() {
    this.moonChests = [];
    const chestDefs = [
      {
        id: 'chest_sound',
        stationId: 11,
        name: '神秘寶箱：字音晶片 🎁',
        type: 'vocab',
        pos: new THREE.Vector3(-1.85, 0, 2.75),
        color: 0xf59e0b,
        icon: '🔊',
        title: '【月球神秘寶箱：字音晶片】',
        tag: '生字第 11 站・字音辨析',
        desc: '寶箱中放著「金光字音晶片」！挑戰本課「隕（ㄩㄣˇ）石」、「玉兔搗（ㄉㄠˇ）藥」、「揭（ㄐㄧㄝ）開真相」、「撞擊（ㄓㄨㄤˋ ㄐㄧˊ）」、「嫦娥（ㄔㄤˊ ㄜˊ）」讀音，喚醒晶片能量！',
        reward: '獲得字音探險家徽章 + 20 HP！'
      },
      {
        id: 'chest_meteor',
        name: '神秘寶箱：小行星隕石碎片 ☄️',
        type: 'meteor',
        pos: new THREE.Vector3(2.85, 0, -2.75),
        color: 0xea580c,
        icon: '☄️',
        title: '【天降隕石神秘碎片】',
        tag: '隕石坑地質驚喜・免答題直接獲得',
        desc: '<b>鏘！寶箱自動開啟！</b><br>你在月球隕石坑底挖掘出一顆「真實 1999 RQ36 小行星隕石玄武岩碎片」！<br><br>💡 <b>月球科學冷知識</b>：月球因為沒有水和大氣層保護，四十五億年來遭到大量流星體撞擊，形成了深淺不一的坑洞！<br><br>❤️ <b>體力大恢復</b>：成功採集隕石樣本，體力 +25 HP！',
        reward: '採集小行星隕石碎片成功 + 25 HP！'
      },
      {
        id: 'chest_shape',
        stationId: 12,
        name: '神秘寶箱：字形與部首 ✍️',
        type: 'vocab',
        pos: new THREE.Vector3(-3.25, 0, -1.2),
        color: 0x0284c7,
        icon: '✍️',
        title: '【月球神秘寶箱：字形與部首】',
        tag: '生字第 12 站・字形與部首',
        desc: '這只天藍色寶箱裡放著「部首拆解放大鏡」！挑戰課本 15 個生字的部首與筆畫易錯點（「隕（阜部）」、「萬（禸部）」、「狀（犬部）」、「館/管」直豎 vs「鋁/營」撇連），獲得漢字解構達人徽章！',
        reward: '獲得漢字解構達人徽章 + 20 HP！'
      },
      {
        id: 'chest_jump',
        name: '神秘寶箱：阿波羅低重力小任務 🚀',
        type: 'jump_task',
        pos: new THREE.Vector3(3.2, 0, 1.85),
        color: 0x10b981,
        icon: '🚀',
        title: '【阿波羅 11 號太空任務寶箱】',
        tag: '登月艇基地・月球低重力挑戰小任務',
        desc: '<b>嗶嗶嗶！宇航通訊器響起！</b><br>阿波羅太空人向你發送「月球低重力 3 次大漫步」任務！月球重力只有地球的 1/6，請按下【跳躍按鈕】或【空白鍵】在月面上完成 3 次輕盈跳躍！',
        reward: '完成低重力跳躍任務 + 30 HP！'
      },
      {
        id: 'chest_mooncake',
        name: '神秘寶箱：中秋月餅與詩詞補給 🥮',
        type: 'mooncake',
        pos: new THREE.Vector3(1.65, 0, 3.2),
        color: 0xd97706,
        icon: '🥮',
        title: '【中秋文學月餅與詩詞補給箱】',
        tag: '中秋賞月星空台・文學能量補給',
        desc: '<b>哇！開箱飄出陣陣蓮蓉香氣！</b><br>寶箱裡放著一盤剛出爐的金黃冰皮雙黃月餅與一張李白《靜夜思》星光詩籤！<br><br>🌕 <b>詩仙李白說</b>：「床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。」文學裡的月亮撫慰了無數遊子的心！<br><br>✨ <b>能量全滿</b>：享用美味月餅，體力瞬間恢復至 100 HP！',
        reward: '享用中秋美味月餅，體力全滿 100 HP！'
      },
      {
        id: 'chest_phrase',
        stationId: 13,
        name: '神秘寶箱：語詞與句型 🌟',
        type: 'vocab',
        pos: new THREE.Vector3(-0.45, 0, -3.45),
        color: 0x8b5cf6,
        icon: '🌟',
        title: '【月球神秘寶箱：語詞與句型】',
        tag: '生字第 13 站・語詞句型應用',
        desc: '翡翠綠色的星光寶箱裡閃耀著「語文百寶箱水晶」！挑戰「就算……也……」假設強調句型、閱讀寫作手法與易錯字挑錯，完成全課生字語詞大滿貫！',
        reward: '獲得文豪小探險家徽章 + 20 HP！'
      }
    ];

    this.chestDefinitions = chestDefs;

    chestDefs.forEach((cdef) => {
      const { chestGroup, lidGroup, floatGem, groundRing } = this.createTreasureChestMesh(cdef.color);
      chestGroup.position.copy(cdef.pos);
      chestGroup.userData = { id: cdef.id, name: cdef.name };
      this.scene.add(chestGroup);

      this.moonChests.push({
        def: cdef,
        group: chestGroup,
        lid: lidGroup,
        gem: floatGem,
        ring: groundRing,
        opened: false
      });
    });
  }

  openMoonChest(chestId) {
    const chest = this.moonChests ? this.moonChests.find(c => c.def.id === chestId) : null;
    if (!chest) return;

    if (!chest.opened) {
      chest.opened = true;
      if (chest.lid) {
        chest.lid.rotation.x = -Math.PI * 0.42;
      }
      if (window.soundSystem) window.soundSystem.playSuccess();
      this.spawnHeartsNear(chest.def.pos);
    }

    if (chest.def.type === 'meteor') {
      if (window.soundSystem) window.soundSystem.playMeteorImpact();
      if (window.curriculumSystem) {
        window.curriculumSystem.G.hp = Math.min(100, window.curriculumSystem.G.hp + 25);
        window.curriculumSystem.updateHUD();
      }
      this.openFurnitureModal(chestId);
      this.showPrompt('☄️ 開啟天降隕石寶箱！採集到 1999 RQ36 小行星隕石碎片，體力 +25 HP！');
    } else if (chest.def.type === 'mooncake') {
      if (window.soundSystem) window.soundSystem.playJadeRabbitChime();
      if (window.curriculumSystem) {
        window.curriculumSystem.G.hp = 100;
        window.curriculumSystem.updateHUD();
      }
      this.openFurnitureModal(chestId);
      this.showPrompt('🥮 開啟中秋文學補給箱！品嚐美味月餅，體力瞬間補滿至 100 HP！🌕✨');
    } else if (chest.def.type === 'jump_task') {
      this.activeChestTask = 'jump';
      this.jumpTaskCount = 0;
      this.openFurnitureModal(chestId);
      this.showPrompt('🚀 阿波羅太空挑戰啟動！請在月面上連續完成 3 次低重力跳躍！');
    } else if (chest.def.type === 'vocab') {
      this.openFurnitureModal(chestId);
    }
  }

  /* ==========================================================================
     3D 真實 GLB 模型與 NASA 衛星材質載入器 (方案 A：GLTFLoader + DRACOLoader)
     ========================================================================== */
  fitModel(obj, targetHeight, rotY = 0) {
    const wrapper = new THREE.Group();
    obj.rotation.y = rotY;
    obj.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const scale = targetHeight / Math.max(size.y, 0.001);
    obj.scale.multiplyScalar(scale);
    obj.updateMatrixWorld(true);

    const box2 = new THREE.Box3().setFromObject(obj);
    const center2 = new THREE.Vector3();
    box2.getCenter(center2);

    obj.position.x -= center2.x;
    obj.position.z -= center2.z;
    obj.position.y -= box2.min.y;

    obj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.isSkinnedMesh) {
          child.frustumCulled = false;
        }
      }
    });

    wrapper.add(obj);
    return wrapper;
  }

  swapIn(group, model) {
    if (!group || !model) return;
    group.children.forEach((c) => {
      c.visible = false;
    });
    group.add(model);
  }

  loadGLBModels() {
    const modelsMap = window.BIRD_MODELS || {};
    const texLoader = new THREE.TextureLoader();

    // 1. 套用 NASA 真實月球與地球高解析衛星貼圖與凹凸貼圖 (Bump Map)
    if (modelsMap.moon_tex) {
      texLoader.load(modelsMap.moon_tex, (tex) => {
        if (this.skyMoon && this.skyMoon.material) {
          this.skyMoon.material.map = tex;
          this.skyMoon.material.bumpMap = tex;
          this.skyMoon.material.bumpScale = 0.06;
          this.skyMoon.material.emissive = new THREE.Color(0xfef08a);
          this.skyMoon.material.emissiveMap = tex;
          this.skyMoon.material.emissiveIntensity = 0.42;
          this.skyMoon.material.needsUpdate = true;
        }
      });
    }
    if (modelsMap.earth_tex && this.libraryGlobe) {
      texLoader.load(modelsMap.earth_tex, (tex) => {
        this.libraryGlobe.material.map = tex;
        this.libraryGlobe.material.color.setHex(0xffffff);
        this.libraryGlobe.material.needsUpdate = true;
      });
    }

    if (typeof THREE.GLTFLoader !== 'function') return;

    const loader = new THREE.GLTFLoader();
    if (typeof THREE.DRACOLoader === 'function') {
      const dracoLoader = new THREE.DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
      loader.setDRACOLoader(dracoLoader);
    }

    const loadOne = (key, onDone) => {
      const src = modelsMap[key] || `models/${key}.glb`;
      loader.load(src, onDone, undefined, (err) => {
        console.warn(`GLB fallback for ${key}:`, err);
      });
    };

    // 2. 載入主角 1：NASA 真實 3D 登月太空人 (astronaut.glb)
    loadOne('astronaut', (gltf) => {
      gltf.scene.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          c.material.metalness = Math.min(c.material.metalness || 0, 0.25);
          c.material.roughness = Math.max(c.material.roughness || 0.5, 0.45);
          c.material.emissive = new THREE.Color(0x334155);
          c.material.emissiveIntensity = 0.22;
        }
      });
      const fitted = this.fitModel(gltf.scene, 1.26, 0);
      this.swapIn(this.astronautVisualGroup, fitted);
      this.astronautGLB = fitted;
    });

    // 3. 載入主角 2（好奇小讀者／小小天文探險家）：深藍色鴨舌帽、卡其探險背心與短褲、小望遠鏡與書包 3D 人物 (explorer.glb)
    loadOne('explorer', (gltf) => {
      gltf.scene.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          c.material.metalness = Math.min(c.material.metalness || 0, 0.2);
          c.material.roughness = Math.max(c.material.roughness || 0.5, 0.5);
          c.castShadow = true;
        }
      });
      const fitted = this.fitModel(gltf.scene, 1.25, 0);
      this.swapIn(this.readerVisualGroup, fitted);
      this.readerModel = fitted;
      this.readerNodes = {
        legL: fitted.getObjectByName('LegL'),
        legR: fitted.getObjectByName('LegR'),
        armL: fitted.getObjectByName('ArmL'),
        armR: fitted.getObjectByName('ArmR'),
        head: fitted.getObjectByName('Head'),
        bag: fitted.getObjectByName('ExplorerBackpack'),
        scope: fitted.getObjectByName('MiniTelescope')
      };
    });

    // 4. 載入 NPC：自然科學老師真實 3D 人物模型 (teacher.glb)
    loadOne('teacher', (gltf) => {
      gltf.scene.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          c.material.metalness = Math.min(c.material.metalness || 0, 0.2);
          c.material.roughness = Math.max(c.material.roughness || 0.5, 0.5);
        }
      });
      const fitted = this.fitModel(gltf.scene, 1.52, -0.45);
      this.swapIn(this.player, fitted);
      this.teacherGLB = fitted;
    });

    // 5. 載入 NASA 官方阿波羅 11 號登月艇 3D 模型 (apollo.glb)
    loadOne('apollo', (gltf) => {
      gltf.scene.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          c.material.metalness = Math.min(c.material.metalness || 0, 0.35);
          c.material.roughness = Math.max(c.material.roughness || 0.4, 0.38);
        }
      });
      const fitted = this.fitModel(gltf.scene, 1.75, -0.5);
      this.swapIn(this.apolloLanderHolder, fitted);
    });

    // 6. 載入 NASA 官方 1999 RQ36 隕石／小行星 3D 模型 (asteroid.glb)
    loadOne('asteroid', (gltf) => {
      const fitted = this.fitModel(gltf.scene, 0.46, 0);
      fitted.traverse((c) => {
        if (c.isMesh && c.material) {
          c.material = c.material.clone();
          c.material.emissive = new THREE.Color(0xea580c);
          c.material.emissiveIntensity = 0.35;
        }
      });
      this.swapIn(this.fallingMeteor, fitted);

      // 在月球坑洞區周圍放置 3 顆立體隕石岩塊
      const rockCoords = [
        { x: 2.15, z: -2.45, h: 0.32, ry: 0.8 },
        { x: 3.55, z: -1.95, h: 0.28, ry: 2.1 },
        { x: 3.15, z: -3.25, h: 0.36, ry: 1.4 }
      ];
      rockCoords.forEach((rc) => {
        const cloneRock = this.fitModel(gltf.scene.clone(true), rc.h, rc.ry);
        cloneRock.position.set(rc.x, 0.02, rc.z);
        this.craterGroup.add(cloneRock);
      });
    });

    // 7. 載入圖書館書架頂部 3D 太空火箭模型 (rocket.glb)
    loadOne('rocket', (gltf) => {
      const fitted = this.fitModel(gltf.scene, 0.85, 0.4);
      this.swapIn(this.libraryRocketHolder, fitted);
    });
  }

  buildCuteExplorerVisual() {
    const explorerGroup = new THREE.Group();
    explorerGroup.name = 'LittleAstronomyExplorer';

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfba, roughness: 0.5 });
    const blushMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.6 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.2 });
    const eyeShineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x582f0e, roughness: 0.7 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 });
    const capBadgeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.5 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const khakiMat = new THREE.MeshStandardMaterial({ color: 0xc89d66, roughness: 0.65 });
    const pocketMat = new THREE.MeshStandardMaterial({ color: 0xb58548, roughness: 0.7 });
    const backpackMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.6 });
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.6 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.7 });
    const strapCordMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
    const sockMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });

    // 1. Head
    const headGroup = new THREE.Group();
    headGroup.name = 'Head';
    headGroup.position.set(0, 0.88, 0);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 20), skinMat);
    headMesh.scale.set(1.02, 1.0, 0.98);
    headGroup.add(headMesh);

    const blushL = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), blushMat);
    blushL.position.set(-0.11, -0.04, 0.185);
    blushL.rotation.y = -0.3;
    const blushR = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), blushMat);
    blushR.position.set(0.11, -0.04, 0.185);
    blushR.rotation.y = 0.3;
    headGroup.add(blushL, blushR);

    const eyeGeo = new THREE.SphereGeometry(0.042, 16, 16);
    eyeGeo.scale(0.85, 1.15, 0.4);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.075, 0.02, 0.185);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.075, 0.02, 0.185);

    const shineGeo = new THREE.SphereGeometry(0.012, 10, 10);
    const shineL = new THREE.Mesh(shineGeo, eyeShineMat);
    shineL.position.set(-0.065, 0.035, 0.20);
    const shineR = new THREE.Mesh(shineGeo, eyeShineMat);
    shineR.position.set(0.085, 0.035, 0.20);
    headGroup.add(eyeL, eyeR, shineL, shineR);

    const mouthGeo = new THREE.TorusGeometry(0.03, 0.007, 8, 16, Math.PI * 0.75);
    const mouth = new THREE.Mesh(mouthGeo, new THREE.MeshBasicMaterial({ color: 0x9f1239 }));
    mouth.position.set(0, -0.09, 0.19);
    mouth.rotation.x = Math.PI * 0.85;
    mouth.rotation.z = Math.PI;
    headGroup.add(mouth);

    // Hair
    const hairGroup = new THREE.Group();
    const bang1 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 8), hairMat);
    bang1.position.set(-0.06, 0.09, 0.19);
    bang1.rotation.set(-0.4, 0.1, -0.2);
    const bang2 = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 8), hairMat);
    bang2.position.set(0.01, 0.10, 0.195);
    bang2.rotation.set(-0.35, -0.1, 0.1);
    const bang3 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 8), hairMat);
    bang3.position.set(0.07, 0.08, 0.185);
    bang3.rotation.set(-0.4, -0.2, 0.25);
    const sideL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), hairMat);
    sideL.position.set(-0.18, 0.01, 0.02);
    sideL.scale.set(0.6, 1.4, 1.0);
    const sideR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), hairMat);
    sideR.position.set(0.18, 0.01, 0.02);
    sideR.scale.set(0.6, 1.4, 1.0);
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 16), hairMat);
    backHair.position.set(0, -0.02, -0.05);
    hairGroup.add(bang1, bang2, bang3, sideL, sideR, backHair);
    headGroup.add(hairGroup);

    // Navy Cap
    const capGroup = new THREE.Group();
    const capCrown = new THREE.Mesh(new THREE.SphereGeometry(0.225, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.52), capMat);
    capCrown.position.set(0, 0.04, -0.01);
    capCrown.rotation.x = -0.08;
    const brimGeo = new THREE.CylinderGeometry(0.22, 0.23, 0.025, 24, 1, false, Math.PI * 0.25, Math.PI * 0.5);
    const capBrim = new THREE.Mesh(brimGeo, capMat);
    capBrim.position.set(0, 0.05, 0.13);
    capBrim.rotation.x = 0.22;
    capBrim.scale.set(1.05, 1.0, 1.35);
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.01, 16), capBadgeMat);
    badge.position.set(0, 0.15, 0.165);
    badge.rotation.x = 0.35;
    capGroup.add(capCrown, capBrim, badge);
    headGroup.add(capGroup);

    explorerGroup.add(headGroup);

    // 2. Torso with Khaki Vest
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.56, 0);

    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.34, 16), shirtMat);
    torsoGroup.add(shirt);

    const vestGeo = new THREE.CylinderGeometry(0.195, 0.205, 0.32, 16, 1, true, 0.35, Math.PI * 2 - 0.7);
    const vest = new THREE.Mesh(vestGeo, khakiMat);
    vest.position.set(0, -0.01, 0);
    vest.rotation.y = Math.PI * 0.5 + 0.35;
    torsoGroup.add(vest);

    const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.02), khakiMat);
    lapelL.position.set(-0.085, 0.01, 0.185);
    lapelL.rotation.z = -0.15;
    const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.02), khakiMat);
    lapelR.position.set(0.085, 0.01, 0.185);
    lapelR.rotation.z = 0.15;
    torsoGroup.add(lapelL, lapelR);

    const pocketGeo = new THREE.BoxGeometry(0.075, 0.085, 0.035);
    const pocketL = new THREE.Mesh(pocketGeo, pocketMat);
    pocketL.position.set(-0.11, -0.06, 0.17);
    const pocketR = new THREE.Mesh(pocketGeo, pocketMat);
    pocketR.position.set(0.11, -0.06, 0.17);
    torsoGroup.add(pocketL, pocketR);

    // Mini Telescope
    const telescopeGroup = new THREE.Group();
    telescopeGroup.name = 'MiniTelescope';
    telescopeGroup.position.set(0.02, -0.02, 0.21);
    telescopeGroup.rotation.z = 0.3;

    const cord = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.007, 8, 20, Math.PI), strapCordMat);
    cord.position.set(-0.02, 0.14, -0.05);
    cord.rotation.x = Math.PI * 0.4;
    torsoGroup.add(cord);

    const mainBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.15, 16), brassMat);
    const frontLensRing = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.025, 16), brassMat);
    frontLensRing.position.y = 0.075;
    const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.033, 16), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.8 }));
    lensGlass.position.y = 0.088;
    lensGlass.rotation.x = -Math.PI * 0.5;
    const eyePiece = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.04, 14), strapCordMat);
    eyePiece.position.y = -0.08;
    telescopeGroup.add(mainBarrel, frontLensRing, lensGlass, eyePiece);
    torsoGroup.add(telescopeGroup);

    // Explorer Backpack
    const backpackGroup = new THREE.Group();
    backpackGroup.name = 'ExplorerBackpack';
    backpackGroup.position.set(0, 0.02, -0.17);

    const bagBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.14), backpackMat);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.14, 0.15), strapMat);
    flap.position.set(0, 0.09, 0.01);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), capBadgeMat);
    buckle.position.set(0, 0.01, -0.075);
    const bottleHolder = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 12), khakiMat);
    bottleHolder.position.set(0.16, -0.05, 0);
    const miniBottle = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x0ea5e9 }));
    miniBottle.position.set(0.16, -0.02, 0);
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.32, 0.02), strapMat);
    strapL.position.set(-0.11, 0.01, 0.20);
    strapL.rotation.x = -0.1;
    const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.32, 0.02), strapMat);
    strapR.position.set(0.11, 0.01, 0.20);
    strapR.rotation.x = -0.1;

    backpackGroup.add(bagBody, flap, buckle, bottleHolder, miniBottle);
    torsoGroup.add(backpackGroup, strapL, strapR);
    explorerGroup.add(torsoGroup);

    // 3. Khaki Shorts
    const shortsGroup = new THREE.Group();
    shortsGroup.position.set(0, 0.34, 0);
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.20, 0.14, 16), khakiMat);
    const legShortL = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.10, 0.14, 14), khakiMat);
    legShortL.position.set(-0.095, -0.08, 0);
    const legShortR = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.10, 0.14, 14), khakiMat);
    legShortR.position.set(0.095, -0.08, 0);
    shortsGroup.add(waist, legShortL, legShortR);
    explorerGroup.add(shortsGroup);

    // 4. Legs
    const createLeg = (isLeft) => {
      const leg = new THREE.Group();
      leg.name = isLeft ? 'LegL' : 'LegR';
      const sign = isLeft ? -1 : 1;
      leg.position.set(sign * 0.095, 0.24, 0);
      const skinLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.12, 12), skinMat);
      skinLeg.position.y = -0.02;
      const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.07, 12), sockMat);
      sock.position.y = -0.09;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.17), shoeMat);
      shoe.position.set(0, -0.16, 0.03);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.18), soleMat);
      sole.position.set(0, -0.20, 0.03);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), soleMat);
      toe.position.set(0, -0.16, 0.10);
      toe.scale.set(1.0, 0.7, 1.0);
      leg.add(skinLeg, sock, shoe, sole, toe);
      return leg;
    };
    const legL = createLeg(true);
    const legR = createLeg(false);
    explorerGroup.add(legL, legR);

    // 5. Arms
    const createArm = (isLeft) => {
      const arm = new THREE.Group();
      arm.name = isLeft ? 'ArmL' : 'ArmR';
      const sign = isLeft ? -1 : 1;
      arm.position.set(sign * 0.23, 0.68, 0);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.10, 12), shirtMat);
      sleeve.position.y = -0.03;
      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.18, 12), skinMat);
      forearm.position.y = -0.14;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 14), skinMat);
      hand.position.y = -0.25;
      arm.add(sleeve, forearm, hand);
      return arm;
    };
    const armL = createArm(true);
    const armR = createArm(false);
    explorerGroup.add(armL, armR);

    explorerGroup.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    return {
      group: explorerGroup,
      nodes: {
        legL, legR, armL, armR,
        head: headGroup,
        bag: backpackGroup,
        scope: telescopeGroup
      }
    };
  }

  /* ==========================================================================
     角色模型：1. 登月太空人 (Astronaut) 2. 自然科學老師／小讀者 (Teacher)
     ========================================================================== */
  createAstronautAvatar() {
    const group = new THREE.Group();
    this.astronautVisualGroup = new THREE.Group();
    this.readerVisualGroup = new THREE.Group();
    this.readerVisualGroup.visible = false;
    group.add(this.astronautVisualGroup, this.readerVisualGroup);

    // 建立小小天文探險家可愛小學生形象（深藍色鴨舌帽、卡其探險背心與短褲、掛小望遠鏡與雙肩書包）
    const cute = this.buildCuteExplorerVisual();
    this.readerVisualGroup.add(cute.group);
    this.readerNodes = cute.nodes;

    const meshGroup = new THREE.Group();
    this.astronautVisualGroup.add(meshGroup);

    const suitMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.4 });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      metalness: 0.7,
      roughness: 0.15
    });

    // 太空服軀幹与維生背包 (腳底 y = 0)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.3), suitMat);
    body.position.y = 0.48;
    body.castShadow = true;
    meshGroup.add(body);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.18), orangeMat);
    pack.position.set(0, 0.5, -0.22);
    meshGroup.add(pack);

    // 太空頭盔與金色面罩
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 24), suitMat);
    helmet.position.y = 0.92;
    helmet.castShadow = true;
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.21, 20, 20), visorMat);
    visor.position.set(0, 0.92, 0.1);
    meshGroup.add(helmet, visor);
    this.catHead = helmet;

    // 四肢
    const legGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.28, 12);
    const legL = new THREE.Mesh(legGeo, suitMat);
    legL.position.set(-0.11, 0.14, 0);
    const legR = new THREE.Mesh(legGeo, suitMat);
    legR.position.set(0.11, 0.14, 0);
    const armL = new THREE.Mesh(legGeo, orangeMat);
    armL.position.set(-0.27, 0.48, 0);
    const armR = new THREE.Mesh(legGeo, orangeMat);
    armR.position.set(0.27, 0.48, 0);
    meshGroup.add(legL, legR, armL, armR);

    this.catLegs = [legL, legR, armL, armR];
    this.catMeshGroup = meshGroup;

    group.position.copy(this.catPos);
    this.scene.add(group);
    this.cat = group;
  }

  createTeacherAvatar() {
    // 自然科學老師 NPC / 第二視角角色
    const pGroup = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.5 });
    const coatMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });

    const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.55, 14);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.12, 0.275, 0);
    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0.12, 0.275, 0);
    pGroup.add(legL, legR);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.28), coatMat);
    torso.position.y = 0.86;
    torso.castShadow = true;
    pGroup.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), skinMat);
    head.position.y = 1.38;
    head.castShadow = true;
    pGroup.add(head);

    const armGeo = new THREE.CylinderGeometry(0.065, 0.06, 0.48, 12);
    const armL = new THREE.Mesh(armGeo, coatMat);
    armL.position.set(-0.3, 0.86, 0);
    const armR = new THREE.Mesh(armGeo, coatMat);
    armR.position.set(0.3, 0.86, 0);
    pGroup.add(armL, armR);

    this.playerNodes = { legL, legR, armL, armR, torso, head };
    pGroup.position.copy(this.playerPos);
    this.scene.add(pGroup);
    this.player = pGroup;
  }

  /* ==========================================================================
     相機 360° 控制、手機類比搖桿 (#pad / #padKnob) 與防穿透系統
     ========================================================================== */
  setupOrbitCameraControls() {
    const dom = this.container;

    dom.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.prevMouse.x;
      const deltaY = e.clientY - this.prevMouse.y;

      this.cameraYaw -= deltaX * 0.007;
      this.cameraPitch += deltaY * 0.005;
      this.cameraPitch = Math.max(0.06, Math.min(1.28, this.cameraPitch));

      this.prevMouse = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance += e.deltaY * 0.0025;
      this.cameraDistance = Math.max(1.6, Math.min(7.5, this.cameraDistance));
    }, { passive: false });

    let touchStartDist = 0;
    dom.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    dom.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const deltaX = e.touches[0].clientX - this.prevMouse.x;
        const deltaY = e.touches[0].clientY - this.prevMouse.y;
        this.cameraYaw -= deltaX * 0.008;
        this.cameraPitch += deltaY * 0.006;
        this.cameraPitch = Math.max(0.06, Math.min(1.28, this.cameraPitch));
        this.prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.cameraDistance += (touchStartDist - dist) * 0.005;
        this.cameraDistance = Math.max(1.6, Math.min(7.5, this.cameraDistance));
        touchStartDist = dist;
      }
    });

    dom.addEventListener('touchend', () => {
      this.isDragging = false;
    });
  }

  setupMobileControls() {
    const pad = document.getElementById('pad');
    const knob = document.getElementById('padKnob');
    const maxR = 48;
    let padTouchId = null;

    const getPadCenter = () => {
      if (!pad) return { x: 80, y: window.innerHeight - 84 };
      const r = pad.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const handlePadTouch = (clientX, clientY) => {
      const c = getPadCenter();
      let dx = clientX - c.x;
      let dy = clientY - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist > maxR) {
        dx = (dx / dist) * maxR;
        dy = (dy / dist) * maxR;
      }
      if (knob) {
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
      }
      if (window.__bird && window.__bird.JOY) {
        window.__bird.JOY.x = dx / maxR;
        window.__bird.JOY.y = dy / maxR;
      }
    };

    const onTouchStart = (e) => {
      const c = getPadCenter();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const dist = Math.hypot(t.clientX - c.x, t.clientY - c.y);
        if (dist <= 75 && padTouchId === null) {
          padTouchId = t.identifier;
          handlePadTouch(t.clientX, t.clientY);
          e.preventDefault();
          break;
        }
      }
    };

    const onTouchMove = (e) => {
      if (padTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === padTouchId) {
          e.preventDefault();
          handlePadTouch(t.clientX, t.clientY);
          break;
        }
      }
    };

    const onTouchEnd = (e) => {
      if (padTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === padTouchId) {
          padTouchId = null;
          if (knob) knob.style.transform = '';
          if (window.__bird && window.__bird.JOY) {
            window.__bird.JOY.x = 0;
            window.__bird.JOY.y = 0;
          }
          break;
        }
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchEnd, { passive: false });

    // 非搖桿區域的全畫面觸控拖曳旋轉視角 (滿足 touch_check.py 拖曳轉視角檢測)
    let camTouchId = null;
    let lastCamX = 0;
    window.addEventListener('touchstart', (e) => {
      const c = getPadCenter();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (Math.hypot(t.clientX - c.x, t.clientY - c.y) <= 75) continue;
        if (camTouchId === null) {
          camTouchId = t.identifier;
          lastCamX = t.clientX;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (camTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === camTouchId) {
          const dx = t.clientX - lastCamX;
          lastCamX = t.clientX;
          this.cameraYaw -= dx * 0.008;
        }
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (camTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === camTouchId) {
          camTouchId = null;
        }
      }
    }, { passive: true });
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      if (key === 'e') this.interactWithNearby();
      if (key === 'v') this.toggleView();
      if (key === 'f') this.openFurnitureModal('newspaper');
      if (key === ' ' || e.code === 'Space') this.catJump();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    const viewBtn = document.getElementById('btn-toggle-view');
    if (viewBtn) viewBtn.addEventListener('click', () => this.toggleView());

    const muteBtn = document.getElementById('btn-mute');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = window.soundSystem.toggleMute();
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
      });
    }

    const bgmBtn = document.getElementById('btn-bgm');
    if (bgmBtn) {
      bgmBtn.addEventListener('click', () => {
        const playing = window.soundSystem.toggleBGM();
        bgmBtn.classList.toggle('active', playing);
      });
    }
  }

  /* ==========================================================================
     月球低重力跳躍與課文互動動作
     ========================================================================== */
  catJump() {
    const now = Date.now();
    if (this._lastJumpTime && now - this._lastJumpTime < 650) return;
    this._lastJumpTime = now;

    if (this.catIsGrounded || this.catPos.y <= 0.05) {
      // 月球 1/6 低重力輕盈跳躍！
      this.catVelocityY = 4.2;
      this.catIsGrounded = false;
      if (window.soundSystem) window.soundSystem.playClick();
      this.showPrompt('🧑‍🚀 月球低重力跳躍！輕飄飄地飛起來囉！🌕✨');

      // 檢查是否進行阿波羅太空低重力跳躍小任務
      if (this.activeChestTask === 'jump') {
        this.jumpTaskCount = (this.jumpTaskCount || 0) + 1;
        this.showPrompt(`🚀 阿波羅低重力跳躍任務：第 ${this.jumpTaskCount} / 3 次！`);
        if (this.jumpTaskCount >= 3) {
          this.activeChestTask = null;
          this.jumpTaskCount = 0;
          if (window.soundSystem) window.soundSystem.playSuccess();
          if (window.curriculumSystem) {
            window.curriculumSystem.G.hp = Math.min(100, window.curriculumSystem.G.hp + 30);
            window.curriculumSystem.updateHUD();
          }
          this.spawnHeartsNear(this.catPos);
          setTimeout(() => {
            alert('🎉 恭喜完成【阿波羅 11 號低重力 3 次大漫步小任務】！\n\n獲得「月面跳躍冠軍」星星徽章，體力大幅恢復 +30 HP！🌕✨');
          }, 350);
        }
      }
    }
  }

  playWand() {
    // 觀測月球坑洞與隕石
    if (window.soundSystem) window.soundSystem.playMeteorImpact();
    if (window.voiceSystem) window.voiceSystem.speak('crater');
    this.spawnHeartsNear(this.catPos);
    this.showPrompt('☄️ 觀測月球表面：沒有水和大氣保護，隕石撞擊形成高低不平的坑洞！');
  }

  petCatHead() {
    // 聆聽阿波羅登月趣聞
    if (window.soundSystem) window.soundSystem.playApolloBeep();
    if (window.voiceSystem) window.voiceSystem.speak('apollo');
    this.spawnHeartsNear(this.catPos);
    this.showPrompt('👨‍🏫 自然科學老師分享：阿姆斯壯登月時，管制中心開玩笑要他找嫦娥和玉兔呢！🐇');
  }

  feedCat() {
    // 品嚐中秋月餅補充體力
    if (window.soundSystem) window.soundSystem.playJadeRabbitChime();
    if (window.voiceSystem) window.voiceSystem.speak('midautumn');
    if (window.curriculumSystem) {
      window.curriculumSystem.G.hp = Math.min(100, window.curriculumSystem.G.hp + 25);
      window.curriculumSystem.updateHUD();
    }
    this.spawnHeartsNear(this.catPos);
    this.showPrompt('🥮 品嚐香甜中秋月餅！體力恢復 +25 HP，文學的月亮近在身邊！🌕');
  }

  chatMeow() {
    if (window.soundSystem) window.soundSystem.playApolloBeep();
    if (window.voiceSystem) window.voiceSystem.speak('newspaper');
    this.spawnHeartsNear(this.catPos);
  }

  spawnHeartsNear(pos) {
    const parent = document.getElementById('ui-overlay');
    if (!parent) return;

    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const star = document.createElement('div');
        star.className = 'floating-heart';
        star.textContent = ['🌕', '✨', '🚀', '🐇'][Math.floor(Math.random() * 4)];

        const tempV = pos.clone();
        tempV.project(this.camera);
        const x = (tempV.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 80;
        const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight + (Math.random() - 0.5) * 60;

        star.style.left = `${x}px`;
        star.style.top = `${y}px`;
        parent.appendChild(star);
        setTimeout(() => star.remove(), 1000);
      }, i * 160);
    }
  }

  showPrompt(msg) {
    let toast = document.getElementById('game-feedback-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'game-feedback-toast';
      toast.className = 'game-feedback-toast hidden';
      document.body.appendChild(toast);
    }
    toast.innerHTML = msg;
    toast.classList.remove('hidden');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }

  setRole(role) {
    this.viewMode = role;
    const roleStatusText = document.getElementById('role-status-text');
    const viewTag = document.getElementById('view-tag');
    const headerAvatar = document.getElementById('header-avatar-icon');

    if (this.astronautVisualGroup) this.astronautVisualGroup.visible = (role === 'cat');
    if (this.readerVisualGroup) this.readerVisualGroup.visible = (role === 'human');

    if (role === 'cat') {
      if (roleStatusText) roleStatusText.textContent = '目前身分：登月太空人（太空探索視角）';
      if (viewTag) viewTag.textContent = '視角：登月太空人視角 (低重力漫步)';
      if (headerAvatar) headerAvatar.textContent = '🧑‍🚀';
    } else {
      if (roleStatusText) roleStatusText.textContent = '目前身分：好奇小讀者（小小天文探險家）';
      if (viewTag) viewTag.textContent = '視角：好奇小讀者視角 (小小天文探險家)';
      if (headerAvatar) headerAvatar.textContent = '🧢🧒';
    }
  }

  toggleView() {
    const nextRole = this.viewMode === 'human' ? 'cat' : 'human';
    this.setRole(nextRole);
    if (window.soundSystem) window.soundSystem.playClick();
  }

  /* ==========================================================================
     8 大課文與語文百寶箱 3D 互動站點面板
     ========================================================================== */
  initFurnitureData() {
    this.FURNITURE_DATA = {
      newspaper: {
        icon: '📰',
        title: '《○○日報》NASA 登月計畫報導',
        tag: '課本第59頁・第一段與讀報重點',
        desc: '<b>《○○日報》中華民國112年4月24日</b><br>美國國家航空暨太空總署（NASA）公布繞月飛行計畫「阿提米絲二號」四名成員（含一名女性和非裔男性）。自1970年代後，五十多年來人類未再踏上月球。「阿提米絲計畫」預計在2027年將包含首位女性在內的太空人送上月球，展開科學研究、探索稀有資源，並做為人類進軍火星的前置作業！',
        actions: [
          {
            icon: '📖',
            label: '細讀「阿提米絲計畫」新聞報導',
            badge: '讀報統整',
            run: () => {
              if (window.voiceSystem) window.voiceSystem.speak('newspaper');
              this.showPrompt('📰 已讀完《○○日報》登月報導：預計2027年將首位女性送上月球，並做為進軍火星前置作業！');
            }
          },
          {
            icon: '📝',
            label: '挑戰第一幕：圖書館登月新知題目',
            badge: '前往第1站',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.enterStation(1);
                window.curriculumSystem.promptInteract();
              }
            }
          }
        ]
      },
      craters: {
        icon: '☄️',
        title: '四十五億歲月球隕石坑觀測區',
        tag: '課文第二段・科學說明',
        desc: '課文第二段：「月球已經四十五億歲了。由於表面不像地球有水和大氣保護，每天會受到無數的隕石撞擊，因而到處都是坑洞。」這是以條理呈現客觀事實的「說明」寫作方式。',
        actions: [
          {
            icon: '☄️',
            label: '模擬無大氣保護下的隕石撞擊',
            badge: '科學模擬',
            run: () => this.playWand()
          },
          {
            icon: '📝',
            label: '挑戰第 3 站：〈隕石撞擊的坑洞〉',
            badge: '前往第3站',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.enterStation(3);
                window.curriculumSystem.promptInteract();
              }
            }
          }
        ]
      },
      lantern: {
        icon: '🐇',
        title: '陽光斜射黑影與「玉兔搗藥」台',
        tag: '課文第二段・科學事實與古人想像',
        desc: '課文第二段：「這些高低不平的坑洞，在陽光的照射下，人們會看到月球表面有各種形狀的黑影。我想這也許是古人想像出『玉兔搗藥』的原因。」',
        actions: [
          {
            icon: '🌕',
            label: '調整陽光角度觀察坑洞黑影變化',
            badge: '玉兔搗藥',
            run: () => {
              if (window.soundSystem) window.soundSystem.playJadeRabbitChime();
              if (window.voiceSystem) window.voiceSystem.speak('rabbit');
              this.showPrompt('🐇 陽光照射在高低不平的坑洞上，黑影輪廓看起來就像玉兔在搗藥呢！');
            }
          },
          {
            icon: '📝',
            label: '挑戰第 4 站：〈光影與玉兔搗藥〉',
            badge: '前往第4站',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.enterStation(4);
                window.curriculumSystem.promptInteract();
              }
            }
          }
        ]
      },
      telescope: {
        icon: '🔭',
        title: '地月距離高倍數天文望遠鏡',
        tag: '課文第三段・36萬～40萬公里',
        desc: '課文第三段：「此外，月球距離地球最近三十六萬公里，最遠四十萬公里。以平均三十八萬公里計算……」',
        actions: [
          {
            icon: '🔭',
            label: '觀測近地點(36萬)與遠地點(40萬公里)',
            badge: '天文數據',
            run: () => {
              if (window.voiceSystem) window.voiceSystem.speak('distance');
              this.showPrompt('🔭 觀測成功：月球距離地球最近36萬公里、最遠40萬公里，平均38萬公里！');
            }
          },
          {
            icon: '📝',
            label: '挑戰第 5 站：〈遙遠的地月距離〉',
            badge: '前往第5站',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.enterStation(5);
                window.curriculumSystem.promptInteract();
              }
            }
          }
        ]
      },
      transport: {
        icon: '✈️',
        title: '地月交通比一比（飛機 vs 單車）',
        tag: '課文第三段＆句型「就算……也……」',
        desc: '以平均三十八萬公里計算：<b>就算</b>搭飛機去月球，<b>也</b>要花上半個月；假如騎單車的話，則要騎三年！課文使用「就算……也……」假設情況來強調距離非常遙遠。',
        actions: [
          {
            icon: '✈️',
            label: '啟動飛機(半個月)與單車(三年)模擬',
            badge: '動態比較',
            run: () => {
              if (window.soundSystem) window.soundSystem.playSuccess();
              this.showPrompt('✈️ 就算搭飛機去月球也要花上半個月；🚲 假如騎單車則要騎整整三年！');
            }
          },
          {
            icon: '📝',
            label: '挑戰第 6 站：〈飛機與單車的旅程〉',
            badge: '前往第6站',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.enterStation(6);
                window.curriculumSystem.promptInteract();
              }
            }
          }
        ]
      },
      apollo: {
        icon: '🚀',
        title: '阿波羅登月艇與自然科學老師',
        tag: '課文第三段・阿姆斯壯登月趣聞',
        desc: '自然科學老師分享：「當年的阿波羅計畫中，阿姆斯壯登月時，管制中心曾經開玩笑要他找找看，有沒有一位漂亮的姑娘帶著一隻兔子呢！」',
        actions: [
          {
            icon: '👨‍🏫',
            label: '聽自然科學老師講阿波羅登月趣聞',
            badge: '語音導覽',
            run: () => this.petCatHead()
          },
          {
            icon: '📝',
            label: '挑戰第 8 站：〈阿波羅登月趣聞〉',
            badge: '前往第8站',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.enterStation(8);
                window.curriculumSystem.promptInteract();
              }
            }
          }
        ]
      },
      mooncake: {
        icon: '🥮',
        title: '中秋月夜賞月月餅茶席',
        tag: '課文第四段・又遠又近的月亮',
        desc: '課文第四段：「回家時，我想到不久前剛過中秋節，大家邊吃月餅邊聊著月亮……科學的月球距離地球那麼遠，文學的月亮則好像近在身邊。月亮這樣又遠又近，真是奇妙哇！」',
        actions: [
          {
            icon: '🥮',
            label: '品嚐中秋月餅並仰望滿月',
            badge: '恢復體力 100 HP',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.G.hp = 100;
                window.curriculumSystem.updateHUD();
              }
              this.feedCat();
            }
          },
          {
            icon: '📝',
            label: '挑戰第 9 站：〈中秋月餅與月球真相〉',
            badge: '前往第9站',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.enterStation(9);
                window.curriculumSystem.promptInteract();
              }
            }
          }
        ]
      },
      treasure: {
        icon: '💎',
        title: '語文百寶箱（辨字・句型・寫作）',
        tag: '課本第64～67頁統整',
        desc: '• <b>我會辨字</b>：「呂」（鋁罐、經營）用撇連接兩口；「𠯑」（管理、圖書館）第一筆是豎。<br>• <b>音同義不同</b>：手部「拒」（拒絕）vs 足部「距」（距離）。<br>• <b>記敘與說明</b>：記敘表達想法和行動；說明有條理呈現客觀事實。',
        actions: [
          {
            icon: '✨',
            label: '複習「呂／𠯑」與「拒／距」辨字秘訣',
            badge: '字詞滿分',
            run: () => {
              if (window.soundSystem) window.soundSystem.playSuccess();
              this.showPrompt('💎 辨字口訣：館管首筆是直豎，鋁營雙口一撇連；手拒門外足距離！');
            }
          },
          {
            icon: '📝',
            label: '挑戰第 10 站：〈科學與文學的月亮〉',
            badge: '前往第10站',
            run: () => {
              if (window.curriculumSystem) {
                window.curriculumSystem.enterStation(10);
                window.curriculumSystem.promptInteract();
              }
            }
          }
        ]
      },
      bookshelf: {
        icon: '📚',
        title: '3D 生字與語詞書櫃（18字・3大闖關）',
        tag: '課本第64～67頁・第五幕生字語詞總複習',
        desc: '這座生字與語詞書櫃收錄了第六課全部 <b>15 個習寫生字</b>（館、億、隕、撞、擊、坑、射、狀、距、萬、里、均、騎、餅、揭）與 <b>3 個認讀字</b>（搗、嫦、娥），並設有【字音大挑戰】【字形與部首】【語詞與句型應用】三大闖關站！',
        actions: [
          {
            icon: '🃏',
            label: '打開 18 個生字互動學習卡與有聲朗讀',
            badge: '生字寶典',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.openVocabModal('chars');
            }
          },
          {
            icon: '🔊',
            label: '挑戰第 11 站：〈生字書櫃：字音大挑戰〉',
            badge: '前往第11站',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.startVocabStation(11);
            }
          },
          {
            icon: '🔍',
            label: '挑戰第 12 站：〈生字書櫃：字形與部首〉',
            badge: '前往第12站',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.startVocabStation(12);
            }
          },
          {
            icon: '💬',
            label: '挑戰第 13 站：〈生字書櫃：語詞與句型應用〉',
            badge: '前往第13站',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.startVocabStation(13);
            }
          }
        ]
      },
      chest_sound: {
        icon: '🔊',
        title: '【月球神秘寶箱：字音晶片】',
        tag: '月球基地起點・生字第 11 站',
        desc: '寶箱中放著「金光字音晶片」！挑戰本課「隕（ㄩㄣˇ）石」、「玉兔搗（ㄉㄠˇ）藥」、「揭（ㄐㄧㄝ）開真相」、「撞擊（ㄓㄨㄤˋ ㄐㄧˊ）」、「嫦娥（ㄔㄤˊ ㄜˊ）」讀音，喚醒晶片能量！',
        actions: [
          {
            icon: '🚀',
            label: '挑戰第 11 站：〈字音大挑戰〉',
            badge: '前往作答',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.startVocabStation(11);
            }
          },
          {
            icon: '🃏',
            label: '查看 18 個生字卡片與注音',
            badge: '生字寶典',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.openVocabModal('chars');
            }
          }
        ]
      },
      chest_meteor: {
        icon: '☄️',
        title: '【天降隕石神秘碎片】',
        tag: '隕石坑地質驚喜・免答題直接獲得',
        desc: '<b>鏘！寶箱自動開啟！</b><br>你在月球隕石坑底挖掘出一顆「真實 1999 RQ36 小行星隕石玄武岩碎片」！<br><br>💡 <b>月球科學冷知識</b>：月球因為沒有水和大氣層保護，四十五億年來遭到大量流星體撞擊，形成了深淺不一的坑洞！<br><br>❤️ <b>體力大恢復</b>：成功採集隕石樣本，體力 +25 HP！',
        actions: [
          {
            icon: '✨',
            label: '收下小行星隕石碎片（體力 +25 HP）',
            badge: '地質採集',
            run: () => {
              if (window.soundSystem) window.soundSystem.playMeteorImpact();
              this.showPrompt('☄️ 小行星玄武岩碎片已收入太空背包！');
            }
          }
        ]
      },
      chest_shape: {
        icon: '✍️',
        title: '【月球神秘寶箱：字形與部首】',
        tag: '天文望遠鏡台・生字第 12 站',
        desc: '這只天藍色寶箱裡放著「部首拆解放大鏡」！挑戰課本 15 個生字的部首與筆畫易錯點（「隕（阜部）」、「萬（禸部）」、「狀（犬部）」、「館/管」直豎 vs「鋁/營」撇連），獲得漢字解構達人徽章！',
        actions: [
          {
            icon: '🚀',
            label: '挑戰第 12 站：〈字形與部首〉',
            badge: '前往作答',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.startVocabStation(12);
            }
          },
          {
            icon: '🔍',
            label: '查看 4 大形近與多音字辨析',
            badge: '易錯辨析',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.openVocabModal('compare');
            }
          }
        ]
      },
      chest_jump: {
        icon: '🚀',
        title: '【阿波羅 11 號太空任務寶箱】',
        tag: '登月艇基地・月球低重力挑戰小任務',
        desc: '<b>嗶嗶嗶！宇航通訊器響起！</b><br>阿波羅太空人向你發送「月球低重力 3 次大漫步」任務！月球重力只有地球的 1/6，請按下【跳躍按鈕】或【空白鍵】在月面上完成 3 次輕盈跳躍！',
        actions: [
          {
            icon: '🦘',
            label: '開始 3 次低重力跳躍任務！',
            badge: '接受任務',
            run: () => {
              this.activeChestTask = 'jump';
              this.jumpTaskCount = 0;
              this.showPrompt('🚀 任務開始！請在月球表面跳躍 3 次！');
            }
          }
        ]
      },
      chest_mooncake: {
        icon: '🥮',
        title: '【中秋文學月餅與詩詞補給箱】',
        tag: '中秋賞月星空台・文學能量補給',
        desc: '<b>哇！開箱飄出陣陣蓮蓉香氣！</b><br>寶箱裡放著一盤剛出爐的金黃冰皮雙黃月餅與一張李白《靜夜思》星光詩籤！<br><br>🌕 <b>詩仙李白說</b>：「床前明月光，疑是地上霜。舉頭望明月，低頭思故鄉。」文學裡的月亮撫慰了無數遊子的心！<br><br>✨ <b>能量全滿</b>：享用美味月餅，體力瞬間恢復至 100 HP！',
        actions: [
          {
            icon: '🥮',
            label: '享用金黃月餅（體力瞬間全滿 100 HP）',
            badge: '能量大補給',
            run: () => {
              if (window.soundSystem) window.soundSystem.playJadeRabbitChime();
              if (window.curriculumSystem) {
                window.curriculumSystem.G.hp = 100;
                window.curriculumSystem.updateHUD();
              }
              this.showPrompt('🥮 享用美味月餅，體力完全恢復！');
            }
          }
        ]
      },
      chest_phrase: {
        icon: '🌟',
        title: '【月球神秘寶箱：語詞與句型】',
        tag: '星空高台・生字第 13 站',
        desc: '翡翠綠色的星光寶箱裡閃耀著「語文百寶箱水晶」！挑戰「就算……也……」假設強調句型、閱讀寫作手法與易錯字挑錯，完成全課生字語詞大滿貫！',
        actions: [
          {
            icon: '🚀',
            label: '挑戰第 13 站：〈語詞與句型應用〉',
            badge: '前往作答',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.startVocabStation(13);
            }
          },
          {
            icon: '💬',
            label: '查看四字語詞與成語庫',
            badge: '詞庫寶典',
            run: () => {
              if (window.curriculumSystem) window.curriculumSystem.openVocabModal('phrases');
            }
          }
        ]
      }
    };
  }

  openFurnitureModal(id) {
    const data = this.FURNITURE_DATA ? this.FURNITURE_DATA[id] : null;
    if (!data) return;

    const modal = document.getElementById('furniture-modal');
    if (!modal) return;

    const iconEl = document.getElementById('furn-icon');
    const tagEl = document.getElementById('furn-tag');
    const titleEl = document.getElementById('furn-title');
    const descEl = document.getElementById('furn-desc');
    const actionsEl = document.getElementById('furn-actions');

    if (iconEl) iconEl.textContent = data.icon;
    if (tagEl) tagEl.textContent = data.tag;
    if (titleEl) titleEl.textContent = data.title;
    if (descEl) descEl.innerHTML = data.desc;

    if (actionsEl) {
      actionsEl.innerHTML = '';
      data.actions.forEach((act) => {
        const btn = document.createElement('button');
        btn.className = 'furn-action-btn';
        btn.innerHTML = `
          <div class="btn-left">
            <span style="font-size:22px;">${act.icon}</span>
            <span>${act.label}</span>
          </div>
          <span class="btn-badge">${act.badge || '立即探索'}</span>
        `;
        btn.onclick = () => {
          this.closeFurnitureModal();
          act.run();
          if (window.soundSystem) window.soundSystem.playClick();
        };
        actionsEl.appendChild(btn);
      });
    }

    modal.classList.add('active');
    if (window.soundSystem) window.soundSystem.playClick();
  }

  closeFurnitureModal() {
    const modal = document.getElementById('furniture-modal');
    if (modal) modal.classList.remove('active');
  }

  setupRaycasterClicks() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let pointerDownTime = 0;

    const onPointerDown = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      const clientY = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);
      pointerDownPos = { x: clientX, y: clientY };
      pointerDownTime = performance.now();
    };

    const onPointerUp = (e) => {
      const clientX = e.clientX || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0);
      const clientY = e.clientY || (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientY : 0);
      const dist = Math.hypot(clientX - pointerDownPos.x, clientY - pointerDownPos.y);
      const timeDiff = performance.now() - pointerDownTime;

      if (dist < 14 && timeDiff < 450) {
        if (e.target && (e.target.closest('button') || e.target.closest('.modal-card') || e.target.closest('#pad') || e.target.closest('.top-bar') || e.target.closest('.action-dock'))) {
          return;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, this.camera);

        const clickableTargets = [
          this.libraryGroup,
          this.craterGroup,
          this.lanternGroup,
          this.telescopeGroup,
          this.transportGroup,
          this.apolloGroup,
          this.mooncakeGroup,
          this.treasureGroup,
          this.bookshelfGroup,
          ...(this.moonChests ? this.moonChests.map(c => c.group) : []),
          ...(this.glowingAuras ? this.glowingAuras.map(a => a.group) : [])
        ].filter(Boolean);

        const intersects = raycaster.intersectObjects(clickableTargets, true);
        if (intersects.length > 0) {
          let curr = intersects[0].object;
          let foundId = null;
          while (curr && curr !== this.scene) {
            if (curr.userData && curr.userData.id) {
              foundId = curr.userData.id;
              break;
            }
            curr = curr.parent;
          }
          if (foundId) {
            if (foundId.startsWith('chest_')) {
              this.openMoonChest(foundId);
            } else {
              this.openFurnitureModal(foundId);
            }
          }
        }
      }
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
  }

  setupFloatingMarkers() {
    this.interactiveSpots = [
      {
        id: 'newspaper',
        name: '《○○日報》展架 (探索)',
        icon: '📰',
        pos: new THREE.Vector3(-2.6, 0.8, -2.3),
        action: () => this.openFurnitureModal('newspaper')
      },
      {
        id: 'craters',
        name: '隕石撞擊坑洞 (探索)',
        icon: '☄️',
        pos: new THREE.Vector3(2.8, 0.5, -2.4),
        action: () => this.openFurnitureModal('craters')
      },
      {
        id: 'lantern',
        name: '玉兔搗藥光影 (探索)',
        icon: '🐇',
        pos: new THREE.Vector3(3.5, 0.7, 0.2),
        action: () => this.openFurnitureModal('lantern')
      },
      {
        id: 'telescope',
        name: '地月距離望遠鏡 (探索)',
        icon: '🔭',
        pos: new THREE.Vector3(-0.2, 0.9, -3.1),
        action: () => this.openFurnitureModal('telescope')
      },
      {
        id: 'transport',
        name: '飛機vs單車展台 (探索)',
        icon: '✈️',
        pos: new THREE.Vector3(-3.1, 0.7, 0.4),
        action: () => this.openFurnitureModal('transport')
      },
      {
        id: 'apollo',
        name: '阿波羅登月艇 (探索)',
        icon: '🚀',
        pos: new THREE.Vector3(2.9, 0.8, 2.2),
        action: () => this.openFurnitureModal('apollo')
      },
      {
        id: 'mooncake',
        name: '中秋月餅茶席 (探索)',
        icon: '🥮',
        pos: new THREE.Vector3(-0.4, 0.7, 1.65),
        action: () => this.openFurnitureModal('mooncake')
      },
      {
        id: 'treasure',
        name: '語文百寶箱 (探索)',
        icon: '💎',
        pos: new THREE.Vector3(-3.1, 0.7, 2.2),
        action: () => this.openFurnitureModal('treasure')
      },
      {
        id: 'bookshelf',
        name: '生字與語詞書櫃 (探索)',
        icon: '📚',
        pos: new THREE.Vector3(0, 0.85, 3.45),
        action: () => {
          if (window.curriculumSystem) {
            window.curriculumSystem.openVocabModal('levels');
          } else {
            this.openFurnitureModal('bookshelf');
          }
        }
      },
      {
        id: 'chest_sound',
        name: '神秘寶箱：字音晶片 🎁',
        icon: '🔊',
        pos: new THREE.Vector3(-1.85, 0.5, 2.75),
        action: () => this.openMoonChest('chest_sound')
      },
      {
        id: 'chest_meteor',
        name: '神秘寶箱：小行星隕石 ☄️',
        icon: '☄️',
        pos: new THREE.Vector3(2.85, 0.5, -2.75),
        action: () => this.openMoonChest('chest_meteor')
      },
      {
        id: 'chest_shape',
        name: '神秘寶箱：字形與部首 ✍️',
        icon: '✍️',
        pos: new THREE.Vector3(-3.25, 0.5, -1.2),
        action: () => this.openMoonChest('chest_shape')
      },
      {
        id: 'chest_jump',
        name: '神秘寶箱：低重力跳躍任務 🚀',
        icon: '🚀',
        pos: new THREE.Vector3(3.2, 0.5, 1.85),
        action: () => this.openMoonChest('chest_jump')
      },
      {
        id: 'chest_mooncake',
        name: '神秘寶箱：中秋文學補給 🥮',
        icon: '🥮',
        pos: new THREE.Vector3(1.65, 0.5, 3.2),
        action: () => this.openMoonChest('chest_mooncake')
      },
      {
        id: 'chest_phrase',
        name: '神秘寶箱：語詞與句型 🌟',
        icon: '🌟',
        pos: new THREE.Vector3(-0.45, 0.5, -3.45),
        action: () => this.openMoonChest('chest_phrase')
      }
    ];

    const uiContainer = document.getElementById('ui-overlay');
    this.glowingAuras = [];

    this.spotElements = this.interactiveSpots.map((spot, idx) => {
      const auraGroup = new THREE.Group();
      auraGroup.position.copy(spot.pos);
      auraGroup.userData = { id: spot.id, name: spot.name };

      const ringGeo = new THREE.RingGeometry(0.24, 0.38, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.02 - spot.pos.y;
      ringMesh.userData = { id: spot.id };
      auraGroup.add(ringMesh);

      const crystalGeo = new THREE.OctahedronGeometry(0.11, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.3
      });
      const crystalMesh = new THREE.Mesh(crystalGeo, crystalMat);
      crystalMesh.position.y = 0.25;
      crystalMesh.userData = { id: spot.id };
      auraGroup.add(crystalMesh);

      this.scene.add(auraGroup);
      this.glowingAuras.push({
        group: auraGroup,
        ring: ringMesh,
        crystal: crystalMesh,
        baseY: 0.25,
        phase: idx * 1.1
      });

      const bubble = document.createElement('div');
      bubble.className = 'interact-bubble';
      bubble.innerHTML = `<span>${spot.icon}</span> <span>${spot.name}</span>`;
      bubble.addEventListener('click', (e) => {
        e.stopPropagation();
        spot.action();
      });
      uiContainer.appendChild(bubble);

      return { spot, bubble, aura: auraGroup };
    });

    // 關卡專屬導引光柱 (Quest Beacon)
    this.questBeacon = new THREE.Group();
    const qRingGeo = new THREE.RingGeometry(0.32, 0.52, 36);
    const qRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });
    this.questBeaconRing = new THREE.Mesh(qRingGeo, qRingMat);
    this.questBeaconRing.rotation.x = -Math.PI / 2;
    this.questBeaconRing.position.y = 0.03;
    this.questBeacon.add(this.questBeaconRing);

    const qBeamGeo = new THREE.CylinderGeometry(0.22, 0.36, 1.8, 24, 1, true);
    const qBeamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.28,
      depthWrite: false
    });
    this.questBeaconBeam = new THREE.Mesh(qBeamGeo, qBeamMat);
    this.questBeaconBeam.position.y = 0.9;
    this.questBeacon.add(this.questBeaconBeam);

    const qStarGeo = new THREE.OctahedronGeometry(0.20, 0);
    const qStarMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2
    });
    this.questBeaconStar = new THREE.Mesh(qStarGeo, qStarMat);
    this.questBeaconStar.position.y = 0.55;
    this.questBeacon.add(this.questBeaconStar);

    this.scene.add(this.questBeacon);
  }

  interactWithNearby() {
    if (this.nearbySpot) {
      this.nearbySpot.action();
      if (window.soundSystem) window.soundSystem.playClick();
    }
  }

  interactNearbyOrOpenModal() {
    if (this.activeNearbySpot) {
      this.openFurnitureModal(this.activeNearbySpot.id);
    } else {
      this.openFurnitureModal('newspaper');
    }
    if (window.soundSystem) window.soundSystem.playClick();
  }

  /* ==========================================================================
     主循環、移動與防穿透
     ========================================================================== */
  resolveCollision(nextPos) {
    const res = nextPos.clone();
    res.x = Math.max(-4.5, Math.min(4.5, res.x));
    res.z = Math.max(-4.2, Math.min(4.2, res.z));
    return res;
  }

  update(delta, time) {
    this.updateControlledAvatar(delta, time);
    this.updateSceneAnimations(time);
    this.updateCamera();
    this.updateMarkers();
    this.updateShadows();
  }

  updateControlledAvatar(delta, time) {
    let inputForward = 0;
    let inputRight = 0;

    if (this.keys['w'] || this.keys['arrowup']) inputForward += 1;
    if (this.keys['s'] || this.keys['arrowdown']) inputForward -= 1;
    if (this.keys['d'] || this.keys['arrowright']) inputRight += 1;
    if (this.keys['a'] || this.keys['arrowleft']) inputRight -= 1;

    const joy = (window.__bird && window.__bird.JOY) ? window.__bird.JOY : { x: 0, y: 0 };
    if (joy.x !== 0 || joy.y !== 0) {
      inputRight += joy.x;
      inputForward -= joy.y;
    }

    const inputLen = Math.hypot(inputRight, inputForward);
    const isMoving = inputLen > 0.01;
    this.isCatMoving = isMoving;

    if (isMoving) {
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);

      const worldX = inputForward * forwardX + inputRight * rightX;
      const worldZ = inputForward * forwardZ + inputRight * rightZ;
      const normDir = new THREE.Vector3(worldX, 0, worldZ).normalize();

      const analogScale = Math.min(1.0, inputLen);
      const currentSpeed = this.catSpeed * analogScale;

      const nextPos = this.catPos.clone();
      nextPos.x += normDir.x * currentSpeed * delta;
      nextPos.z += normDir.z * currentSpeed * delta;

      const resolved = this.resolveCollision(nextPos);
      this.catPos.x = resolved.x;
      this.catPos.z = resolved.z;

      if (this.cat) {
        this.cat.position.x = resolved.x;
        this.cat.position.z = resolved.z;
        this.cat.rotation.y = Math.atan2(normDir.x, normDir.z);
      }

      if (this.catLegs && this.catLegs.length === 4) {
        const walkCycle = Math.sin(time * 12);
        this.catLegs[0].rotation.x = walkCycle * 0.45;
        this.catLegs[1].rotation.x = -walkCycle * 0.45;
        this.catLegs[2].rotation.x = -walkCycle * 0.35;
        this.catLegs[3].rotation.x = walkCycle * 0.35;
      }

      // 真實 3D 太空人模型低重力漫步彈跳與傾角動畫
      if (this.astronautGLB) {
        this.astronautGLB.position.y = Math.abs(Math.sin(time * 9.5)) * 0.065;
        this.astronautGLB.rotation.z = Math.sin(time * 9.5) * 0.055;
        this.astronautGLB.rotation.x = 0.07;
      }
    } else {
      if (this.catLegs) {
        this.catLegs.forEach(l => { l.rotation.x = 0; });
      }
      if (this.astronautGLB) {
        this.astronautGLB.position.y = Math.sin(time * 2.2) * 0.015;
        this.astronautGLB.rotation.z = 0;
        this.astronautGLB.rotation.x = 0;
      }
    }

    // 更新小小天文探險家 3D 肢體與動畫 (Walk / Idle)
    if (this.readerNodes) {
      if (isMoving) {
        const walkCycle = Math.sin(time * 12);
        if (this.readerNodes.legL) this.readerNodes.legL.rotation.x = walkCycle * 0.55;
        if (this.readerNodes.legR) this.readerNodes.legR.rotation.x = -walkCycle * 0.55;
        if (this.readerNodes.armL) this.readerNodes.armL.rotation.x = -walkCycle * 0.45;
        if (this.readerNodes.armR) this.readerNodes.armR.rotation.x = walkCycle * 0.45;
        if (this.readerNodes.head) this.readerNodes.head.rotation.y = Math.sin(time * 6) * 0.08;
        if (this.readerNodes.bag) this.readerNodes.bag.position.y = 0.02 + Math.abs(Math.sin(time * 12)) * 0.025;
        if (this.readerNodes.scope) this.readerNodes.scope.rotation.z = 0.3 + Math.sin(time * 12) * 0.08;
      } else {
        if (this.readerNodes.legL) this.readerNodes.legL.rotation.x = 0;
        if (this.readerNodes.legR) this.readerNodes.legR.rotation.x = 0;
        if (this.readerNodes.armL) this.readerNodes.armL.rotation.x = Math.sin(time * 2.5) * 0.05;
        if (this.readerNodes.armR) this.readerNodes.armR.rotation.x = -Math.sin(time * 2.5) * 0.05;
        if (this.readerNodes.head) {
          this.readerNodes.head.rotation.y = Math.sin(time * 1.5) * 0.22; // 好奇左右張望
          this.readerNodes.head.rotation.x = Math.sin(time * 2.0) * 0.06; // 仰望星空
        }
        if (this.readerNodes.bag) this.readerNodes.bag.position.y = 0.02;
        if (this.readerNodes.scope) this.readerNodes.scope.rotation.z = 0.3;
      }
    }

    if (this.readerMixer) {
      const targetAnim = isMoving ? 'Walk' : 'Idle';
      if (this.activeReaderAction !== targetAnim && this.readerActions && this.readerActions[targetAnim]) {
        const prev = this.readerActions[this.activeReaderAction];
        const next = this.readerActions[targetAnim];
        if (prev) prev.fadeOut(0.2);
        next.reset().fadeIn(0.2).play();
        this.activeReaderAction = targetAnim;
      }
      this.readerMixer.update(delta);
    }

    // 月球低重力垂直物理
    if (!this.catIsGrounded || this.catPos.y > 0) {
      this.catPos.y += this.catVelocityY * delta;
      this.catVelocityY -= 6.5 * delta; // 月球低重力緩降
      if (this.catPos.y <= 0) {
        this.catPos.y = 0;
        this.catVelocityY = 0;
        this.catIsGrounded = true;
      }
      if (this.cat) this.cat.position.y = this.catPos.y;
    }
  }

  updateSceneAnimations(time) {
    // 1. 巨型月球緩慢自轉
    if (this.skyMoon) {
      this.skyMoon.rotation.y = time * 0.08;
    }

    // 2. 隕石墜落循環動畫（展示月球無大氣保護，每天受隕石撞擊）
    if (this.fallingMeteor) {
      const cycle = (time * 0.85) % 1;
      this.fallingMeteor.position.y = 3.2 * (1 - cycle) + 0.15;
      this.fallingMeteor.position.x = 2.8 + (1 - cycle) * 0.6;
      this.fallingMeteor.rotation.x = time * 4;
      this.fallingMeteor.rotation.z = time * 3;
    }

    // 3. 飛機（快：半個月）與單車（慢：三年）繞行對比動畫
    if (this.planeModel) {
      this.planeModel.position.y = 1.15 + Math.sin(time * 4) * 0.08;
      this.planeModel.rotation.y = Math.sin(time * 1.5) * 0.25;
    }

    // 4. 自然科學老師與地球儀動態效果
    if (this.playerNodes && this.playerNodes.armR) {
      this.playerNodes.armR.rotation.z = -0.35 + Math.sin(time * 3) * 0.15;
    }
    if (this.teacherGLB) {
      this.teacherGLB.rotation.y = Math.sin(time * 1.4) * 0.12;
      this.teacherGLB.position.y = Math.sin(time * 2.6) * 0.012;
    }
    if (this.libraryGlobe) {
      this.libraryGlobe.rotation.y = time * 0.45;
    }

    // 5. 月球 6 大神秘寶箱頂部能量晶石旋轉與光環微動
    if (this.moonChests) {
      this.moonChests.forEach((mc, idx) => {
        if (mc.gem) {
          mc.gem.rotation.y = time * 2.2 + idx * 0.8;
          mc.gem.position.y = 0.58 + Math.sin(time * 3.0 + idx) * 0.045;
        }
        if (mc.ring) {
          mc.ring.scale.setScalar(1.0 + Math.sin(time * 2.5 + idx) * 0.06);
        }
      });
    }
  }

  updateCamera() {
    const targetPos = this.catPos;
    const targetY = this.viewMode === 'human' ? 1.15 : 0.75;
    const dist = this.viewMode === 'human' ? this.cameraDistance : Math.min(3.4, this.cameraDistance * 0.85);

    const camX = targetPos.x + dist * Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
    const camY = Math.max(0.35, targetPos.y + targetY + dist * Math.sin(this.cameraPitch));
    const camZ = targetPos.z + dist * Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);

    this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.15);
    this.camera.lookAt(targetPos.x, targetPos.y + targetY, targetPos.z);

    // 若相機位於南側生字書櫃後方 (z > 3.25 且 x 在書櫃範圍內)，自動透明化防遮擋視線
    if (this.bookshelfMaterials) {
      const isBehindShelf = (this.camera.position.z > 3.25 && Math.abs(this.camera.position.x) < 2.2);
      const targetOpacity = isBehindShelf ? 0.08 : 1.0;
      this.bookshelfMaterials.forEach(mat => {
        mat.opacity += (targetOpacity - mat.opacity) * 0.25;
        mat.depthWrite = mat.opacity > 0.5;
      });
    }
  }

  updateShadows() {
    if (this.catShadow && this.cat) {
      this.catShadow.position.x = this.catPos.x;
      this.catShadow.position.z = this.catPos.z;
      this.catShadow.position.y = 0.004;
    }
    if (this.playerShadow && this.player) {
      this.playerShadow.position.x = this.playerPos.x;
      this.playerShadow.position.z = this.playerPos.z;
      this.playerShadow.position.y = 0.004;
    }
  }

  updateMarkers() {
    const tempV = new THREE.Vector3();
    let closestDist = Infinity;
    let closestSpot = null;

    const currentHeroPos = this.catPos;
    const time = this.clock ? this.clock.getElapsedTime() : performance.now() * 0.001;

    if (this.glowingAuras) {
      this.glowingAuras.forEach((aura, i) => {
        const spot = this.interactiveSpots[i];
        if (!spot) return;
        const distXZ = Math.hypot(currentHeroPos.x - spot.pos.x, currentHeroPos.z - spot.pos.z);
        const isNear = distXZ < 1.75;

        aura.crystal.rotation.y = time * 2.2 + aura.phase;
        aura.crystal.position.y = aura.baseY + Math.sin(time * 3.5 + aura.phase) * 0.06;

        const ringScale = isNear
          ? 1.25 + Math.sin(time * 5 + aura.phase) * 0.15
          : 1.0 + Math.sin(time * 2.5 + aura.phase) * 0.1;
        aura.ring.scale.set(ringScale, ringScale, 1);
      });
    }

    this.spotElements.forEach(({ spot }) => {
      const distXZ = Math.hypot(currentHeroPos.x - spot.pos.x, currentHeroPos.z - spot.pos.z);
      if (distXZ < 1.75 && distXZ < closestDist) {
        closestDist = distXZ;
        closestSpot = spot;
      }
    });

    this.nearbySpot = closestSpot;

    this.spotElements.forEach(({ spot, bubble }) => {
      if (closestSpot && spot.id === closestSpot.id && closestDist < 1.75) {
        tempV.copy(spot.pos);
        tempV.y += 0.45;
        tempV.project(this.camera);

        if (tempV.z < 1) {
          const x = (tempV.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight;

          if (x >= 20 && x <= window.innerWidth - 20 && y >= 20 && y <= window.innerHeight - 30) {
            bubble.style.display = 'flex';
            bubble.style.left = `${x}px`;
            bubble.style.top = `${y}px`;
            bubble.classList.add('active');
            bubble.style.opacity = '1';
            return;
          }
        }
      }
      bubble.style.display = 'none';
      bubble.style.opacity = '0';
      bubble.classList.remove('active');
    });

    const dockBtn = document.getElementById('btn-sit-sofa');
    const dockIcon = document.getElementById('btn-sit-icon');
    const dockLabel = document.getElementById('btn-sit-label');

    if (closestSpot && closestDist < 1.75) {
      this.activeNearbySpot = closestSpot;
      if (dockBtn) dockBtn.classList.add('highlight-item-btn');
      if (dockIcon) dockIcon.textContent = closestSpot.icon;
      if (dockLabel) dockLabel.textContent = closestSpot.name.replace(' (探索)', '');
    } else {
      this.activeNearbySpot = null;
      if (dockBtn) dockBtn.classList.remove('highlight-item-btn');
      if (dockIcon) dockIcon.textContent = '📰';
      if (dockLabel) dockLabel.textContent = '讀報探索';
    }

    const qMarker = document.getElementById('quest-3d-marker');
    const cs = window.curriculumSystem;
    if (cs && cs.ST && cs.ST[cs.G.station]) {
      const st = cs.ST[cs.G.station];
      const tPos = (typeof st.target === 'function') ? st.target() : new THREE.Vector3(0, 0.3, 0);

      if (this.questBeacon) {
        this.questBeacon.visible = (cs.G.mode === 'explore');
        this.questBeacon.position.set(tPos.x, 0, tPos.z);
        if (this.questBeaconStar) {
          this.questBeaconStar.rotation.y = time * 2.8;
          this.questBeaconStar.position.y = Math.max(0.45, tPos.y + 0.25) + Math.sin(time * 4) * 0.08;
        }
      }

      if (qMarker) {
        if (cs.G.mode === 'explore') {
          const mLbl = document.getElementById('quest-marker-label');
          if (mLbl) mLbl.innerText = `第${cs.G.station}站：${st.quest || st.name}（點此作答）`;

          tempV.set(tPos.x, Math.max(0.65, tPos.y + 0.55), tPos.z);
          tempV.project(this.camera);

          let sx = (tempV.x * 0.5 + 0.5) * window.innerWidth;
          let sy = (-tempV.y * 0.5 + 0.5) * window.innerHeight;
          if (tempV.z > 1) {
            sx = window.innerWidth - sx;
            sy = window.innerHeight - 105;
          }
          sx = Math.max(135, Math.min(window.innerWidth - 135, sx));
          sy = Math.max(105, Math.min(window.innerHeight - 96, sy));

          qMarker.style.display = 'inline-flex';
          qMarker.style.left = `${sx}px`;
          qMarker.style.top = `${sy}px`;

          const distToQuest = Math.hypot(currentHeroPos.x - tPos.x, currentHeroPos.z - tPos.z);
          if (distToQuest < 0.85 && this.isCatMoving && this._autoOpenedStation !== cs.G.station) {
            this._autoOpenedStation = cs.G.station;
            cs.promptInteract();
          } else if (distToQuest > 1.35 && this._autoOpenedStation === cs.G.station) {
            this._autoOpenedStation = -1;
          }
        } else {
          qMarker.style.display = 'none';
        }
      }
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();

    this.update(delta, time);
    this.renderer.render(this.scene, this.camera);
  }

  placeWorld(n) {
    this.catState = 'walk';
    this.catVelocityY = 0;
    this.catIsGrounded = true;

    if (n === 7) {
      // 站點 7：放置於 X = 1.85, Z = 1.8，朝向 -Z 方向有長達 5 米的無障礙星軌走道，供觸控測試量測精準類比位移
      this.catPos.set(1.85, 0, 1.8);
      this.cameraYaw = 0;
    } else if (n === 0 || n === 1) {
      this.catPos.set(-2.2, 0, -1.2);
      this.cameraYaw = 0;
    } else if (n === 2 || n === 3 || n === 4) {
      this.catPos.set(2.0, 0, -1.0);
      this.cameraYaw = 0;
    } else if (n === 5 || n === 6) {
      this.catPos.set(-1.5, 0, 0.2);
      this.cameraYaw = 0;
    } else if (n >= 11 && n <= 13) {
      // 第 11~13 站：生字與語詞書櫃前，將相機轉向正前方觀看書櫃 (cameraYaw = Math.PI)
      this.catPos.set((n - 12) * 0.7, 0, 2.75);
      this.cameraYaw = Math.PI;
    } else {
      this.catPos.set(0, 0, 0.9);
      this.cameraYaw = 0;
    }

    if (this.cat) {
      this.cat.position.copy(this.catPos);
      this.cat.rotation.y = 0;
    }
    if (window.curriculumSystem) {
      window.curriculumSystem.G.station = n;
      window.curriculumSystem.updateHUD();
    }
    if (window.__bird && window.__bird.P) {
      window.__bird.P.pos = this.catPos;
      window.__bird.P.yaw = this.cameraYaw;
    }
  }

  setEnv(name) {
    // 四幕光影預設平滑切換
    if (name === 'library') {
      // 第一幕：圖書館午後暖光
      this.scene.background = new THREE.Color(0x1e293b);
      this.scene.fog.color = new THREE.Color(0x1e293b);
      if (this.sunLight) this.sunLight.intensity = 1.3;
    } else if (name === 'lunar') {
      // 第二幕：四十五億歲深邃月球表面
      this.scene.background = new THREE.Color(0x090d16);
      this.scene.fog.color = new THREE.Color(0x090d16);
      if (this.sunLight) this.sunLight.intensity = 1.45;
    } else if (name === 'apollo') {
      // 第三幕：地月航道與阿波羅計畫
      this.scene.background = new THREE.Color(0x0f172a);
      this.scene.fog.color = new THREE.Color(0x0f172a);
      if (this.sunLight) this.sunLight.intensity = 1.25;
    } else if (name === 'midautumn') {
      // 第四幕：中秋月夜團圓金輝
      this.scene.background = new THREE.Color(0x172554);
      this.scene.fog.color = new THREE.Color(0x172554);
      if (this.sunLight) this.sunLight.intensity = 1.15;
    }
  }
}

window.game = new GameEngine();

// 導出 edu_3d_game_workflow 專屬除錯鉤子 window.__bird
window.__bird = {
  get G() { return window.curriculumSystem ? window.curriculumSystem.G : {}; },
  get P() {
    return {
      pos: (window.game && window.game.catPos) ? window.game.catPos : { x: 0, y: 0, z: 0 },
      get yaw() { return window.game ? window.game.cameraYaw : 0; },
      set yaw(v) { if (window.game) window.game.cameraYaw = v; }
    };
  },
  get K() { return window.game ? window.game.keys : {}; },
  get ST() { return window.ST || []; },
  JOY: { x: 0, y: 0 },
  showGameUI: () => {
    if (window.curriculumSystem) window.curriculumSystem.showGameUI();
    const pad = document.getElementById('pad');
    if (pad) pad.style.display = 'flex';
  },
  placeWorld: (n) => {
    if (window.game) window.game.placeWorld(n);
  },
  interact: () => {
    if (window.curriculumSystem) window.curriculumSystem.promptInteract();
  },
  updateHUD: () => {
    if (window.curriculumSystem) window.curriculumSystem.updateHUD();
  },
  setEnv: (name) => {
    if (window.game) window.game.setEnv(name);
  },
  enterStation: (n) => {
    if (window.curriculumSystem) window.curriculumSystem.enterStation(n);
  },
  hurt: (amt) => {
    if (window.curriculumSystem) window.curriculumSystem.hurt(amt);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  window.game.init();
});
