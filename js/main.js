/* Boot: renderer, camera, timeline, UI. */
(function () {
  'use strict';

  var U = window.HBUtils;
  var B = window.HBBridge.B;

  var app = document.getElementById('app');
  var loader = document.getElementById('loader');
  var bootParams = new URLSearchParams(window.location.search);
  if (bootParams.has('noloader')) loader.style.display = 'none';

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    loader.querySelector('em').textContent = '这个浏览器无法启用 WebGL，请换用 Chrome / Safari。';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a1520);

  var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 20000);

  var env = window.HBEnvironment.createEnvironment(scene);
  var bridge = window.HBBridge.createBridge(scene);

  // Hex colours are authored in sRGB; convert so ACES + sRGB output keeps them.
  (function linearizeScene(root) {
    var seen = new Set();
    root.traverse(function (o) {
      if (o.isInstancedMesh && o.instanceColor) {
        var arr = o.instanceColor.array;
        for (var i = 0; i < arr.length; i += 3) {
          var ic = new THREE.Color(arr[i], arr[i + 1], arr[i + 2]).convertSRGBToLinear();
          arr[i] = ic.r;
          arr[i + 1] = ic.g;
          arr[i + 2] = ic.b;
        }
        o.instanceColor.needsUpdate = true;
      }
      if (!o.material) return;
      var list = Array.isArray(o.material) ? o.material : [o.material];
      for (var j = 0; j < list.length; j++) {
        var m = list[j];
        if (seen.has(m) || m.isShaderMaterial || m.isSpriteMaterial || m.isPointsMaterial) continue;
        seen.add(m);
        if (m.color) m.color.convertSRGBToLinear();
        if (m.emissive) m.emissive.convertSRGBToLinear();
      }
    });
    if (scene.fog && scene.fog.color) scene.fog.color.convertSRGBToLinear();
  })(scene);

  /* ---------------------------------------------------------------- camera */
  var cam = { theta: 1.15, phi: 0.80, radius: 1700, tx: 0, ty: 55, tz: 0 };
  var camD = { theta: -0.16, phi: 1.28, radius: 780, tx: 0, ty: 82, tz: 0 };

  var PRESETS = {
    overview: { theta: -0.16, phi: 1.28, radius: 780, tx: 0, ty: 82, tz: 0 },
    arch: { theta: -0.22, phi: 1.26, radius: 470, tx: 0, ty: 102, tz: 0 },
    deck: { theta: 0.35, phi: 1.44, radius: 470, tx: 0, ty: 92, tz: 0 }
  };

  function updateCamera(dt) {
    var k = 1 - Math.exp(-3.4 * dt);
    cam.theta += (camD.theta - cam.theta) * k;
    cam.phi += (camD.phi - cam.phi) * k;
    cam.radius += (camD.radius - cam.radius) * k;
    cam.tx += (camD.tx - cam.tx) * k;
    cam.ty += (camD.ty - cam.ty) * k;
    cam.tz += (camD.tz - cam.tz) * k;
    var sp = Math.sin(cam.phi);
    camera.position.set(
      cam.tx + cam.radius * sp * Math.sin(cam.theta),
      cam.ty + cam.radius * Math.cos(cam.phi),
      cam.tz + cam.radius * sp * Math.cos(cam.theta)
    );
    camera.lookAt(cam.tx, cam.ty, cam.tz);
  }

  var dragging = false;
  var lastX = 0;
  var lastY = 0;
  var userInteracted = false;
  var activeView = 'overview';

  function clearActiveView() {
    var btns = document.querySelectorAll('.views [data-view]');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('is-active');
    activeView = '';
  }

  var dom = renderer.domElement;
  dom.addEventListener('pointerdown', function (e) {
    dragging = true;
    userInteracted = true;
    lastX = e.clientX;
    lastY = e.clientY;
    clearActiveView();
    if (dom.setPointerCapture) dom.setPointerCapture(e.pointerId);
  });
  dom.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    camD.theta -= dx * 0.0048;
    camD.phi = THREE.MathUtils.clamp(camD.phi - dy * 0.0036, 0.22, 1.5);
    cam.theta = camD.theta;
    cam.phi = camD.phi;
  });
  function endDrag() { dragging = false; }
  dom.addEventListener('pointerup', endDrag);
  dom.addEventListener('pointercancel', endDrag);
  dom.addEventListener('wheel', function (e) {
    e.preventDefault();
    userInteracted = true;
    var f = Math.exp(e.deltaY * 0.0012);
    camD.radius = THREE.MathUtils.clamp(camD.radius * f, 140, 2600);
    cam.radius = camD.radius;
  }, { passive: false });

  var viewBtns = document.querySelectorAll('.views [data-view]');
  for (var vi = 0; vi < viewBtns.length; vi++) {
    viewBtns[vi].addEventListener('click', function (e) {
      var name = e.currentTarget.getAttribute('data-view');
      var p = PRESETS[name];
      if (!p) return;
      camD.theta = p.theta;
      camD.phi = p.phi;
      camD.radius = p.radius;
      camD.tx = p.tx;
      camD.ty = p.ty;
      camD.tz = p.tz;
      userInteracted = true;
      clearActiveView();
      e.currentTarget.classList.add('is-active');
      activeView = name;
    });
  }

  /* -------------------------------------------------------------------- UI */
  var chapters = [
    {
      t: 0.0, phase: '勘测与基础', title: '在海湾上放线',
      text: '1923 年，工人在两岸开挖砂岩、浇筑桥台，并把缆索的锚固隧道深深打进岩体。没有计算机与重型吊船，一切靠测量、绞车和人力。'
    },
    {
      t: 0.055, phase: '引桥与桥塔', title: '先让两岸连起来',
      text: '两岸引桥的钢桁架在脚手架上逐段拼装。四座花岗岩塔楼只是装饰，并不承重——它们让这座钢铁大桥看起来更像一座“桥”。'
    },
    {
      t: 0.30, phase: '悬臂伸出', title: '悬在半空的钢拱',
      text: '主拱两半同时从两岸向外生长。每伸出一段，缆索就把它拉住；缆索另一头锚进砂岩深处，托住这个尚未合龙的悬臂。'
    },
    {
      t: 0.55, phase: '空中工地', title: '爬行吊车与热铆钉',
      text: '爬行吊车骑在拱肋上随施工爬升，把钢构件吊到百米高空。全桥约 600 万颗铆钉，由工人用气动铆钉枪一颗颗打进去。'
    },
    {
      t: 0.78, phase: '拱顶合龙', title: '两半在 134 米高空相遇',
      text: '1930 年 8 月，两半拱在拱顶合龙，当时偏差约 0.6 米，靠液压千斤顶校正。那一刻，悬臂终于变成一座完整的拱。'
    },
    {
      t: 0.805, phase: '卸索与吊杆', title: '让拱自己站住',
      text: '钢缆卸力，拱从“被拉住”转为自承重。吊杆从拱肋垂下，桥面逐段悬挂、铺装，铁轨和车道在 50 米高的海面上延伸。'
    },
    {
      t: 0.93, phase: '大桥通车', title: '九年后，海港被跨越',
      text: '1932 年 3 月 19 日，大桥通车。5.28 万吨钢、约 600 万颗铆钉、1400 名工人，用九年时间完成了这次合龙。'
    }
  ];

  var el = {
    chapterIndex: document.getElementById('chapterIndex'),
    chapterPhase: document.getElementById('chapterPhase'),
    chapterTitle: document.getElementById('chapterTitle'),
    chapterText: document.getElementById('chapterText'),
    statRivets: document.getElementById('statRivets'),
    statSteel: document.getElementById('statSteel'),
    yearLabel: document.getElementById('yearLabel'),
    phaseLabel: document.getElementById('phaseLabel'),
    percentLabel: document.getElementById('percentLabel'),
    slider: document.getElementById('timeline'),
    playBtn: document.getElementById('playBtn'),
    iconPlay: document.getElementById('iconPlay'),
    iconPause: document.getElementById('iconPause')
  };

  var state = { t: 0, playing: true, duration: 50 };
  var startT = parseFloat(bootParams.get('t'));
  if (isFinite(startT)) {
    state.t = THREE.MathUtils.clamp(startT, 0, 1);
    state.playing = false;
  }
  var lastChapter = -1;
  var scrubbing = false;
  var hudAcc = 0;

  function chapterAt(t) {
    var idx = 0;
    for (var i = 0; i < chapters.length; i++) {
      if (t >= chapters[i].t) idx = i;
    }
    return idx;
  }

  function yearAt(t) {
    if (t < 0.30) return 1923 + (t / 0.30) * 5;
    if (t < 0.78) return 1928 + ((t - 0.30) / 0.48) * 2;
    if (t < 0.93) return 1930 + ((t - 0.78) / 0.15) * 2;
    return 1932;
  }

  function syncPlayIcon() {
    el.iconPlay.style.display = state.playing ? 'none' : 'block';
    el.iconPause.style.display = state.playing ? 'block' : 'none';
    el.playBtn.setAttribute('aria-label', state.playing ? '暂停' : '播放');
  }

  function updateHud(dt) {
    var t = state.t;
    var idx = chapterAt(t);
    if (idx !== lastChapter) {
      lastChapter = idx;
      var ch = chapters[idx];
      el.chapterIndex.textContent = ('0' + (idx + 1)).slice(-2);
      el.chapterPhase.textContent = ch.phase;
      el.chapterTitle.textContent = ch.title;
      el.chapterText.textContent = ch.text;
      el.phaseLabel.textContent = ch.phase;
    }

    var pct = Math.round(t * 100);
    el.percentLabel.textContent = pct + '%';
    el.yearLabel.textContent = String(Math.round(yearAt(t)));

    if (!scrubbing) {
      el.slider.value = String(Math.round(t * 1000));
    }
    el.slider.style.setProperty('--fill', pct + '%');

    hudAcc += dt;
    if (hudAcc < 0.09) return;
    hudAcc = 0;
    el.statRivets.textContent = U.formatInt(B.rivets * Math.pow(t, 1.55));
    el.statSteel.textContent = U.formatInt(B.steelTons * t) + ' t';
  }

  el.slider.addEventListener('pointerdown', function () { scrubbing = true; });
  el.slider.addEventListener('pointerup', function () { scrubbing = false; });
  el.slider.addEventListener('pointercancel', function () { scrubbing = false; });
  el.slider.addEventListener('input', function (e) {
    state.t = Number(e.target.value) / 1000;
    if (state.t >= 1) {
      state.playing = false;
      syncPlayIcon();
    }
  });

  el.playBtn.addEventListener('click', function () {
    if (!state.playing && state.t >= 1) state.t = 0;
    state.playing = !state.playing;
    syncPlayIcon();
  });

  document.getElementById('replayBtn').addEventListener('click', function () {
    state.t = 0;
    state.playing = true;
    syncPlayIcon();
    var p = PRESETS.overview;
    camD.theta = p.theta;
    camD.phi = p.phi;
    camD.radius = p.radius;
    camD.tx = p.tx;
    camD.ty = p.ty;
    camD.tz = p.tz;
    clearActiveView();
    document.querySelector('.views [data-view="overview"]').classList.add('is-active');
    activeView = 'overview';
  });

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      if (!state.playing && state.t >= 1) state.t = 0;
      state.playing = !state.playing;
      syncPlayIcon();
    }
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ------------------------------------------------------------------ loop */
  var clock = new THREE.Clock();
  var elapsed = 0;
  var firstFrame = true;

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (state.playing) {
      state.t += dt / state.duration;
      if (state.t >= 1) {
        state.t = 1;
        state.playing = false;
        syncPlayIcon();
      }
    }

    if (!userInteracted && state.playing && state.t < 0.04) {
      camD.theta += dt * 0.028;
    }

    bridge.update(state.t, dt, elapsed);
    env.update(elapsed);
    updateCamera(dt);
    updateHud(dt);
    renderer.render(scene, camera);

    if (firstFrame) {
      firstFrame = false;
      loader.classList.add('is-hidden');
    }
  }

  syncPlayIcon();
  updateCamera(1);
  animate();

  // Fallback: never let a slow first frame trap the visitor behind the loader.
  setTimeout(function () { loader.classList.add('is-hidden'); }, 2400);
})();
