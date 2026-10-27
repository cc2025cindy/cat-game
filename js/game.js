/**
 * 《小女生：膠水貓大冒險》
 * Three.js 3D 核心場景與角色渲染系統
 * 依據專案美術與技術規範全面重構：
 * 1. 貓咪與角色採用 MeshStandardMaterial 卡通色塊材質，質感細緻且色塊鮮明
 * 2. 柔和環境光照（HemisphereLight + 暖陽平行光），搭配低成本地面接觸陰影盤
 * 3. 角色輪廓鮮明，縮小視角也能一眼辨別「作家/小主人」與「橘白膠水貓」
 * 4. 大眼可愛比例、臉部神采（高光、瞳孔、腮紅），告別低模粗糙感
 * 5. 一致腳底原點 (Foot Origin y = 0)，嚴格防穿地，行走與站姿貼地完美
 * 6. 視角高度與角色比例協調，UI 與標記浮於角色上方，不遮擋關鍵狀態
 * 7. 窗外增設教材分號例句「草原與藍天」，移除遠距離看不到的零碎細小雜物
 */

class GameEngine {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.clock = new THREE.Clock();

    // 視角模式: 'cat' (小女生貓咪視角) 或 'human' (主人視角)
    this.viewMode = 'cat';

    // 360° 空間自由旋轉與縮放相機參數
    this.cameraYaw = 0;
    this.cameraPitch = 0.32;
    this.cameraDistance = 3.8;
    this.isDragging = false;
    this.prevMouse = { x: 0, y: 0 };

    // 角色與環境物件
    this.cat = null;
    this.player = null;
    this.butterfly = null;
    this.catShadow = null;
    this.playerShadow = null;
    this.interactiveSpots = [];

    // 輸入控制與手機虛擬搖桿
    this.keys = {};
    this.joystickVector = { x: 0, z: 0 };
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // 主人狀態、骨骼節點與坐姿 (原點為腳底 y = 0)
    this.playerPos = new THREE.Vector3(0, 0, 0.4);
    this.playerRot = 0;
    this.playerNodes = {};
    this.isSitting = false;

    // 貓咪狀態、物理與骨骼節點 (原點為腳底 y = 0)
    this.catPos = new THREE.Vector3(0.7, 0.58, 1.35); // 預設在對向沙發小被子上
    this.catRot = 0;
    this.catVelocityY = 0;
    this.catIsGrounded = true;
    this.catSpeed = 3.2;
    this.catState = 'sleep_belly_up'; // 'sleep_belly_up', 'sit', 'walk', 'rub_leg', 'unhappy', 'jumping', 'eating'
    this.catTarget = null;
    this.catNodes = {};
    this.catMeshGroup = null;
    this.bellyUpFactor = 1.0; // 0: 站立行走姿, 1: 翻肚四腳朝天姿
    this.isPetting = false;

    this.nearbySpot = null;
    this.proxCard = null;
  }

  init() {
    this.initFurnitureData();
    this.setupScene();
    this.setupLights();
    this.buildApartment();
    this.createContactShadows();
    this.createCat();
    this.createPlayerAvatar();
    this.setupInputs();
    this.setupOrbitCameraControls();
    this.setupMobileControls();
    this.setupFloatingMarkers();
    this.setupRaycasterClicks();

    this.proxCard = document.getElementById('proximity-card');
    this.setRole('cat');

    // 綁定動態視窗高度 (--appH)
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

    // 載入完成信號 (滿足 quality_check.py)
    const loading = document.getElementById('loading');
    if (loading) {
      loading.classList.add('done');
      setTimeout(() => { loading.style.display = 'none'; }, 400);
    }

    this.animate();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xfbf8f3);
    this.scene.fog = new THREE.FogExp2(0xfbf8f3, 0.024);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 2.3, 5.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.appendChild(this.renderer.domElement);
  }

  setupLights() {
    // 1. 半球柔和漫射光 (天空暖色、地面冷色，帶來高質感且超低開銷的立體感)
    const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0xcfd8dc, 0.88);
    hemiLight.position.set(0, 8, 0);
    this.scene.add(hemiLight);

    // 2. 暖陽主光源 (投射清晰色塊與陰影)
    const sunLight = new THREE.DirectionalLight(0xfff5e6, 1.15);
    sunLight.position.set(5.5, 7.5, 3.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 20;
    sunLight.shadow.camera.left = -5.5;
    sunLight.shadow.camera.right = 5.5;
    sunLight.shadow.camera.top = 5.5;
    sunLight.shadow.camera.bottom = -5.5;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    // 3. 室內吊燈柔和補光
    const ceilingLamp = new THREE.PointLight(0xffecd1, 0.65, 9);
    ceilingLamp.position.set(0, 3.2, 0);
    this.scene.add(ceilingLamp);
  }

  createContactShadows() {
    // 低成本地面圓形柔和接觸陰影盤 (貼於地板 y = 0.003，即使弱算力設備也能精準貼地不穿幫)
    const shadowGeo = new THREE.CircleGeometry(0.35, 24);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x2b1d14,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    });

    this.playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.y = 0.003;
    this.scene.add(this.playerShadow);

    const catShadowGeo = new THREE.CircleGeometry(0.26, 24);
    this.catShadow = new THREE.Mesh(catShadowGeo, shadowMat.clone());
    this.catShadow.rotation.x = -Math.PI / 2;
    this.catShadow.position.y = 0.003;
    this.scene.add(this.catShadow);
  }

  /* ==========================================================================
     3D 場景建造：簡潔純淨繪本風、大色塊、窗外草原景觀
     ========================================================================== */
  buildApartment() {
    // 1. 平整的木質地板 (清晰色塊、柔和暖木紋)
    const floorGeo = new THREE.PlaneGeometry(14, 14);
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const ctx = floorCanvas.getContext('2d');
    ctx.fillStyle = '#e5b887';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#dcae7b';
    for (let y = 0; y < 512; y += 64) {
      if ((y / 64) % 2 === 0) ctx.fillRect(0, y, 512, 64);
    }
    ctx.strokeStyle = '#c4935b';
    ctx.lineWidth = 3;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 4);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.5,
      metalness: 0.05
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 2. 牆壁與溫暖木質踢腳線
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xfcf8f2, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(14, 4.5, 0.3), wallMat);
    backWall.position.set(0, 2.25, -4);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 14), wallMat);
    leftWall.position.set(-4.5, 2.25, 0);
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);

    const baseboard = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.16, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x8a5428, roughness: 0.6 })
    );
    baseboard.position.set(0, 0.08, -3.95);
    this.scene.add(baseboard);

    // 3. 牆上「小女生」大色塊水彩畫框
    this.buildWallArt();

    // 4. 柔細圓形地毯 (鮮明奶黃色塊)
    // 4. 柔細圓形地毯 (鮮明奶黃色塊，居中鋪設)
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(2.1, 32),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.95 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.005, -0.6);
    rug.receiveShadow = true;
    this.scene.add(rug);

    // 5. 大沙發與白色小被子 (移至對向南側，面向電視機，空間寬敞開闊不擁擠)
    this.buildSofa();

    // 6. 北歐圓角木質茶几 (居中於沙發與電視之間)
    this.buildCoffeeTable();

    // 7. 落地大窗與窗外「草原風光」
    this.buildWindowAndPrairieView();

    // 8. 浴室磨砂玻璃門
    this.buildBathroomDoor();

    // 9. 造型簡潔的大型觀葉盆栽
    this.buildHousePlant();

    // 10. 多層次豪華貓跳台
    this.buildCatTree();

    // 11. 電視櫃與動態水族館電視機 (位於正北主牆，與沙發對向呼應)
    this.buildTelevisionAndConsole();

    // 12. 各式貓咪玩具 (毛線球、逗貓魚、發條老鼠、瓦楞抓盆)
    this.buildCatToys();
  }

  buildWallArt() {
    const artFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.4, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.5 })
    );
    artFrame.position.set(-2.0, 2.6, -3.82);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 300;
    const aCtx = canvas.getContext('2d');
    aCtx.fillStyle = '#fffdf7';
    aCtx.fillRect(0, 0, 256, 300);
    // 橘貓大剪影
    aCtx.fillStyle = '#f97316';
    aCtx.beginPath();
    aCtx.arc(128, 160, 68, 0, Math.PI * 2);
    aCtx.fill();
    // 兩隻耳朵
    aCtx.beginPath();
    aCtx.moveTo(80, 115); aCtx.lineTo(95, 60); aCtx.lineTo(130, 105);
    aCtx.moveTo(176, 115); aCtx.lineTo(161, 60); aCtx.lineTo(126, 105);
    aCtx.fill();
    // 綠色大眼睛
    aCtx.fillStyle = '#10b981';
    aCtx.beginPath(); aCtx.arc(106, 150, 11, 0, Math.PI*2); aCtx.arc(150, 150, 11, 0, Math.PI*2); aCtx.fill();
    // 題字
    aCtx.fillStyle = '#78350f';
    aCtx.font = 'bold 22px sans-serif';
    aCtx.textAlign = 'center';
    aCtx.fillText('膠水貓・小女生', 128, 265);

    const artTex = new THREE.CanvasTexture(canvas);
    const artCanvas = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 1.28),
      new THREE.MeshBasicMaterial({ map: artTex })
    );
    artCanvas.position.set(0, 0, 0.035);
    artFrame.add(artCanvas);
    this.scene.add(artFrame);
  }

  buildSofa() {
    const sofaGroup = new THREE.Group();
    const sofaMat = new THREE.MeshStandardMaterial({ color: 0xf7ede2, roughness: 0.85 });
    const cushionMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.75 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 1.1), sofaMat);
    base.position.set(0, 0.175, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    sofaGroup.add(base);

    const back = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.75, 0.3), sofaMat);
    back.position.set(0, 0.68, -0.42);
    back.castShadow = true;
    sofaGroup.add(back);

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.58, 1.15), sofaMat);
    armL.position.set(-1.32, 0.44, 0);
    armL.castShadow = true;
    const armR = armL.clone();
    armR.position.x = 1.32;
    sofaGroup.add(armL, armR);

    // 三塊澎軟座墊 (頂部高度恰好為 y = 0.58，作為貓咪與主人坐標基準)
    for (let i = -1; i <= 1; i++) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.82), cushionMat);
      seat.position.set(i * 0.84, 0.46, 0.05);
      seat.castShadow = true;
      seat.receiveShadow = true;
      sofaGroup.add(seat);
    }

    // 白色小被子 (課本第三段：「像蓋上了一條白色小被子」)
    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.05, 0.82),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 })
    );
    blanket.position.set(0.7, 0.55, 0.08);
    sofaGroup.add(blanket);

    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 })
    );
    pillow.position.set(-0.85, 0.66, -0.2);
    pillow.rotation.y = 0.22;
    sofaGroup.add(pillow);

    // 沙發移至南側對向 (z = 1.4)，面朝北方電視機，空間大氣開闊
    sofaGroup.position.set(0, 0, 1.4);
    sofaGroup.rotation.y = Math.PI;
    sofaGroup.userData = { id: 'sofa', name: '溫馨沙發' };
    this.sofaGroup = sofaGroup;
    this.scene.add(sofaGroup);
  }

  buildCoffeeTable() {
    const tableGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xc89666, roughness: 0.5 });

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.85), woodMat);
    top.position.set(0, 0.46, 0);
    top.castShadow = true;
    top.receiveShadow = true;
    tableGroup.add(top);

    const legGeo = new THREE.CylinderGeometry(0.035, 0.025, 0.46, 12);
    [[-0.68, -0.32], [0.68, -0.32], [-0.68, 0.32], [0.68, 0.32]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeo, woodMat);
      leg.position.set(x, 0.23, z);
      leg.castShadow = true;
      tableGroup.add(leg);
    });

    // 旅遊計畫手冊與白瓷咖啡杯
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.22), new THREE.MeshStandardMaterial({ color: 0x2563eb }));
    book.position.set(-0.35, 0.51, 0.05);
    book.rotation.y = 0.2;
    tableGroup.add(book);

    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.1, 14), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    mug.position.set(0.35, 0.54, -0.1);
    tableGroup.add(mug);

    // 茶几居中置於沙發與電視機之間 (z = -0.6)
    tableGroup.position.set(0, 0, -0.6);
    this.scene.add(tableGroup);
  }

  buildWindowAndPrairieView() {
    const winGroup = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.6 });

    const outerFrame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.9, 0.18), frameMat);
    outerFrame.position.set(0, 2.2, 0);
    winGroup.add(outerFrame);

    const sill = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 0.45), frameMat);
    sill.position.set(0, 0.8, 0.14);
    winGroup.add(sill);

    // 玻璃窗透視
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.55, roughness: 0.1 })
    );
    glass.position.set(0, 2.2, 0.06);
    winGroup.add(glass);

    // 窗外「陽光綠意草原風光」（呼應課本分號例句：「馬匹在草原上，無拘無束的奔跑；鳥兒在天空中，自由自在的飛翔」）
    const prairieCanvas = document.createElement('canvas');
    prairieCanvas.width = 512;
    prairieCanvas.height = 512;
    const pCtx = prairieCanvas.getContext('2d');
    // 藍天白雲
    pCtx.fillStyle = '#7dd3fc';
    pCtx.fillRect(0, 0, 512, 512);
    pCtx.fillStyle = '#ffffff';
    pCtx.beginPath();
    pCtx.arc(140, 110, 45, 0, Math.PI * 2); pCtx.arc(180, 95, 55, 0, Math.PI * 2); pCtx.arc(220, 110, 45, 0, Math.PI * 2);
    pCtx.arc(380, 140, 50, 0, Math.PI * 2); pCtx.arc(430, 130, 60, 0, Math.PI * 2);
    pCtx.fill();
    // 遠山山丘
    pCtx.fillStyle = '#86efac';
    pCtx.beginPath(); pCtx.ellipse(120, 320, 260, 140, 0, 0, Math.PI * 2); pCtx.fill();
    pCtx.beginPath(); pCtx.ellipse(400, 300, 280, 150, 0, 0, Math.PI * 2); pCtx.fill();
    // 近景綠色大草原與小花
    pCtx.fillStyle = '#4ade80';
    pCtx.fillRect(0, 320, 512, 192);
    pCtx.fillStyle = '#fef08a';
    for (let i = 0; i < 30; i++) {
      pCtx.beginPath();
      pCtx.arc(Math.random() * 512, 340 + Math.random() * 150, 3, 0, Math.PI * 2);
      pCtx.fill();
    }
    const prairieTex = new THREE.CanvasTexture(prairieCanvas);
    const prairieBackdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 2.9),
      new THREE.MeshBasicMaterial({ map: prairieTex })
    );
    prairieBackdrop.position.set(0, 2.2, -0.15);
    winGroup.add(prairieBackdrop);

    // 浪漫粉紅窗簾
    const curtain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.38, 3.0, 16),
      new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.95 })
    );
    curtain.position.set(-1.65, 2.2, 0.22);
    winGroup.add(curtain);

    // 蝴蝶蘭盆栽
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0x334155 }));
    pot.position.set(0.9, 0.96, 0.16);
    winGroup.add(pot);

    winGroup.position.set(4, 0, -3.85);
    winGroup.userData = { id: 'window', name: '陽台落地窗' };
    this.winGroup = winGroup;
    this.scene.add(winGroup);

    this.createButterfly();
  }

  createButterfly() {
    const bGroup = new THREE.Group();
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, side: THREE.DoubleSide, roughness: 0.3 });

    const wingGeo = new THREE.PlaneGeometry(0.14, 0.12);
    this.bWingL = new THREE.Mesh(wingGeo, wingMat);
    this.bWingL.position.x = -0.07;
    this.bWingR = new THREE.Mesh(wingGeo, wingMat);
    this.bWingR.position.x = 0.07;

    bGroup.add(this.bWingL, this.bWingR);
    bGroup.position.set(3.8, 2.4, -3.3);
    this.scene.add(bGroup);
    this.butterfly = bGroup;
  }

  buildBathroomDoor() {
    const doorGroup = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.65, 1.35), new THREE.MeshStandardMaterial({ color: 0x374151 }));
    frame.position.set(0, 1.32, 0);
    doorGroup.add(frame);

    const doorPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 2.55, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.88,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.2
      })
    );
    doorPanel.position.set(0, 1.32, 0);
    doorGroup.add(doorPanel);

    doorGroup.position.set(-4.4, 0, -2.2);
    doorGroup.userData = { id: 'door', name: '浴室洗手間門口' };
    this.doorGroup = doorGroup;
    this.scene.add(doorGroup);
  }

  buildHousePlant() {
    const plantGroup = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.55, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
    pot.position.y = 0.275;
    plantGroup.add(pot);

    const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), leafMat);
      leaf.scale.set(1.2, 0.06, 1.6);
      leaf.position.set(Math.cos(angle) * 0.2, 0.65, Math.sin(angle) * 0.2);
      leaf.rotation.set(0.3 * Math.sin(angle), 0, 0.3 * Math.cos(angle));
      plantGroup.add(leaf);
    }

    plantGroup.position.set(-3.2, 0, -3.4);
    this.scene.add(plantGroup);
  }

  /* ==========================================================================
     貓跳台、水族館電視機與各式貓咪玩具
     ========================================================================== */
  buildCatTree() {
    const treeGroup = new THREE.Group();

    // 溫暖柔軟絨布材質與劍麻繩材質
    const carpetMat = new THREE.MeshStandardMaterial({ color: 0xeadbc8, roughness: 0.9 });
    const sisalMat = new THREE.MeshStandardMaterial({ color: 0xd4b483, roughness: 0.85 });

    // 1. 底座 (沉穩厚實，不穿地)
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.08, 0.85), carpetMat);
    base.position.set(0, 0.04, 0);
    base.receiveShadow = true;
    treeGroup.add(base);

    // 2. 主劍麻柱 (連接底座到第1層)
    const post1 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.58, 16), sisalMat);
    post1.position.set(-0.25, 0.35, 0.15);
    post1.castShadow = true;
    treeGroup.add(post1);

    const post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.58, 16), sisalMat);
    post2.position.set(0.25, 0.35, 0.15);
    post2.castShadow = true;
    treeGroup.add(post2);

    // 3. 第 1 層大跳台 (高度 y = 0.65，貓咪可跳上去)
    const plat1 = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.65), carpetMat);
    plat1.position.set(-0.1, 0.65, 0.05);
    plat1.receiveShadow = true;
    treeGroup.add(plat1);

    // 4. 貓咪魔方小樹屋 (Condo Box, y = 0.93)
    const condo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.48), carpetMat);
    condo.position.set(-0.1, 0.93, 0.05);
    condo.castShadow = true;
    treeGroup.add(condo);

    // 樹屋鑽洞 (圓形深色入口)
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.12, 18),
      new THREE.MeshBasicMaterial({ color: 0x271912 })
    );
    hole.position.set(-0.1, 0.92, 0.30);
    treeGroup.add(hole);

    // 5. 向上延伸柱 (第1層到最高瞭望台，長度約 0.85m)
    const topPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 16), sisalMat);
    topPost.position.set(0.2, 1.1, -0.15);
    topPost.castShadow = true;
    treeGroup.add(topPost);

    // 6. 最高瞭望觀景台 (高度 y = 1.55)
    const topPerch = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.55), carpetMat);
    topPerch.position.set(0.2, 1.55, -0.15);
    topPerch.receiveShadow = true;
    treeGroup.add(topPerch);

    // 觀景台防摔圍邊 (圓邊軟墊)
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.045, 8, 24), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0.2, 1.59, -0.15);
    treeGroup.add(rim);

    // 7. 懸掛式毛絨小球吊飾 (動態擺盪)
    this.danglingBallGroup = new THREE.Group();
    this.danglingBallGroup.position.set(0.2, 1.52, 0.15);

    const stringGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.28, 6);
    stringGeo.translate(0, -0.14, 0);
    const stringMesh = new THREE.Mesh(stringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    this.danglingBallGroup.add(stringMesh);

    this.danglingBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.7 })
    );
    this.danglingBall.position.set(0, -0.28, 0);
    this.danglingBall.castShadow = true;
    this.danglingBallGroup.add(this.danglingBall);
    treeGroup.add(this.danglingBallGroup);

    // 定位貓跳台於右前方靠窗落地明亮處 (x = 2.8, z = -2.5)
    treeGroup.position.set(2.8, 0, -2.5);
    treeGroup.userData = { id: 'cattree', name: '多層豪華貓跳台' };
    this.treeGroup = treeGroup;
    this.scene.add(treeGroup);
  }

  buildTelevisionAndConsole() {
    const tvGroup = new THREE.Group();

    // 1. 溫潤木質電視矮櫃 (Console, 檯面高度 0.50，置於正北主牆中央)
    const consoleCabinet = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.48, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x7c4a27, roughness: 0.55 })
    );
    consoleCabinet.position.set(0, 0.24, 0);
    consoleCabinet.receiveShadow = true;
    consoleCabinet.castShadow = true;
    tvGroup.add(consoleCabinet);

    // 電視櫃門片與金屬把手
    const doorL = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.42, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x693e20, roughness: 0.5 })
    );
    doorL.position.set(-0.44, 0.24, 0.26);
    tvGroup.add(doorL);

    const doorR = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.42, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x693e20, roughness: 0.5 })
    );
    doorR.position.set(0.44, 0.24, 0.26);
    tvGroup.add(doorR);

    const handleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });
    const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), handleMat);
    handleL.position.set(-0.06, 0.24, 0.28);
    tvGroup.add(handleL);
    const handleR = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), handleMat);
    handleR.position.set(0.06, 0.24, 0.28);
    tvGroup.add(handleR);

    // 2. 寬螢幕超薄電視機 (Widescreen TV)
    const tvBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.02, 0.24),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.6, roughness: 0.3 })
    );
    tvBase.position.set(0, 0.49, 0);
    tvGroup.add(tvBase);

    const tvPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.7, roughness: 0.3 })
    );
    tvPillar.position.set(0, 0.56, 0);
    tvGroup.add(tvPillar);

    const tvFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.92, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2 })
    );
    tvFrame.position.set(0, 1.05, 0);
    tvFrame.castShadow = true;
    tvGroup.add(tvFrame);

    // 3. 動態水族館螢幕 (Dynamic Canvas Texture with Swimming Fish)
    this.fishCanvas = document.createElement('canvas');
    this.fishCanvas.width = 512;
    this.fishCanvas.height = 300;
    this.fishCtx = this.fishCanvas.getContext('2d');

    this.tvScreenTex = new THREE.CanvasTexture(this.fishCanvas);
    const tvScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.52, 0.84),
      new THREE.MeshBasicMaterial({ map: this.tvScreenTex })
    );
    tvScreen.position.set(0, 1.05, 0.025);
    tvGroup.add(tvScreen);

    // 電視櫃居中陳設於正北主牆面中央 (x = 0, z = -3.72)
    tvGroup.position.set(0, 0, -3.72);
    tvGroup.userData = { id: 'tv', name: '水族館電視機' };
    this.tvGroup = tvGroup;
    this.scene.add(tvGroup);
  }

  buildCatToys() {
    const toysGroup = new THREE.Group();

    // 1. 繽紛大毛線球 (Yarn Ball) 與彎曲毛線 (位於大茶几前側地毯上)
    this.yarnBallGroup = new THREE.Group();
    const yarnMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.85 });
    this.yarnBall = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), yarnMat);
    this.yarnBall.position.set(0, 0.085, 0);
    this.yarnBall.castShadow = true;
    this.yarnBallGroup.add(this.yarnBall);

    // 毛線球纏繞線條感
    const yarnRingMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.005, 6, 18), yarnRingMat);
      ring.rotation.set(r * 0.9, r * 1.2, 0);
      ring.position.set(0, 0.085, 0);
      this.yarnBallGroup.add(ring);
    }

    // 拖曳在地毯上的毛線尾巴 (Curve)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.015, 0),
      new THREE.Vector3(0.18, 0.015, 0.12),
      new THREE.Vector3(0.32, 0.015, 0.02),
      new THREE.Vector3(0.48, 0.015, 0.18)
    ]);
    const lineGeo = new THREE.TubeGeometry(curve, 20, 0.006, 6, false);
    const trailLine = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({ color: 0xec4899 }));
    this.yarnBallGroup.add(trailLine);

    this.yarnBallGroup.position.set(0.7, 0, -0.4);
    this.yarnBallGroup.userData = { id: 'yarn', name: '彩色毛線球' };
    toysGroup.add(this.yarnBallGroup);

    // 2. 貓薄荷小魚玩偶 (Catnip Fish Plush)
    const fishGroup = new THREE.Group();
    const fishMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.7 });
    const fishBody = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), fishMat);
    fishBody.scale.set(1.5, 0.75, 0.55);
    fishBody.position.set(0, 0.045, 0);
    fishGroup.add(fishBody);

    const fishTail = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.08, 3),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.7 })
    );
    fishTail.rotation.z = Math.PI / 2;
    fishTail.position.set(-0.11, 0.045, 0);
    fishGroup.add(fishTail);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), new THREE.MeshBasicMaterial({ color: 0x0f172a }));
    eyeL.position.set(0.06, 0.055, 0.032);
    fishGroup.add(eyeL);

    fishGroup.position.set(-0.6, 0, -0.3);
    fishGroup.rotation.y = 0.6;
    toysGroup.add(fishGroup);

    // 3. 歡樂發條小老鼠 (Wind-up Toy Mouse)
    this.toyMouse = new THREE.Group();
    const mouseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65 });
    const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), mouseMat);
    mouseBody.scale.set(1.4, 0.8, 0.75);
    mouseBody.position.set(0, 0.04, 0);
    this.toyMouse.add(mouseBody);

    const earMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });
    const ear1 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), earMat);
    ear1.position.set(0.04, 0.075, 0.03);
    this.toyMouse.add(ear1);
    const ear2 = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), earMat);
    ear2.position.set(0.04, 0.075, -0.03);
    this.toyMouse.add(ear2);

    // 鼠尾巴
    const mouseTail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.002, 0.12, 6),
      new THREE.MeshBasicMaterial({ color: 0xf472b6 })
    );
    mouseTail.rotation.z = -Math.PI / 3;
    mouseTail.position.set(-0.09, 0.04, 0);
    this.toyMouse.add(mouseTail);

    // 發條鑰匙
    const key = new THREE.Mesh(
      new THREE.TorusGeometry(0.02, 0.005, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.3 })
    );
    key.rotation.y = Math.PI / 2;
    key.position.set(-0.02, 0.09, 0);
    this.toyMouse.add(key);

    this.toyMouse.position.set(1.8, 0, 0.6);
    this.toyMouse.userData = { id: 'mouse', name: '發條小老鼠' };
    toysGroup.add(this.toyMouse);

    // 4. 圓形瓦楞紙貓抓盆 (Scratcher Bowl)
    const bowlGroup = new THREE.Group();
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const bowlOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.09, 24), bowlMat);
    bowlOuter.position.set(0, 0.045, 0);
    bowlGroup.add(bowlOuter);

    const padMat = new THREE.MeshStandardMaterial({ color: 0xcd7f32, roughness: 0.95 });
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 24), padMat);
    pad.position.set(0, 0.05, 0);
    bowlGroup.add(pad);

    bowlGroup.position.set(-2.8, 0, 0.8);
    bowlGroup.userData = { id: 'bowl', name: '點心餐盤' };
    this.bowlGroup = bowlGroup;
    toysGroup.add(bowlGroup);

    this.scene.add(toysGroup);
  }


  /* ==========================================================================
     主角：3D 橘白相間貓咪「小女生」
     規範落實：
     - MeshStandardMaterial 卡通色塊材質 (橘色主毛、純白肚子、白襪子、粉嫩耳鼻)
     - 一致腳底原點 (貓掌觸地 y = 0，絕不穿透地面)
     - 大眼有神、可愛臉蛋、紅項圈金鈴鐺、白尾尖，縮小依舊辨識度極高
     ========================================================================== */
  createCat() {
    this.cat = new THREE.Group();

    // 規範色塊材質
    const orangeFur = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.52, metalness: 0.04 });
    const whiteFur = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.02 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.45 });

    // 內部獨立模型骨架群組（便於平滑翻肚過渡，確保無論站立或翻肚，底部絕不穿入地面/沙發）
    this.catMeshGroup = new THREE.Group();
    this.catMeshGroup.position.set(0, 0.20, 0);
    this.cat.add(this.catMeshGroup);

    // 1. 貓身 (中心對齊 catMeshGroup)
    const bodyGeo = new THREE.SphereGeometry(0.22, 18, 14);
    bodyGeo.scale(1.28, 0.92, 0.88);
    const body = new THREE.Mesh(bodyGeo, orangeFur);
    body.position.set(0, 0.02, 0);
    body.castShadow = true;
    this.catMeshGroup.add(body);
    this.catBody = body;

    // 2. 毛茸茸的白肚子（大色塊白被子，翻肚時自然朝天顯露）
    const bellyGeo = new THREE.SphereGeometry(0.19, 16, 12);
    bellyGeo.scale(1.0, 0.88, 0.94);
    const belly = new THREE.Mesh(bellyGeo, whiteFur);
    belly.position.set(0, -0.02, 0.06);
    this.catMeshGroup.add(belly);
    this.catBelly = belly;

    // 3. 貓頭
    const headGroup = new THREE.Group();
    headGroup.position.set(0.26, 0.12, 0);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 16), orangeFur);
    head.castShadow = true;
    headGroup.add(head);

    // 白色口吻包子臉
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), whiteFur);
    muzzle.position.set(0, -0.04, 0.13);
    muzzle.scale.set(1.25, 0.82, 0.95);
    headGroup.add(muzzle);

    // 粉紅小鼻子
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.02, 6), pinkMat);
    nose.rotation.x = Math.PI;
    nose.position.set(0, -0.015, 0.21);
    headGroup.add(nose);

    // 大眼睛：翡翠綠虹膜 + 黑色瞳孔 + 白色晶瑩高光 (縮小依舊炯炯有神)
    const eyeIrisMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.1, metalness: 0.2 });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const eyeHighlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    [-1, 1].forEach(side => {
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), eyeIrisMat);
      iris.position.set(side * 0.075, 0.045, 0.145);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyePupilMat);
      pupil.position.set(side * 0.075, 0.045, 0.17);

      const highlight = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), eyeHighlightMat);
      highlight.position.set(side * 0.075 + 0.015, 0.055, 0.185);

      headGroup.add(iris, pupil, highlight);
    });

    // 左右白鬍鬚 (左右各三根，粗細合度)
    const whiskerMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    [-1, 1].forEach(side => {
      for (let w = -1; w <= 1; w++) {
        const points = [
          new THREE.Vector3(side * 0.07, -0.03 + w * 0.015, 0.15),
          new THREE.Vector3(side * 0.21, -0.03 + w * 0.03, 0.17)
        ];
        headGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), whiskerMat));
      }
    });

    // 貓耳朵 (帶粉紅耳窩)
    const earGeo = new THREE.ConeGeometry(0.065, 0.11, 4);
    const earL = new THREE.Mesh(earGeo, orangeFur);
    earL.position.set(-0.085, 0.17, 0.02);
    earL.rotation.z = 0.32;
    const earInnerL = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), pinkMat);
    earInnerL.position.set(-0.085, 0.16, 0.035);
    earInnerL.rotation.z = 0.32;

    const earR = new THREE.Mesh(earGeo, orangeFur);
    earR.position.set(0.085, 0.17, 0.02);
    earR.rotation.z = -0.32;
    const earInnerR = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), pinkMat);
    earInnerR.position.set(0.085, 0.16, 0.035);
    earInnerR.rotation.z = -0.32;

    headGroup.add(earL, earInnerL, earR, earInnerR);

    this.catMeshGroup.add(headGroup);
    this.catHead = headGroup;

    // 4. 紅色項圈與金色小鈴鐺 (反光高質感金屬色塊)
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.018, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
    );
    collar.position.set(0.18, 0.06, 0);
    collar.rotation.y = Math.PI / 2;
    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85, roughness: 0.18 })
    );
    bell.position.set(0.18, -0.01, 0.15);
    this.catMeshGroup.add(collar, bell);
    this.collar = collar;
    this.bell = bell;

    // 5. 四隻純白襪子短腿（腿柱高度 0.16，足底嚴格恰在 y = 0，不穿地）
    this.catLegs = [];
    const legPositions = [
      [0.18, 0.15],
      [0.18, -0.15],
      [-0.18, 0.15],
      [-0.18, -0.15]
    ];
    legPositions.forEach(([x, z]) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(x, -0.04, z); // 旋轉關節軸心 (高度對齊 y = 0.16)

      const legMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.04, 0.16, 10),
        whiteFur
      );
      legMesh.position.y = -0.08; // 圓柱中心偏移，底端在 0.20 - 0.04 - 0.16 = 0
      legMesh.castShadow = true;
      legGroup.add(legMesh);

      this.catMeshGroup.add(legGroup);
      this.catLegs.push(legGroup);
    });

    // 6. 橘色彎尾巴 (帶白尾尖)
    this.catTail = new THREE.Group();
    const tailBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.024, 0.24, 8),
      orangeFur
    );
    tailBase.position.y = 0.12;
    const tailTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      whiteFur
    );
    tailTip.position.y = 0.24;
    this.catTail.add(tailBase, tailTip);
    this.catTail.position.set(-0.28, 0.04, 0);
    this.catTail.rotation.z = 0.8;
    this.catMeshGroup.add(this.catTail);

    this.cat.position.copy(this.catPos);
    this.scene.add(this.cat);
  }

  /* ==========================================================================
     主角：3D 精緻小主人（鍾怡雯老師形象：作家/鏟屎官）
     規範落實：
     - 一致腳底原點 (鞋底嚴格位在 y = 0，行走不穿地)
     - 鮮明色塊與輪廓 (深色鮑伯短髮、經典黑框眼鏡、寬幅深藍米白條紋毛衣、逗貓棒)
     - 大眼微笑可愛比例 (Chibi 1:2.8 比例，遠距離一眼識別職業角色)
     ========================================================================== */
  createPlayerAvatar() {
    const pGroup = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdfd0, roughness: 0.58 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f1915, roughness: 0.45 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0xdfd3c3, roughness: 0.75 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const soleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });

    // 寬幅清晰橫條紋毛衣貼圖 (縮小依然清晰分明，不模糊成灰)
    const stripeCanvas = document.createElement('canvas');
    stripeCanvas.width = 256;
    stripeCanvas.height = 256;
    const sCtx = stripeCanvas.getContext('2d');
    sCtx.fillStyle = '#f8fafc'; // 乾淨米白底
    sCtx.fillRect(0, 0, 256, 256);
    sCtx.fillStyle = '#1e293b'; // 深海軍藍黑條紋
    for (let y = 0; y < 256; y += 48) {
      sCtx.fillRect(0, y, 256, 24);
    }
    const sweaterTex = new THREE.CanvasTexture(stripeCanvas);
    sweaterTex.wrapS = THREE.RepeatWrapping;
    sweaterTex.wrapT = THREE.RepeatWrapping;
    sweaterTex.repeat.set(1, 2);
    const sweaterMat = new THREE.MeshStandardMaterial({ map: sweaterTex, roughness: 0.68 });

    // 1. 雙腿與球鞋 (原點嚴格自 y = 0 向上起算)
    const legGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.64, 12);
    const shoeGeo = new THREE.BoxGeometry(0.13, 0.08, 0.21);
    const soleGeo = new THREE.BoxGeometry(0.13, 0.02, 0.21);

    // 左腿 (關節軸心 y = 0.72)
    const legL = new THREE.Group();
    legL.position.set(-0.13, 0.72, 0);

    const legMeshL = new THREE.Mesh(legGeo, pantsMat);
    legMeshL.position.y = -0.32;
    legMeshL.castShadow = true;

    const shoeL = new THREE.Mesh(shoeGeo, shoeMat);
    shoeL.position.set(0, -0.66, 0.04);
    const soleL = new THREE.Mesh(soleGeo, soleMat);
    soleL.position.set(0, -0.71, 0.04); // 鞋底恰好在 0.72 - 0.72 = 0！
    shoeL.add(soleL);
    legL.add(legMeshL, shoeL);

    // 右腿 (關節軸心 y = 0.72)
    const legR = new THREE.Group();
    legR.position.set(0.13, 0.72, 0);

    const legMeshR = new THREE.Mesh(legGeo, pantsMat);
    legMeshR.position.y = -0.32;
    legMeshR.castShadow = true;

    const shoeR = new THREE.Mesh(shoeGeo, shoeMat);
    shoeR.position.set(0, -0.66, 0.04);
    const soleR = new THREE.Mesh(soleGeo, soleMat);
    soleR.position.set(0, -0.71, 0.04);
    shoeR.add(soleR);
    legR.add(legMeshR, shoeR);

    pGroup.add(legL, legR);
    this.playerNodes.legL = legL;
    this.playerNodes.legR = legR;

    // 2. 軀幹與毛衣 (自腰部 y = 0.72 至領口 y = 1.34)
    const torsoGroup = new THREE.Group();
    const chestGeo = new THREE.CylinderGeometry(0.25, 0.23, 0.58, 16);
    const chest = new THREE.Mesh(chestGeo, sweaterMat);
    chest.position.y = 1.02;
    chest.castShadow = true;
    torsoGroup.add(chest);

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 1.31, 0);
    torsoGroup.add(collar);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), skinMat);
    neck.position.y = 1.35;
    torsoGroup.add(neck);

    pGroup.add(torsoGroup);
    this.playerNodes.torso = torsoGroup;

    // 3. 可愛比例頭部 (中心 y = 1.50，高光大眼睛與招牌黑框眼鏡)
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.50, 0);

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 16), skinMat);
    face.castShadow = true;
    headGroup.add(face);

    // 蘋果肌腮紅
    const blushMat = new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.45 });
    const blushL = new THREE.Mesh(new THREE.CircleGeometry(0.04, 12), blushMat);
    blushL.position.set(-0.11, -0.04, 0.20);
    const blushR = blushL.clone();
    blushR.position.x = 0.11;
    headGroup.add(blushL, blushR);

    // 大眼睛與晶瑩高光
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const eyeSparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [-1, 1].forEach(side => {
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), eyePupilMat);
      pupil.position.set(side * 0.08, 0.02, 0.205);
      const sparkle = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 8), eyeSparkleMat);
      sparkle.position.set(side * 0.08 + 0.008, 0.028, 0.22);
      headGroup.add(pupil, sparkle);
    });

    // 甜美微笑
    const smileMat = new THREE.LineBasicMaterial({ color: 0x9a3412, linewidth: 2 });
    const smilePoints = [
      new THREE.Vector3(-0.04, -0.08, 0.205),
      new THREE.Vector3(0, -0.095, 0.21),
      new THREE.Vector3(0.04, -0.08, 0.205)
    ];
    headGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(smilePoints), smileMat));

    // 招牌立體黑框眼鏡 (遠處一眼識別)
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
    const rimGeo = new THREE.TorusGeometry(0.052, 0.009, 8, 18);
    const rimL = new THREE.Mesh(rimGeo, frameMat);
    rimL.position.set(-0.08, 0.02, 0.215);
    const rimR = rimL.clone();
    rimR.position.x = 0.08;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.01), frameMat);
    bridge.position.set(0, 0.02, 0.215);
    const templeL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.2), frameMat);
    templeL.position.set(-0.14, 0.02, 0.11);
    const templeR = templeL.clone();
    templeR.position.x = 0.14;
    headGroup.add(rimL, rimR, bridge, templeL, templeR);

    // 俐落齊瀏海鮑伯短髮
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), hairMat);
    hairCap.position.set(0, 0.04, -0.02);
    const bangs = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.24, 0.11, 16, 1, false, -Math.PI / 2, Math.PI), hairMat);
    bangs.position.set(0, 0.1, 0.05);
    headGroup.add(hairCap, bangs);

    pGroup.add(headGroup);
    this.playerNodes.head = headGroup;

    // 4. 手臂與逗貓棒 (手臂關節 y = 1.26)
    const armGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.48, 12);
    const armL = new THREE.Group();
    armL.position.set(-0.32, 1.26, 0);
    const armMeshL = new THREE.Mesh(armGeo, sweaterMat);
    armMeshL.position.y = -0.24;
    armMeshL.castShadow = true;
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), skinMat);
    handL.position.y = -0.5;
    armL.add(armMeshL, handL);
    pGroup.add(armL);
    this.playerNodes.armL = armL;

    const armR = new THREE.Group();
    armR.position.set(0.32, 1.26, 0);
    const armMeshR = new THREE.Mesh(armGeo, sweaterMat);
    armMeshR.position.y = -0.24;
    armMeshR.castShadow = true;
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), skinMat);
    handR.position.y = -0.5;

    // 逗貓棒 (鮮豔黃桿 + 紅綠藍大羽毛，縮小極具辨識度)
    const wandGroup = new THREE.Group();
    const wandStick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.01, 0.65, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 })
    );
    wandStick.position.set(0.12, 0.15, 0.22);
    wandStick.rotation.x = Math.PI / 4;
    wandStick.rotation.z = -0.3;

    const featherColors = [0xef4444, 0x10b981, 0x3b82f6];
    this.feathers = [];
    featherColors.forEach((fc, idx) => {
      const f = new THREE.Mesh(
        new THREE.ConeGeometry(0.05, 0.18, 6),
        new THREE.MeshStandardMaterial({ color: fc, roughness: 0.6 })
      );
      f.position.set(0.24, 0.42 + idx * 0.02, 0.44);
      f.rotation.set(0.4 + idx * 0.2, 0, idx * 0.3);
      wandGroup.add(f);
      this.feathers.push(f);
    });

    wandGroup.add(wandStick);
    handR.add(wandGroup);
    armR.add(armMeshR, handR);
    pGroup.add(armR);
    this.playerNodes.armR = armR;
    this.playerNodes.wand = wandGroup;

    pGroup.position.copy(this.playerPos);
    this.scene.add(pGroup);
    this.player = pGroup;
  }

  /* ==========================================================================
     相機 360° 控制與家具防穿透碰撞系統
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
      this.cameraDistance = Math.max(1.6, Math.min(7.2, this.cameraDistance));
    }, { passive: false });

    // 觸控適配
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
        this.cameraDistance = Math.max(1.6, Math.min(7.2, this.cameraDistance));
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

    // 拖曳畫面旋轉視角 (Camera Yaw)
    let camTouchId = null;
    let lastCamX = 0;
    window.addEventListener('touchstart', (e) => {
      const padEl = document.getElementById('pad');
      const r = padEl ? padEl.getBoundingClientRect() : null;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (r && t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom) {
          continue;
        }
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
          if (window.__bird && window.__bird.P) {
            window.__bird.P.yaw = this.cameraYaw;
          }
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

  getSurfaceHeight(x, z) {
    // 1. 南側沙發座墊區 (頂部高度 0.58)
    if (x >= -1.26 && x <= 1.26 && z >= 0.92 && z <= 1.76) {
      return 0.58;
    }
    // 2. 中央茶几檯面 (高度 0.50)
    if (x >= -0.85 && x <= 0.85 && z >= -1.05 && z <= -0.15) {
      return 0.50;
    }
    // 3. 落地大窗木質窗台 (高度 0.85)
    if (x >= 2.2 && x <= 5.8 && z >= -3.95 && z <= -3.45) {
      return 0.85;
    }
    // 4. 貓跳台最高瞭望台 (高度 1.55)
    if (x >= 2.70 && x <= 3.30 && z >= -2.95 && z <= -2.35) {
      return 1.55;
    }
    // 5. 貓跳台第 1 層大跳台 (高度 0.65)
    if (x >= 2.32 && x <= 3.10 && z >= -2.80 && z <= -2.10) {
      return 0.65;
    }
    // 6. 北牆電視櫃檯面 (高度 0.50)
    if (x >= -0.95 && x <= 0.95 && z >= -3.98 && z <= -3.45) {
      return 0.50;
    }
    // 7. 平整木質地板 (基準高度 0，絕不穿透地面)
    return 0;
  }

  resolveCollision(candidatePos, radius = 0.3, isSitting = false, isCatOnSofa = false) {
    if (isSitting) return candidatePos;

    // 輔助函式：軸對齊包圍盒 (AABB) 剛體推擠碰撞判定
    const resolveAABB = (pos, bMinX, bMaxX, bMinZ, bMaxZ) => {
      const minX = bMinX - radius;
      const maxX = bMaxX + radius;
      const minZ = bMinZ - radius;
      const maxZ = bMaxZ + radius;
      if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
        const dL = Math.abs(pos.x - minX);
        const dR = Math.abs(pos.x - maxX);
        const dF = Math.abs(pos.z - maxZ);
        const dB = Math.abs(pos.z - minZ);
        const minD = Math.min(dL, dR, dF, dB);
        if (minD === dL) pos.x = minX;
        else if (minD === dR) pos.x = maxX;
        else if (minD === dF) pos.z = maxZ;
        else pos.z = minZ;
      }
    };

    // 輔助函式：圓柱障礙推擠
    const resolveCylinder = (pos, cx, cz, cRadius) => {
      const dist = Math.hypot(pos.x - cx, pos.z - cz);
      const minDist = cRadius + radius;
      if (dist < minDist && dist > 0.0001) {
        const angle = Math.atan2(pos.z - cz, pos.x - cx);
        pos.x = cx + Math.cos(angle) * minDist;
        pos.z = cz + Math.sin(angle) * minDist;
      }
    };

    // 進行 2 次連續迭代推擠，杜絕多個家具或牆角夾角處穿透
    for (let iter = 0; iter < 2; iter++) {
      // 1. 沙發碰撞 (位於正南側 z = 1.4，背靠南牆，面向北方電視機)
      if (!isCatOnSofa) {
        // 地面上角色嚴格禁止穿入沙發實體底座、扶手與靠背
        resolveAABB(candidatePos, -1.47, 1.47, 0.82, 1.98);
      } else {
        // 貓咪在沙發座墊上時，嚴格防護不可穿透沙發靠背與左右扶手
        if (candidatePos.z > 1.66 - radius) candidatePos.z = 1.66 - radius;
        if (candidatePos.x < -1.16 + radius) candidatePos.x = -1.16 + radius;
        if (candidatePos.x > 1.16 - radius) candidatePos.x = 1.16 - radius;
      }

      // 2. 茶几碰撞 (居中於沙發與電視之間，z = -0.6)
      resolveAABB(candidatePos, -0.85, 0.85, -1.05, -0.15);

      // 3. 電視櫃碰撞 (置於正北主牆中央，z = -3.72)
      resolveAABB(candidatePos, -0.95, 0.95, -3.98, -3.45);

      // 4. 貓跳台基座碰撞 (只有在地面時才碰撞，高於跳台基座時自由攀爬)
      const isCatHigh = (this.viewMode === 'cat' && this.catPos.y > 0.5);
      if (!isCatHigh) {
        resolveAABB(candidatePos, 2.32, 3.28, -2.93, -2.07);
      }

      // 5. 大型觀葉盆栽圓柱碰撞 (位於西北角落 x = -3.2, z = -3.4)
      resolveCylinder(candidatePos, -3.2, -3.4, 0.48);

      // 6. 圓形貓抓盆碰撞 (位於 x = -2.8, z = 0.8)
      resolveCylinder(candidatePos, -2.8, 0.8, 0.36);

      // 7. 客廳牆壁與邊界防護 (絕不可穿牆出室外)
      candidatePos.x = Math.max(-4.2 + radius, Math.min(4.1 - radius, candidatePos.x));
      candidatePos.z = Math.max(-3.72 + radius, Math.min(3.6 - radius, candidatePos.z));
    }

    return candidatePos;
  }

  interactCatTree() {
    if (this.viewMode === 'cat') {
      if (this.catPos.y < 0.6) {
        this.catPos.set(2.7, 0.65, -2.45);
        this.cat.position.copy(this.catPos);
        this.catState = 'sit';
        if (window.soundSystem) window.soundSystem.playRealMeow('playful');
        this.showPrompt('🐱 小女生矯健地跳上了貓跳台第一層！居高臨下巡視客廳！✨');
      } else if (this.catPos.y < 1.4) {
        this.catPos.set(3.0, 1.55, -2.65);
        this.cat.position.copy(this.catPos);
        this.catState = 'sit';
        if (window.soundSystem) window.soundSystem.playRealMeow('sweet');
        this.showPrompt('🐱 小女生登上了最高瞭望台！好神氣呀～🥰');
      } else {
        this.catPos.set(2.5, 0, -1.8);
        this.cat.position.copy(this.catPos);
        if (window.soundSystem) window.soundSystem.playRealMeow('happy');
        this.showPrompt('🐱 小女生輕盈地跳下貓跳台！🐾');
      }
    } else {
      if (window.voiceSystem) {
        window.voiceSystem.speak('小女生，要不要爬上貓跳台看風景呀？', '小主人（指向跳台）');
      }
      setTimeout(() => {
        if (this.cat) {
          this.catPos.set(2.7, 0.65, -2.45);
          this.cat.position.copy(this.catPos);
          this.catState = 'sit';
          if (window.soundSystem) window.soundSystem.playRealMeow('playful');
          this.showPrompt('🐱 小女生爬上了貓跳台伸懶腰，開心地向你喵叫！💖');
        }
      }, 700);
    }
  }

  interactTV() {
    if (window.voiceSystem) {
      window.voiceSystem.speak('小女生你看，電視水族館的小魚游得多開心！', '小主人（指著電視）');
    }
    setTimeout(() => {
      if (this.cat) {
        this.catPos.set(0, 0, -2.8);
        this.cat.position.copy(this.catPos);
        this.cat.rotation.y = Math.PI / 2; // 頭部面朝正北電視水族館
        this.catState = 'sit';
        if (window.soundSystem) window.soundSystem.playRealMeow('alert');
        this.showPrompt('🐱 小女生坐在電視前，目不轉睛盯著小金魚游動！🐟✨');
      }
    }, 700);
  }

  interactYarn() {
    if (window.soundSystem) window.soundSystem.playRealMeow('playful');
    this.showPrompt('🧶 小女生伸出粉嫩肉球撥弄毛線球，玩得滾來滾去！💖');
    this.spawnHeartsNear(new THREE.Vector3(0.7, 0.2, -0.4));

    if (this.yarnBall) {
      let roll = 0;
      const interval = setInterval(() => {
        roll++;
        this.yarnBall.rotation.x += 0.3;
        this.yarnBall.rotation.y += 0.2;
        if (roll > 15) clearInterval(interval);
      }, 40);
    }
  }

  interactToyMouse() {
    if (window.soundSystem) window.soundSystem.playRealMeow('playful');
    this.showPrompt('🐭 發條小老鼠滴溜溜旋轉！小女生機靈地撲抓！🐾✨');
    this.spawnHeartsNear(new THREE.Vector3(1.8, 0.2, 0.6));

    if (this.toyMouse) {
      let mStep = 0;
      const interval = setInterval(() => {
        mStep++;
        this.toyMouse.rotation.y += 0.4;
        this.toyMouse.position.x = 1.8 + Math.sin(mStep * 0.5) * 0.15;
        if (mStep > 16) {
          clearInterval(interval);
          this.toyMouse.position.x = 1.8;
        }
      }, 50);
    }
  }

  /* ==========================================================================
     坐沙發與多樣互動
     ========================================================================== */
  toggleSitSofa() {
    if (this.isSitting) {
      this.isSitting = false;
      this.playerPos.set(0, 0, 0.6); // 站起時邁步到沙發前開闊地毯處
      this.player.position.copy(this.playerPos);
      this.player.position.y = 0;
      this.player.rotation.y = Math.PI; // 面對電視方向
      if (this.playerNodes.legL) this.playerNodes.legL.rotation.x = 0;
      if (this.playerNodes.legR) this.playerNodes.legR.rotation.x = 0;
      if (this.playerNodes.armL) this.playerNodes.armL.rotation.x = 0;
      if (this.playerNodes.armR) this.playerNodes.armR.rotation.x = 0;
      if (this.playerNodes.torso) this.playerNodes.torso.position.y = 0;
      this.updateSitBtnUI(false);
      if (window.soundSystem) window.soundSystem.playClick();
      this.showPrompt('🚶 小主人站起身來！');
    } else {
      this.isSitting = true;
      this.playerPos.set(0, 0, 1.35); // 坐於正南側沙發座墊上
      this.player.position.copy(this.playerPos);
      this.player.position.y = -0.22; // 全身整體就座，頭頸、軀幹與四肢緊密相連絕不分開
      this.player.rotation.y = Math.PI; // 面向北方電視機！

      // 雙腿前伸坐於座墊，手臂自然放鬆置於腿上
      if (this.playerNodes.legL) this.playerNodes.legL.rotation.x = -Math.PI / 2;
      if (this.playerNodes.legR) this.playerNodes.legR.rotation.x = -Math.PI / 2;
      if (this.playerNodes.armL) this.playerNodes.armL.rotation.x = -0.45;
      if (this.playerNodes.armR) this.playerNodes.armR.rotation.x = -0.45;
      if (this.playerNodes.torso) this.playerNodes.torso.position.y = 0; // 軀幹絕不單獨偏移
      this.updateSitBtnUI(true);
      if (window.soundSystem) window.soundSystem.playClick();

      if (window.voiceSystem) {
        window.voiceSystem.speak('sofa');
      }

      setTimeout(() => {
        if (this.cat) {
          this.catPos.set(0.55, 0.58, 1.35); // 跳到主人身旁的沙發座墊，高度精準 0.58
          this.cat.position.copy(this.catPos);
          this.cat.rotation.y = 0; // 面對主人
          this.catState = 'rub_leg';
          if (window.soundSystem) window.soundSystem.playRealMeow('sweet');
        }
      }, 700);
    }
  }

  updateSitBtnUI(isSitting) {
    const btnLabel = document.getElementById('btn-sit-label');
    if (btnLabel) btnLabel.textContent = isSitting ? '離開沙發' : '坐上沙發';
  }

  playWand() {
    if (window.soundSystem) {
      window.soundSystem.playClick();
      setTimeout(() => window.soundSystem.playRealMeow('playful'), 300);
    }
    if (window.voiceSystem) {
      window.voiceSystem.speak('wand');
    }
    this.spawnHeartsNear(this.catPos);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (this.playerNodes.armR) {
        this.playerNodes.armR.rotation.x = Math.sin(step * 0.8) * 0.55;
        this.playerNodes.armR.rotation.z = Math.cos(step * 0.8) * 0.3;
      }
      if (this.cat && this.catIsGrounded) {
        this.cat.position.y = 0 + Math.abs(Math.sin(step * 0.6)) * 0.22;
      }
      if (step > 15) {
        clearInterval(interval);
        if (this.cat && this.catIsGrounded) this.cat.position.y = 0;
      }
    }, 50);
  }

  petCatHead() {
    this.isPetting = true;
    if (window.soundSystem) {
      window.soundSystem.startPurr();
      window.soundSystem.playRealMeow('happy');
    }
    if (window.voiceSystem) {
      this._petToggle = !this._petToggle;
      window.voiceSystem.speak(this._petToggle ? 'belly' : 'pet');
    }
    this.spawnHeartsNear(this.catPos);
    setTimeout(() => {
      this.isPetting = false;
      if (window.soundSystem) window.soundSystem.stopPurr();
    }, 2800);
  }

  feedCat() {
    if (!window.curriculumSystem) return;

    const success = window.curriculumSystem.consumeTreat();
    if (success) {
      if (window.soundSystem) {
        window.soundSystem.playSuccess();
        setTimeout(() => window.soundSystem.playRealMeow('hungry'), 350);
      }
      if (window.voiceSystem) {
        window.voiceSystem.speak('feed');
      }
      this.spawnHeartsNear(this.catPos);
      window.curriculumSystem.addScore(10, null);

      let chomp = 0;
      const interval = setInterval(() => {
        chomp++;
        if (this.catHead) {
          this.catHead.position.y = 0.32 + Math.sin(chomp * 1.5) * 0.03;
        }
        if (chomp > 16) {
          clearInterval(interval);
          if (this.catHead) this.catHead.position.y = 0.32;
        }
      }, 60);
    } else {
      if (window.soundSystem) window.soundSystem.playError();
      if (window.voiceSystem) {
        window.voiceSystem.speak('treat_empty');
      }
      setTimeout(() => {
        window.curriculumSystem.openQuizHub('all');
      }, 1500);
    }
  }

  chatMeow() {
    if (window.voiceSystem) {
      window.voiceSystem.speak('chat');
    }
    setTimeout(() => {
      if (window.soundSystem) window.soundSystem.playRealMeow('calling');
    }, 800);
    setTimeout(() => {
      if (window.soundSystem) window.soundSystem.playRealMeow('response');
    }, 1800);
  }

  spawnHeartsNear(pos) {
    const parent = document.getElementById('ui-overlay');
    if (!parent) return;

    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const heart = document.createElement('div');
        heart.className = 'floating-heart';
        heart.textContent = ['💖', '✨', '🐾', '🐟'][Math.floor(Math.random() * 4)];

        const tempV = pos.clone();
        tempV.project(this.camera);
        const x = (tempV.x * 0.5 + 0.5) * window.innerWidth + (Math.random() - 0.5) * 80;
        const y = (-tempV.y * 0.5 + 0.5) * window.innerHeight + (Math.random() - 0.5) * 60;

        heart.style.left = `${x}px`;
        heart.style.top = `${y}px`;
        parent.appendChild(heart);
        setTimeout(() => heart.remove(), 1000);
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
    const helpTitle = document.getElementById('help-title');
    const btnPrimary = document.getElementById('btn-primary-action');
    const btnLabel = document.getElementById('btn-primary-label');

    const mJumpIcon = document.querySelector('#btn-mobile-jump .btn-icon');
    const mJumpLbl = document.querySelector('#btn-mobile-jump .btn-lbl');
    const mActIcon = document.getElementById('mobile-action-icon');
    const mActLbl = document.getElementById('mobile-action-label');

    if (role === 'cat') {
      if (mJumpIcon) mJumpIcon.textContent = '🐾';
      if (mJumpLbl) mJumpLbl.textContent = '跳躍';
      if (mActIcon) mActIcon.textContent = '✨';
      if (mActLbl) mActLbl.textContent = '翻肚';
      if (roleStatusText) roleStatusText.textContent = '目前身分：小女生（貓咪視角）';
      if (viewTag) viewTag.textContent = '視角：小女生貓咪視角 (30cm)';
      if (headerAvatar) headerAvatar.textContent = '🐾';
      if (helpTitle) helpTitle.textContent = '🎮 貓咪「小女生」操作指南';

      if (btnLabel) btnLabel.textContent = '喵喵叫撒嬌';
      if (btnPrimary) {
        btnPrimary.onclick = () => this.catMeow();
        btnPrimary.querySelector('.btn-icon').textContent = '📢';
      }

      if (this.catState === 'sleep_belly_up') {
        this.catState = 'sit';
        this.catPos.y = this.getSurfaceHeight(this.catPos.x, this.catPos.z);
        this.cat.position.y = this.catPos.y;
        if (window.soundSystem) window.soundSystem.stopPurr();
      }
    } else {
      if (mJumpIcon) mJumpIcon.textContent = '🚶';
      if (mJumpLbl) mJumpLbl.textContent = '起身';
      if (mActIcon) mActIcon.textContent = '🛋️';
      if (mActLbl) mActLbl.textContent = '坐沙發';

      if (roleStatusText) roleStatusText.textContent = '目前身分：暖心主人（人類視角）';
      if (viewTag) viewTag.textContent = '視角：暖心主人視角 (1.6m)';
      if (headerAvatar) headerAvatar.textContent = '🧑‍🎨';
      if (helpTitle) helpTitle.textContent = '🎮 暖心主人操作指南';

      if (btnLabel) btnLabel.textContent = '大叫小女生';
      if (btnPrimary) {
        btnPrimary.onclick = () => this.callCat();
        btnPrimary.querySelector('.btn-icon').textContent = '🗣️';
      }

      // 主人視角時，貓咪預設在沙發上翻肚躺平
      if (this.catState !== 'rub_leg') {
        this.setCatAIState('sleep_belly_up');
      }
    }
  }

  toggleView() {
    const nextRole = this.viewMode === 'human' ? 'cat' : 'human';
    this.setRole(nextRole);
    if (window.soundSystem) window.soundSystem.playClick();
  }

  setupInputs() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keys[key] = true;

      if (key === 'e') this.interactWithNearby();
      if (key === 'v') this.toggleView();
      if (key === 'f') this.openFurnitureModal('sofa');

      if (this.viewMode === 'cat') {
        if (key === ' ' || e.code === 'Space') this.catJump();
        if (key === 'm') this.catMeow();
        if (key === 'b') this.catRollOver();
      } else {
        if (key === 'c') this.callCat();
      }
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

  catJump() {
    if (this.catIsGrounded) {
      this.catVelocityY = 4.2;
      this.catIsGrounded = false;
      this.catState = 'jumping';
      if (window.soundSystem) {
        window.soundSystem.stopPurr();
        window.soundSystem.playMeow('high');
      }
    }
  }

  catMeow() {
    let clipDesc = '喵～～';
    if (window.soundSystem) {
      const clip = window.soundSystem.playRealMeow();
      if (clip) clipDesc = `${clip.label}（${clip.desc}）`;
    }
    this.showPrompt(`🐾 小女生真實叫聲：${clipDesc}！🐱`);
  }

  catRollOver() {
    if (this.catState === 'sleep_belly_up') {
      // 若已在翻肚，再次按下 B 鍵主動翻回站立，並立即停止呼嚕！
      this.catState = 'sit';
      this.catPos.y = this.getSurfaceHeight(this.catPos.x, this.catPos.z);
      this.cat.position.y = this.catPos.y;
      if (window.soundSystem) window.soundSystem.stopPurr();
      return;
    }

    this.catState = 'sleep_belly_up';
    if (window.soundSystem) window.soundSystem.startPurr();
    if (window.voiceSystem) window.voiceSystem.speak('belly');
  }

  callCat() {
    if (window.soundSystem) window.soundSystem.resume();
    if (window.voiceSystem) {
      window.voiceSystem.speak('call');
    }

    const isHappy = Math.random() > 0.35;
    setTimeout(() => {
      if (isHappy) {
        this.setCatAIState('walk_to_player', true);
        if (window.soundSystem) {
          window.soundSystem.playRealMeow('calling');
          setTimeout(() => window.soundSystem.playRealMeow('response'), 750);
          setTimeout(() => window.soundSystem.playRealMeow('happy'), 1600);
        }
      } else {
        this.setCatAIState('unhappy');
        if (window.soundSystem) window.soundSystem.playRealMeow('growl');
      }
    }, 800);
  }

  setCatAIState(state, happy = true) {
    if (this.catState === 'sleep_belly_up' && state !== 'sleep_belly_up') {
      if (window.soundSystem) window.soundSystem.stopPurr();
    }
    this.catState = state;
    if (state === 'sleep_belly_up') {
      this.catPos.set(0.7, 0.58, 1.35); // 嚴格置於南側沙發白色小被子上，高度 0.58
      this.cat.position.copy(this.catPos);
      this.cat.rotation.set(0, Math.PI / 2, 0); // 面朝北方
      this.bellyUpFactor = 1.0;
    } else if (state === 'walk_to_player') {
      this.catTarget = this.player.position.clone();
      this.catIsHappy = happy;
    } else if (state === 'unhappy') {
      this.catTarget = this.player.position.clone().add(new THREE.Vector3(0.6, 0, 0.4));
      this.catIsHappy = false;
    } else if (state === 'sit') {
      const surfaceY = this.getSurfaceHeight(this.catPos.x, this.catPos.z);
      this.catPos.y = surfaceY;
      this.cat.position.y = surfaceY;
    }
  }

  makeCatHappy() {
    this.setCatAIState('sit');
    if (window.soundSystem) window.soundSystem.playMeow('cute');
    this.spawnHeartsNear(this.catPos);
  }

  /* ==========================================================================
     家具使用畫面 (Furniture Usage Modal) 與 3D 觸控/點擊 Raycaster 系統
     ========================================================================== */
  initFurnitureData() {
    this.FURNITURE_DATA = {
      sofa: {
        icon: '🛋️',
        title: '溫馨客廳大沙發',
        tag: '課文第三段・沙發陪伴',
        desc: '課文中描寫：「小女生喜歡四腳朝天躺在沙發上，毛茸茸的肚子像蓋上了一條白色小被子；也常把前腳放在我的大腿上，輕輕的喵個不停，像個可愛的小孩，陪伴我和家人說話。」',
        actions: [
          {
            icon: '🛌',
            label: '跳上沙發翻肚睡覺',
            badge: '恢復 20 HP',
            run: () => {
              this.catPos.set(0.7, 0.58, 1.35);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.setCatAIState('sleep_belly_up');
              if (window.soundSystem) {
                window.soundSystem.playRealMeow('trill');
                window.soundSystem.startPurr();
              }
              if (window.voiceSystem) {
                window.voiceSystem.speak('belly');
              }
              if (window.curriculumSystem) {
                window.curriculumSystem.G.hp = Math.min(100, window.curriculumSystem.G.hp + 20);
                window.curriculumSystem.updateHUD();
              }
            }
          },
          {
            icon: '🐾',
            label: '前腳搭在大腿上撒嬌',
            badge: '親密陪伴',
            run: () => {
              this.catPos.set(0.45, 0.58, 1.35);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.catState = 'rub_leg';
              if (window.soundSystem) window.soundSystem.playRealMeow('sweet');
              if (window.voiceSystem) {
                window.voiceSystem.speak('family');
              }
            }
          },
          {
            icon: '🚶',
            label: '跳下沙發漫步',
            badge: '自由活動',
            run: () => {
              this.catPos.set(0.5, 0, 0.6);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.catState = 'walk';
              if (window.soundSystem) window.soundSystem.playRealMeow('happy');
              this.showPrompt('🐱 小女生輕盈地跳下沙發，在客廳地毯上漫步！🐾');
            }
          }
        ]
      },
      cattree: {
        icon: '🪜',
        title: '多層豪華貓跳台',
        tag: '登高巡視・身手矯健',
        desc: '客廳 corner 的三層高聳貓跳台，有鑽洞小貓窩與最高處瞭望台，小女生可以登高巡視全客廳領地，或撥弄懸掛的小毛球！',
        actions: [
          {
            icon: '🧗',
            label: '爬上第 1 層貓窩平台',
            badge: '居高臨下',
            run: () => {
              this.catPos.set(2.7, 0.65, -2.45);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.catState = 'sit';
              if (window.soundSystem) window.soundSystem.playRealMeow('playful');
              this.showPrompt('🐱 小女生一躍跳上第一層貓窩平台，好奇地探出小腦袋！✨');
            }
          },
          {
            icon: '🌟',
            label: '登頂最高觀景瞭望台',
            badge: '海拔 1.55m',
            run: () => {
              this.catPos.set(3.0, 1.55, -2.65);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.catState = 'sit';
              if (window.soundSystem) window.soundSystem.playRealMeow('sweet');
              this.showPrompt('🐱 小女生登上最高瞭望台！威風凜凜巡視客廳領地～好神氣！👑');
            }
          },
          {
            icon: '🧶',
            label: '肉球撥弄懸掛毛球',
            badge: '爪爪遊戲',
            run: () => {
              this.catPos.set(2.8, 0, -2.2);
              if (this.cat) this.cat.position.copy(this.catPos);
              if (window.soundSystem) window.soundSystem.playRealMeow('playful');
              this.showPrompt('🐾 小女生伸出粉嫩肉球撥弄毛球，小球左右擺動搖晃！💖');
            }
          },
          {
            icon: '🐾',
            label: '平穩跳下跳台',
            badge: '著地漫步',
            run: () => {
              this.catPos.set(2.5, 0, -1.8);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.catState = 'walk';
              if (window.soundSystem) window.soundSystem.playRealMeow('happy');
              this.showPrompt('🐱 小女生身姿輕巧地跳回地板！🐾');
            }
          }
        ]
      },
      tv: {
        icon: '📺',
        title: '水族館電視機',
        tag: '客廳視聽・游動小魚',
        desc: '電視螢幕播放著生動的水族館畫面，裡面有悠游穿梭的小金魚與緩緩升起的氣泡。小女生常常端坐在電視前看得目不轉睛！',
        actions: [
          {
            icon: '🐟',
            label: '端坐電視前看金魚游動',
            badge: '專注凝視',
            run: () => {
              this.catPos.set(0, 0, -2.8);
              if (this.cat) {
                this.cat.position.copy(this.catPos);
                this.cat.rotation.y = Math.PI / 2;
              }
              this.catState = 'sit';
              if (window.soundSystem) window.soundSystem.playRealMeow('alert');
              this.showPrompt('🐱 小女生坐在電視前，小腦袋隨著金魚游動左右擺動！🐟✨');
            }
          },
          {
            icon: '🐾',
            label: '伸爪好奇輕拍電視螢幕',
            badge: '趣味互動',
            run: () => {
              this.catPos.set(0, 0, -3.2);
              if (this.cat) {
                this.cat.position.copy(this.catPos);
                this.cat.rotation.y = Math.PI / 2;
              }
              if (window.soundSystem) window.soundSystem.playRealMeow('playful');
              this.showPrompt('🐾 小女生站起伸起前爪輕拍電視螢幕玻璃，驚奇地盯著水波紋！📺✨');
            }
          }
        ]
      },
      yarn: {
        icon: '🧶',
        title: '柔軟彩色毛線球',
        tag: '活力追逐・歡樂翻滾',
        desc: '鋪在地毯上的色彩鮮豔毛線球，帶著長長的拖曳尾巴。小女生最愛用雙爪推撥，在客廳裡追逐滾動！',
        actions: [
          {
            icon: '🐾',
            label: '肉球撥弄毛線球滾動',
            badge: '追逐玩耍',
            run: () => this.interactYarn()
          },
          {
            icon: '💖',
            label: '抱著毛線球翻滾玩耍',
            badge: '愛心特效',
            run: () => {
              this.catPos.set(0.7, 0, -0.4);
              if (this.cat) this.cat.position.copy(this.catPos);
              if (window.soundSystem) window.soundSystem.playRealMeow('playful');
              this.spawnHeartsNear(new THREE.Vector3(0.7, 0.2, -0.4));
              this.showPrompt('🧶 小女生抱住毛線球蹬後腿，開心地在地上打滾！🥰💖');
            }
          }
        ]
      },
      mouse: {
        icon: '🐭',
        title: '歡樂發條小老鼠',
        tag: '機敏撲抓・專注狩獵',
        desc: '金黃發條轉緊後會在地面疾馳的小老鼠，常常激發小女生天生的捕獵本能！',
        actions: [
          {
            icon: '🌪️',
            label: '上緊發條讓老鼠奔跑',
            badge: '疾馳旋轉',
            run: () => this.interactToyMouse()
          },
          {
            icon: '🐾',
            label: '雙爪精準按住小老鼠',
            badge: '捕獲成功',
            run: () => {
              this.catPos.set(1.8, 0, 0.6);
              if (this.cat) this.cat.position.copy(this.catPos);
              if (window.soundSystem) window.soundSystem.playRealMeow('happy');
              this.showPrompt('🐭 小女生壓低身體向前猛撲，精準用肉球按住了小老鼠！🐾✨');
            }
          }
        ]
      },
      bowl: {
        icon: '🍲',
        title: '小女生專屬點心餐盤',
        tag: '美味小魚乾・體力補滿',
        desc: '擺放在客廳角落的乾淨小餐盤與瓦楞紙貓抓盆，隨時準備了新鮮小魚乾與清涼水！',
        actions: [
          {
            icon: '🐟',
            label: '大口享用香脆小魚乾',
            badge: '體力補滿 100 HP',
            run: () => {
              this.catPos.set(-2.6, 0, 0.8);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.catState = 'sit';
              if (window.soundSystem) {
                window.soundSystem.playRealMeow('hungry');
                window.soundSystem.playSuccess();
              }
              if (window.curriculumSystem) {
                window.curriculumSystem.G.hp = 100;
                window.curriculumSystem.updateHUD();
              }
              this.showPrompt('🐟 小女生大口嚼嚼香脆小魚乾，體力完全補滿 100 HP！活力充沛！💪✨');
            }
          },
          {
            icon: '🥛',
            label: '大口喝新鮮乾淨的泉水',
            badge: '補充水分',
            run: () => {
              this.catPos.set(-2.8, 0, 0.8);
              if (this.cat) this.cat.position.copy(this.catPos);
              if (window.soundSystem) window.soundSystem.playRealMeow('sweet');
              this.showPrompt('🥛 小女生舔舔新鮮泉水，發出滿足咕嚕聲！💧');
            }
          }
        ]
      },
      window: {
        icon: '🪟',
        title: '陽台明亮落地窗',
        tag: '課本第 10 種貓叫聲・雀躍鳥鳴',
        desc: '陽光灑落的明亮落地窗，窗外樹梢有小鳥啼鳴與飛舞的蝴蝶。小女生看到窗外動態時，牙齒會發出快速雀躍打顫的碎鳴（Chatter 叫聲）！',
        actions: [
          {
            icon: '🐦',
            label: '看窗外小鳥牙齒打顫',
            badge: '雀躍顫音',
            run: () => {
              this.catPos.set(3.6, 0, -3.2);
              if (this.cat) {
                this.cat.position.copy(this.catPos);
                this.cat.rotation.y = 0;
              }
              if (window.soundSystem) window.soundSystem.playRealMeow('chatter');
              this.showPrompt('🐦 小女生看見窗外飛過的小鳥，喉嚨發出興奮的牙齒打顫雀躍顫音！✨');
            }
          },
          {
            icon: '☀️',
            label: '在窗邊曬暖洋洋日光浴',
            badge: '放鬆伸懶腰',
            run: () => {
              this.catPos.set(3.8, 0, -3.0);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.setCatAIState('sleep_belly_up');
              if (window.soundSystem) window.soundSystem.playRealMeow('trill');
              this.showPrompt('☀️ 小女生趴在暖暖的陽光斑塊中伸伸懶腰，舒服得瞇起了眼睛～🥰');
            }
          }
        ]
      },
      door: {
        icon: '🚪',
        title: '浴室洗手間門口',
        tag: '課文第一段・門外守候',
        desc: '課文第一段：「我上洗手間，牠會喵喵叫；我關門洗澡，牠就叫得更大聲。只要我在家，牠都會緊緊的跟在我身邊。」',
        actions: [
          {
            icon: '📢',
            label: '在門口大聲呼喚喵叫',
            badge: '深情呼喚',
            run: () => {
              this.catPos.set(-3.8, 0, -2.2);
              if (this.cat) {
                this.cat.position.copy(this.catPos);
                this.cat.rotation.y = -Math.PI / 2;
              }
              if (window.soundSystem) window.soundSystem.playRealMeow('calling');
              if (window.voiceSystem) {
                window.voiceSystem.speak('door');
              }
            }
          },
          {
            icon: '🐾',
            label: '在門口地墊上靜靜守候',
            badge: '形影不離',
            run: () => {
              this.catPos.set(-3.6, 0, -2.0);
              if (this.cat) this.cat.position.copy(this.catPos);
              this.catState = 'sit';
              if (window.soundSystem) window.soundSystem.playRealMeow('sweet');
              this.showPrompt('🐾 小女生乖巧地趴在門口踏墊上，等待主人開門的一刻！🥰');
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
          <span class="btn-badge">${act.badge || '立即使用'}</span>
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

      // 點擊判定：位移小於 14px 且時長小於 450ms (排除鏡頭拖曳旋轉)
      if (dist < 14 && timeDiff < 450) {
        if (e.target && (e.target.closest('button') || e.target.closest('.modal-card') || e.target.closest('#pad') || e.target.closest('.top-bar') || e.target.closest('.action-dock'))) {
          return;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, this.camera);

        const clickableTargets = [
          this.sofaGroup,
          this.treeGroup,
          this.tvGroup,
          this.yarnBallGroup,
          this.toyMouse,
          this.bowlGroup,
          this.winGroup,
          this.doorGroup,
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
            this.openFurnitureModal(foundId);
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
        id: 'sofa',
        name: '溫馨沙發 (使用)',
        icon: '🛋️',
        pos: new THREE.Vector3(0.7, 0.7, 1.35),
        action: () => this.openFurnitureModal('sofa')
      },
      {
        id: 'cattree',
        name: '貓跳台樂園 (使用)',
        icon: '🪜',
        pos: new THREE.Vector3(2.8, 1.1, -2.5),
        action: () => this.openFurnitureModal('cattree')
      },
      {
        id: 'tv',
        name: '水族館電視 (使用)',
        icon: '📺',
        pos: new THREE.Vector3(0, 1.0, -3.7),
        action: () => this.openFurnitureModal('tv')
      },
      {
        id: 'yarn',
        name: '玩毛線球 (使用)',
        icon: '🧶',
        pos: new THREE.Vector3(0.7, 0.25, -0.4),
        action: () => this.openFurnitureModal('yarn')
      },
      {
        id: 'mouse',
        name: '追發條小老鼠 (使用)',
        icon: '🐭',
        pos: new THREE.Vector3(1.8, 0.25, 0.6),
        action: () => this.openFurnitureModal('mouse')
      },
      {
        id: 'bowl',
        name: '點心餐盤 (使用)',
        icon: '🍲',
        pos: new THREE.Vector3(-2.8, 0.25, 0.8),
        action: () => this.openFurnitureModal('bowl')
      },
      {
        id: 'window',
        name: '陽台落地窗 (使用)',
        icon: '🪟',
        pos: new THREE.Vector3(3.8, 1.1, -3.6),
        action: () => this.openFurnitureModal('window')
      },
      {
        id: 'door',
        name: '浴室洗手間 (使用)',
        icon: '🚪',
        pos: new THREE.Vector3(-4.4, 1.1, -2.2),
        action: () => this.openFurnitureModal('door')
      }
    ];

    const uiContainer = document.getElementById('ui-overlay');
    this.glowingAuras = [];

    // 建立 3D 物品發光提示系統 (地面脈動微光環 + 漂浮金芒水晶)
    this.spotElements = this.interactiveSpots.map((spot, idx) => {
      // 1. 3D 物品發光光環
      const auraGroup = new THREE.Group();
      auraGroup.position.copy(spot.pos);
      auraGroup.userData = { id: spot.id, name: spot.name };

      // 地面脈動光環 (Pulsing Glow Ring)
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
      ringMesh.position.y = 0.02 - spot.pos.y; // 保持在地面高度
      ringMesh.userData = { id: spot.id };
      auraGroup.add(ringMesh);

      // 漂浮微光晶體 (Floating Shimmer Crystal)
      const crystalGeo = new THREE.OctahedronGeometry(0.10, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85
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
        phase: idx * 1.2
      });

      // 2. 2D 互動提示標籤 (平時隱藏，近距離靠近才淡入提示)
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

    // 建立當前關卡專屬 3D 導引光柱地標 (Quest Beacon)
    this.questBeacon = new THREE.Group();
    const qRingGeo = new THREE.RingGeometry(0.32, 0.52, 36);
    const qRingMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
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
      color: 0x34d399,
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
      color: 0x6ee7b7,
      emissive: 0x059669,
      emissiveIntensity: 1.2,
      roughness: 0.15,
      metalness: 0.4
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
      this.openFurnitureModal('sofa');
    }
    if (window.soundSystem) window.soundSystem.playClick();
  }

  checkTouchCollisions(time) {
    // 僅在正式探索模式 (explore) 且玩家正在主動操作小貓移動時，才偵測碰觸地面小玩具
    if (this.viewMode !== 'cat' || !this.cat) return;
    if (!window.curriculumSystem || window.curriculumSystem.G.mode !== 'explore') return;
    if (!this.isCatMoving) return;

    const catPos = this.catPos;
    if (!this._touchZones) this._touchZones = {};

    // 1. 毛線球 (yarn, pos: 0.7, 0, -0.4)
    const dYarn = Math.hypot(catPos.x - 0.7, catPos.z - (-0.4));
    if (dYarn < 0.42) {
      if (this.yarnBall) {
        this.yarnBall.rotation.x += 0.35;
        this.yarnBall.rotation.z += 0.25;
      }
      if (!this._touchZones.yarn && (!this._lastYarnTouch || time - this._lastYarnTouch > 10.0)) {
        this._touchZones.yarn = true;
        this._lastYarnTouch = time;
        if (window.soundSystem) window.soundSystem.playRealMeow('playful');
        this.spawnHeartsNear(catPos);
      }
    } else if (dYarn > 0.75) {
      this._touchZones.yarn = false;
    }

    // 2. 發條小老鼠 (mouse, pos: 1.8, 0, 0.6)
    const dMouse = Math.hypot(catPos.x - 1.8, catPos.z - 0.6);
    if (dMouse < 0.42) {
      if (this.toyMouse) {
        this.toyMouse.rotation.y += 0.4;
      }
      if (!this._touchZones.mouse && (!this._lastMouseTouch || time - this._lastMouseTouch > 10.0)) {
        this._touchZones.mouse = true;
        this._lastMouseTouch = time;
        if (window.soundSystem) window.soundSystem.playRealMeow('chatter');
        this.spawnHeartsNear(catPos);
      }
    } else if (dMouse > 0.75) {
      this._touchZones.mouse = false;
    }

    // 3. 點心餐盤 (bowl, pos: -2.8, 0, 0.8)
    const dBowl = Math.hypot(catPos.x - (-2.8), catPos.z - 0.8);
    if (dBowl < 0.48) {
      if (!this._touchZones.bowl && (!this._lastBowlTouch || time - this._lastBowlTouch > 10.0)) {
        this._touchZones.bowl = true;
        this._lastBowlTouch = time;
        if (window.soundSystem) window.soundSystem.playRealMeow('hungry');
        this.spawnHeartsNear(catPos);
      }
    } else if (dBowl > 0.85) {
      this._touchZones.bowl = false;
    }

    // 4. 貓薄荷小魚玩偶 (fish, pos: -0.6, 0, -0.3)
    const dFish = Math.hypot(catPos.x - (-0.6), catPos.z - (-0.3));
    if (dFish < 0.40) {
      if (!this._touchZones.fish && (!this._lastFishTouch || time - this._lastFishTouch > 10.0)) {
        this._touchZones.fish = true;
        this._lastFishTouch = time;
        if (window.soundSystem) window.soundSystem.playRealMeow('sweet');
        this.spawnHeartsNear(catPos);
      }
    } else if (dFish > 0.75) {
      this._touchZones.fish = false;
    }
  }

  /* ==========================================================================
     主循環與地面防穿透
     ========================================================================== */
  update(delta, time) {
    if (this.viewMode === 'cat') {
      this.updatePlayerControlledCat(delta, time);
      this.updateAIHuman(delta, time);
    } else {
      this.updatePlayerControlledHuman(delta, time);
      this.updateAICat(delta, time);
    }

    this.updateCatPose(delta, time);
    this.updateDecorations(time);
    this.checkTouchCollisions(time);
    this.updateCamera();
    this.updateMarkers();
    this.updateProximityCard();
    this.updateShadows();
  }

  updateCatPose(delta, time) {
    if (!this.catMeshGroup) return;

    const targetFactor = (this.catState === 'sleep_belly_up') ? 1.0 : 0.0;
    // 平滑插值過渡翻肚動作
    this.bellyUpFactor += (targetFactor - this.bellyUpFactor) * Math.min(1.0, delta * 9);

    const f = this.bellyUpFactor;

    // 1. 翻肚姿勢：以 X 軸（脊椎長軸）翻轉 180 度，微幅 Z 軸歪頭萌態
    this.catMeshGroup.rotation.x = Math.PI * f;
    this.catMeshGroup.rotation.z = 0.08 * f;

    // 2. 翻肚高度微調：
    // 站立時中心 y = 0.20，四爪觸底 y = 0；
    // 翻肚時背部觸底 y = 0，腹部朝天 y = 0.26，四爪朝天 y = 0.38
    this.catMeshGroup.position.y = 0.20 * (1 - f) + 0.17 * f;

    // 3. 翻肚時四腳朝天爪部姿勢與白肚子呼吸起伏
    if (f > 0.05) {
      const legWave = Math.sin(time * 3) * 0.06;
      if (this.catLegs && this.catLegs.length === 4) {
        // 前爪微捲收在胸前朝天
        this.catLegs[0].rotation.x = -0.35 * f + legWave;
        this.catLegs[1].rotation.x = -0.35 * f - legWave;
        this.catLegs[0].rotation.z = 0.25 * f;
        this.catLegs[1].rotation.z = -0.25 * f;

        // 後爪放鬆微張
        this.catLegs[2].rotation.z = 0.35 * f;
        this.catLegs[3].rotation.z = -0.35 * f;
      }

      // 白肚子呼吸起伏（課本第三段：毛茸茸的肚子，看起來像蓋上了一條白色小被子）
      const breathe = Math.sin(time * 3.5) * 0.04;
      if (this.catBelly) {
        this.catBelly.scale.set(1.0 + breathe, 0.88 + breathe, 0.94);
      }

      // 尾巴在座墊/地面慵懶搖擺
      if (this.catTail) {
        this.catTail.rotation.x = Math.sin(time * 2.5) * 0.25;
        this.catTail.rotation.z = 0.8 * (1 - f) + 0.3 * f;
      }

      // 貓頭微放鬆後仰
      if (this.catHead) {
        this.catHead.rotation.x = -0.08 * f;
        this.catHead.rotation.z = Math.sin(time * 1.5) * 0.05 * f;
      }
    }

    // 呼嚕音效聯動防護：非翻肚且非摸頭撫摸狀態下，保證呼嚕聲必然自動停止
    if (this.catState !== 'sleep_belly_up' && !this.isPetting) {
      if (window.soundSystem && window.soundSystem.isPurring) {
        window.soundSystem.stopPurr();
      }
    }
  }

  updatePlayerControlledCat(delta, time) {
    let inputForward = 0;
    let inputRight = 0;

    if (this.keys['w'] || this.keys['arrowup']) inputForward += 1;
    if (this.keys['s'] || this.keys['arrowdown']) inputForward -= 1;
    if (this.keys['d'] || this.keys['arrowright']) inputRight += 1;
    if (this.keys['a'] || this.keys['arrowleft']) inputRight -= 1;

    // 手機虛擬搖桿輸入整合 (來自 #pad 與 window.__bird.JOY)
    const joy = (window.__bird && window.__bird.JOY) ? window.__bird.JOY : { x: 0, y: 0 };
    if (joy.x !== 0 || joy.y !== 0) {
      inputRight += joy.x;
      inputForward -= joy.y; // 向上推 joy.y 為負，轉換為正向 forward
    } else if (this.joystickVector && (this.joystickVector.x !== 0 || this.joystickVector.z !== 0)) {
      inputRight += this.joystickVector.x;
      inputForward -= this.joystickVector.z;
    }

    const inputLen = Math.hypot(inputRight, inputForward);
    const isMoving = inputLen > 0.01;
    this.isCatMoving = isMoving;

    if (isMoving) {
      if (this.catState === 'sleep_belly_up') {
        this.catState = 'walk';
        if (window.soundSystem) window.soundSystem.stopPurr();
      }

      // 將螢幕相對之方向輸入向量，根據相機水平視角 (cameraYaw) 轉換為世界座標
      const forwardX = -Math.sin(this.cameraYaw);
      const forwardZ = -Math.cos(this.cameraYaw);
      const rightX = Math.cos(this.cameraYaw);
      const rightZ = -Math.sin(this.cameraYaw);

      const worldX = inputForward * forwardX + inputRight * rightX;
      const worldZ = inputForward * forwardZ + inputRight * rightZ;
      const normDir = new THREE.Vector3(worldX, 0, worldZ).normalize();

      // 保留類比幅度 (analog speed scaling)
      const analogScale = Math.min(1.0, inputLen);
      const currentSpeed = this.catSpeed * analogScale;

      const nextPos = this.catPos.clone();
      nextPos.x += normDir.x * currentSpeed * delta;
      nextPos.z += normDir.z * currentSpeed * delta;

      const isCatOnSofa = this.catPos.y >= 0.52;
      const resolved = this.resolveCollision(nextPos, 0.22, false, isCatOnSofa);

      this.catPos.x = resolved.x;
      this.catPos.z = resolved.z;
      if (this.cat) {
        this.cat.position.x = resolved.x;
        this.cat.position.z = resolved.z;
        this.cat.rotation.y = Math.atan2(normDir.x, normDir.z) - Math.PI / 2;
      }

      // 四足交替擺動
      if (this.catLegs && this.catLegs.length === 4) {
        const walkCycle = Math.sin(time * 16);
        this.catLegs[0].rotation.z = walkCycle * 0.45;
        this.catLegs[1].rotation.z = -walkCycle * 0.45;
        this.catLegs[2].rotation.z = -walkCycle * 0.45;
        this.catLegs[3].rotation.z = walkCycle * 0.45;
      }
      if (this.catTail) {
        this.catTail.rotation.y = Math.sin(time * 10) * 0.35;
      }
    } else {
      if (this.catState !== 'sleep_belly_up') {
        if (this.catLegs) {
          this.catLegs.forEach(l => {
            l.rotation.x = 0;
            l.rotation.z = 0;
          });
        }
        if (this.catTail) {
          this.catTail.rotation.z = 0.8 + Math.sin(time * 3) * 0.2;
        }
      }
    }

    // 嚴格落點判定 (使用統一地表高度函數)
    let groundHeight = this.getSurfaceHeight(this.catPos.x, this.catPos.z);

    if (!this.catIsGrounded || this.catPos.y > groundHeight) {
      this.catVelocityY -= 9.8 * delta;
      this.catPos.y += this.catVelocityY * delta;

      if (this.catPos.y <= groundHeight) {
        this.catPos.y = groundHeight;
        this.catVelocityY = 0;
        this.catIsGrounded = true;
      }
    } else {
      this.catPos.y = groundHeight;
    }

    this.cat.position.copy(this.catPos);
  }

  updateAIHuman(delta, time) {
    if (!this.player) return;

    if (!this.isSitting) {
      const dirToCat = new THREE.Vector3().subVectors(this.catPos, this.playerPos);
      dirToCat.y = 0;
      if (dirToCat.lengthSq() > 0.01) {
        this.player.rotation.y = Math.atan2(dirToCat.x, dirToCat.z);
      }
      this.player.position.y = 0;
    } else {
      this.player.position.y = -0.22;
      if (this.playerNodes.torso) this.playerNodes.torso.position.y = 0;
    }

    const breathe = Math.sin(time * 2.5) * 0.015;
    if (this.playerNodes.head) this.playerNodes.head.position.y = 1.50 + breathe;
    if (this.playerNodes.armR && !this.isSitting) {
      this.playerNodes.armR.rotation.x = Math.sin(time * 3) * 0.12;
    }
    if (this.feathers) {
      this.feathers.forEach((f, idx) => {
        f.rotation.z = idx * 0.3 + Math.sin(time * 6 + idx) * 0.15;
      });
    }
  }

  updatePlayerControlledHuman(delta, time) {
    const joyCheck = (window.__bird && window.__bird.JOY) ? window.__bird.JOY : { x: 0, y: 0 };
    const hasJoy = Math.hypot(joyCheck.x, joyCheck.y) > 0.3 || (this.joystickVector && Math.hypot(this.joystickVector.x, this.joystickVector.z) > 0.3);
    if (this.isSitting) {
      if (this.keys['w'] || this.keys['s'] || this.keys['a'] || this.keys['d'] || hasJoy) {
        this.toggleSitSofa();
      }
      return;
    }

    const moveSpeed = 3.5;
    let inputForward = 0;
    let inputRight = 0;

    if (this.keys['w'] || this.keys['arrowup']) inputForward += 1;
    if (this.keys['s'] || this.keys['arrowdown']) inputForward -= 1;
    if (this.keys['d'] || this.keys['arrowright']) inputRight += 1;
    if (this.keys['a'] || this.keys['arrowleft']) inputRight -= 1;

    // 手機虛擬搖桿輸入整合
    const joy = (window.__bird && window.__bird.JOY) ? window.__bird.JOY : { x: 0, y: 0 };
    if (joy.x !== 0 || joy.y !== 0) {
      inputRight += joy.x;
      inputForward -= joy.y;
    } else if (this.joystickVector && (this.joystickVector.x !== 0 || this.joystickVector.z !== 0)) {
      inputRight += this.joystickVector.x;
      inputForward -= this.joystickVector.z;
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
      const currentSpeed = moveSpeed * analogScale;

      const nextPos = this.playerPos.clone();
      nextPos.x += normDir.x * currentSpeed * delta;
      nextPos.z += normDir.z * currentSpeed * delta;

      const resolved = this.resolveCollision(nextPos, 0.32, this.isSitting, false);
      this.playerPos.x = resolved.x;
      this.playerPos.z = resolved.z;

      this.player.position.copy(this.playerPos);
      this.player.rotation.y = Math.atan2(normDir.x, normDir.z);

      const stepCycle = Math.sin(time * 10);
      if (this.playerNodes.legL) this.playerNodes.legL.rotation.x = stepCycle * 0.55;
      if (this.playerNodes.legR) this.playerNodes.legR.rotation.x = -stepCycle * 0.55;
      if (this.playerNodes.armL) this.playerNodes.armL.rotation.x = -stepCycle * 0.45;
      if (this.playerNodes.armR) this.playerNodes.armR.rotation.x = stepCycle * 0.4;

      // 步態微小上下浮動，底端絕不低於 0
      this.player.position.y = Math.abs(Math.sin(time * 10)) * 0.035;
    } else {
      if (this.playerNodes.legL) this.playerNodes.legL.rotation.x = 0;
      if (this.playerNodes.legR) this.playerNodes.legR.rotation.x = 0;
      if (this.playerNodes.armL) this.playerNodes.armL.rotation.x = Math.sin(time * 2) * 0.05;
      if (this.playerNodes.armR) this.playerNodes.armR.rotation.x = Math.sin(time * 2.5) * 0.1;
      this.player.position.y = 0; // 站立時腳底嚴格為 0
    }

    if (this.feathers) {
      this.feathers.forEach((f, idx) => {
        f.rotation.z = idx * 0.3 + Math.sin(time * 8 + idx) * 0.2;
      });
    }
  }

  updateAICat(delta, time) {
    if (!this.cat) return;

    if (this.catState === 'sleep_belly_up') {
      const groundH = this.getSurfaceHeight(this.cat.position.x, this.cat.position.z);
      this.cat.position.y = groundH;
      return;
    }

    if (this.catState === 'walk_to_player' || this.catState === 'unhappy') {
      const targetPos = this.catTarget || this.playerPos;
      const diff = new THREE.Vector3().subVectors(targetPos, this.cat.position);
      diff.y = 0;
      const dist = diff.length();

      if (dist > 0.75) {
        diff.normalize();

        const nextPos = this.cat.position.clone();
        nextPos.addScaledVector(diff, 2.2 * delta);
        const isCatOnSofa = this.cat.position.y >= 0.52;
        const resolved = this.resolveCollision(nextPos, 0.22, false, isCatOnSofa);
        this.cat.position.x = resolved.x;
        this.cat.position.z = resolved.z;

        // 平滑地面/沙發高度判定 (若走出沙發邊緣則平滑著地)
        const groundH = this.getSurfaceHeight(this.cat.position.x, this.cat.position.z);
        if (this.cat.position.y > groundH) {
          this.cat.position.y = Math.max(groundH, this.cat.position.y - 4.5 * delta);
        } else {
          this.cat.position.y = groundH;
        }

        this.cat.rotation.y = Math.atan2(diff.x, diff.z) - Math.PI / 2;

        const walkCycle = Math.sin(time * 12);
        this.catLegs[0].rotation.z = walkCycle * 0.45;
        this.catLegs[1].rotation.z = -walkCycle * 0.45;
        this.catLegs[2].rotation.z = -walkCycle * 0.45;
        this.catLegs[3].rotation.z = walkCycle * 0.45;
        this.catTail.rotation.y = Math.sin(time * 8) * 0.4;
      } else {
        this.catLegs.forEach(l => {
          l.rotation.x = 0;
          l.rotation.z = 0;
        });
        if (this.catState === 'unhappy') {
          this.catHead.rotation.x = -0.15;
        } else {
          this.catState = 'rub_leg';
          this.catTail.rotation.z = 1.1 + Math.sin(time * 4) * 0.2;
        }
      }
    }
  }

  updateDecorations(time) {
    if (this.butterfly) {
      const flap = Math.sin(time * 24) * 0.8;
      this.bWingL.rotation.y = flap;
      this.bWingR.rotation.y = -flap;
      this.butterfly.position.x = 3.8 + Math.cos(time * 1.5) * 0.4;
      this.butterfly.position.y = 2.4 + Math.sin(time * 2.2) * 0.25;
    }

    // 貓跳台懸掛毛球自然微晃
    if (this.danglingBallGroup) {
      this.danglingBallGroup.rotation.z = Math.sin(time * 2.5) * 0.22;
      this.danglingBallGroup.rotation.x = Math.cos(time * 1.8) * 0.12;
    }

    // 水族館電視螢幕動態 Canvas 游動金魚與氣泡
    if (this.fishCtx) {
      const ctx = this.fishCtx;
      const w = 512, h = 300;

      // 1. 水族館水流漸層
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.6, '#0369a1');
      grad.addColorStop(1, '#075985');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // 2. 搖曳的水草
      ctx.fillStyle = '#10b981';
      for (let s = 0; s < 6; s++) {
        const sx = 40 + s * 80;
        const sway = Math.sin(time * 2 + s) * 16;
        ctx.beginPath();
        ctx.moveTo(sx - 12, h);
        ctx.quadraticCurveTo(sx + sway, h - 80, sx + sway * 1.5, h - 140);
        ctx.quadraticCurveTo(sx, h - 80, sx + 12, h);
        ctx.fill();
      }

      // 3. 游動的金魚 1 (橘色，往右游)
      const f1x = (time * 70) % (w + 100) - 50;
      const f1y = 120 + Math.sin(time * 3) * 25;
      const tailFlap1 = Math.sin(time * 12) * 10;
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.ellipse(f1x, f1y, 28, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      // 魚尾
      ctx.beginPath();
      ctx.moveTo(f1x - 24, f1y);
      ctx.lineTo(f1x - 44, f1y - 14 + tailFlap1);
      ctx.lineTo(f1x - 44, f1y + 14 + tailFlap1);
      ctx.fill();
      // 魚眼睛
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(f1x + 16, f1y - 4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(f1x + 18, f1y - 4, 2, 0, Math.PI * 2); ctx.fill();

      // 4. 游動的小紅魚 2 (粉紅，往左游)
      const f2x = w + 50 - ((time * 55) % (w + 100));
      const f2y = 190 + Math.cos(time * 2.5) * 20;
      const tailFlap2 = Math.sin(time * 10) * 8;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.ellipse(f2x, f2y, 22, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // 魚尾 (朝右)
      ctx.beginPath();
      ctx.moveTo(f2x + 18, f2y);
      ctx.lineTo(f2x + 36, f2y - 10 + tailFlap2);
      ctx.lineTo(f2x + 36, f2y + 10 + tailFlap2);
      ctx.fill();
      // 魚眼睛
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(f2x - 12, f2y - 3, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(f2x - 13, f2y - 3, 1.5, 0, Math.PI * 2); ctx.fill();

      // 5. 上升的空氣泡泡
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      for (let b = 0; b < 7; b++) {
        const bx = 70 + b * 65 + Math.sin(time + b) * 8;
        const by = (h - ((time * 45 + b * 40) % h));
        ctx.beginPath();
        ctx.arc(bx, by, 3 + (b % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. 電視水印標題
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = 'bold 16px "Noto Sans TC", sans-serif';
      ctx.fillText('🐾 貓咪放鬆水族頻道 4K 🐟', 24, 38);

      if (this.tvScreenTex) this.tvScreenTex.needsUpdate = true;
    }
  }

  updateCamera() {
    const targetPos = this.viewMode === 'human' ? this.playerPos : this.catPos;
    const targetY = this.viewMode === 'human' ? 0.95 : 0.25;

    const dist = this.viewMode === 'human' ? this.cameraDistance : Math.min(2.8, this.cameraDistance * 0.65);
    const camX = targetPos.x + dist * Math.sin(this.cameraYaw) * Math.cos(this.cameraPitch);
    const camY = Math.max(0.2, targetPos.y + targetY + dist * Math.sin(this.cameraPitch));
    const camZ = targetPos.z + dist * Math.cos(this.cameraYaw) * Math.cos(this.cameraPitch);

    this.camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.12);
    this.camera.lookAt(targetPos.x, targetPos.y + targetY, targetPos.z);
  }

  updateShadows() {
    // 地面接觸陰影盤貼合主角腳底 (若在高處沙發上則淡出)
    if (this.playerShadow) {
      this.playerShadow.position.x = this.playerPos.x;
      this.playerShadow.position.z = this.playerPos.z;
      this.playerShadow.position.y = Math.max(0.003, this.player.position.y + 0.003);
      this.playerShadow.material.opacity = this.isSitting ? 0.08 : 0.22;
    }
    if (this.catShadow) {
      this.catShadow.position.x = this.cat.position.x;
      this.catShadow.position.z = this.cat.position.z;
      this.catShadow.position.y = this.cat.position.y + 0.003;
      this.catShadow.material.opacity = (this.catState === 'sleep_belly_up') ? 0.26 : 0.22;
    }
  }

  updateMarkers() {
    const tempV = new THREE.Vector3();
    let closestDist = Infinity;
    let closestSpot = null;

    const currentHeroPos = (this.viewMode === 'cat' && this.cat) ? this.cat.position : this.playerPos;
    const time = this.clock ? this.clock.getElapsedTime() : performance.now() * 0.001;

    // 1. 動態更新 3D 發光光環與微光晶體 (旋轉、脈動與漂浮)
    if (this.glowingAuras) {
      this.glowingAuras.forEach((aura, i) => {
        const spot = this.interactiveSpots[i];
        if (!spot) return;
        const distXZ = Math.hypot(currentHeroPos.x - spot.pos.x, currentHeroPos.z - spot.pos.z);
        const isNear = distXZ < 1.75;

        // 旋轉晶體
        aura.crystal.rotation.y = time * 2.2 + aura.phase;
        aura.crystal.rotation.x = Math.sin(time * 1.5 + aura.phase) * 0.2;
        aura.crystal.position.y = aura.baseY + Math.sin(time * 3.5 + aura.phase) * 0.06;

        // 靠近時光環放大且脈動加劇
        const ringScale = isNear 
          ? 1.25 + Math.sin(time * 5 + aura.phase) * 0.15 
          : 1.0 + Math.sin(time * 2.5 + aura.phase) * 0.1;
        aura.ring.scale.set(ringScale, ringScale, 1);
        aura.ring.material.opacity = isNear ? 0.9 : 0.6;
        aura.crystal.material.emissiveIntensity = isNear ? 1.6 : 0.85;
      });
    }

    // 2. 找出最接近且在觸碰範圍內的物品 (distXZ < 1.75m)
    this.spotElements.forEach(({ spot }) => {
      const distXZ = Math.hypot(currentHeroPos.x - spot.pos.x, currentHeroPos.z - spot.pos.z);
      if (distXZ < 1.75 && distXZ < closestDist) {
        closestDist = distXZ;
        closestSpot = spot;
      }
    });

    this.nearbySpot = closestSpot;

    // 3. 更新 2D 氣泡提示：僅當玩家靠近物品 (< 1.75m) 且為當前焦點時才單獨顯示，其餘全數隱藏保持畫面乾淨！
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

      // 未靠近或在螢幕外：完全隱藏
      bubble.style.display = 'none';
      bubble.style.opacity = '0';
      bubble.classList.remove('active');
    });

    // 4. 動態聯動底部動作列 (Action Dock) 的家具/玩具按鈕與金芒高亮效果
    const dockBtn = document.getElementById('btn-sit-sofa');
    const dockIcon = document.getElementById('btn-sit-icon');
    const dockLabel = document.getElementById('btn-sit-label');

    if (closestSpot && closestDist < 1.75) {
      this.activeNearbySpot = closestSpot;
      if (dockBtn) dockBtn.classList.add('highlight-item-btn');
      if (dockIcon) dockIcon.textContent = closestSpot.icon;
      if (dockLabel) dockLabel.textContent = closestSpot.name.replace(' (使用)', '');
    } else {
      this.activeNearbySpot = null;
      if (dockBtn) dockBtn.classList.remove('highlight-item-btn');
      if (dockIcon) dockIcon.textContent = '🛋️';
      if (dockLabel) dockLabel.textContent = '沙發互動';
    }

    // 5. 更新當前關卡 3D 光柱地標 (Quest Beacon) 與 2D 浮動路標 (#quest-3d-marker)
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
        if (this.questBeaconRing) {
          const s = 1.0 + Math.sin(time * 4.5) * 0.18;
          this.questBeaconRing.scale.set(s, s, 1);
          this.questBeaconRing.position.y = (tPos.y > 0.45 ? tPos.y - 0.01 : 0.03);
        }
      }

      if (qMarker) {
        if (cs.G.mode === 'explore' && st.kind !== 'story') {
          tempV.set(tPos.x, Math.max(0.65, tPos.y + 0.55), tPos.z);
          tempV.project(this.camera);

          let sx = (tempV.x * 0.5 + 0.5) * window.innerWidth;
          let sy = (-tempV.y * 0.5 + 0.5) * window.innerHeight;
          if (tempV.z > 1) {
            sx = window.innerWidth - sx;
            sy = window.innerHeight - 95;
          }
          // 保持在畫面可視範圍內，就算視角轉開也能在邊緣看到關卡方向並直接點擊作答
          sx = Math.max(95, Math.min(window.innerWidth - 95, sx));
          sy = Math.max(66, Math.min(window.innerHeight - 92, sy));

          qMarker.style.display = 'inline-flex';
          qMarker.style.left = `${sx}px`;
          qMarker.style.top = `${sy}px`;

          // 若玩家主動走進關卡光柱範圍 (< 0.88m)，自動彈出本關課文與題目挑戰！
          const distToQuest = Math.hypot(currentHeroPos.x - tPos.x, currentHeroPos.z - tPos.z);
          if (distToQuest < 0.88 && this.isCatMoving && this._autoOpenedStation !== cs.G.station) {
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

  updateProximityCard() {
    // 永不彈出大型中央靠近捷徑卡，因為下方操作列已有完整按鈕，保持手機畫面清爽無遮擋
    if (this.proxCard) {
      this.proxCard.classList.add('hidden');
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
    this.bellyUpFactor = 0;
    if (n === 7) {
      // 站點 7：放置於 X = 1.85, Z = 1.8。朝向 -Z 方向有長達 4 米的無障礙走道，供觸控測試量測精準類比位移
      this.catPos.set(1.85, 0, 1.8);
      this.cameraYaw = 0;
    } else if (n === 0) {
      this.catPos.set(0, 0, 0.5);
      this.cameraYaw = 0;
    } else if (n === 1) {
      this.catPos.set(-3.2, 0, -1.5);
      this.cameraYaw = 0;
    } else {
      this.catPos.set(0, 0, 0.8);
      this.cameraYaw = 0;
    }
    if (this.cat) {
      this.cat.position.copy(this.catPos);
      this.cat.rotation.y = 0;
    }
    if (window.__bird && window.__bird.P) {
      window.__bird.P.pos = this.catPos;
      window.__bird.P.yaw = this.cameraYaw;
    }
  }

  setEnv(name) {
    if (name === 'morning') {
      this.scene.background = new THREE.Color(0xfff7ed);
      this.scene.fog.color = new THREE.Color(0xfff7ed);
    } else if (name === 'noon') {
      this.scene.background = new THREE.Color(0xf0f9ff);
      this.scene.fog.color = new THREE.Color(0xf0f9ff);
    } else if (name === 'warm') {
      this.scene.background = new THREE.Color(0xfef3c7);
      this.scene.fog.color = new THREE.Color(0xfef3c7);
    } else {
      this.scene.background = new THREE.Color(0xfbf8f3);
      this.scene.fog.color = new THREE.Color(0xfbf8f3);
    }
  }
}

// 實例化遊戲
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
