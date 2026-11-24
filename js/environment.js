/* Sydney Cove, 1932: sky, water, sandstone shores, low-rise skyline. */
(function () {
  'use strict';

  var U = window.HBUtils;
  var V3 = THREE.Vector3;

  var SUN_DIR = new V3(-0.62, 0.56, 0.42).normalize();

  function makeSky() {
    var geo = new THREE.SphereGeometry(12000, 48, 28);
    var mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uSun: { value: SUN_DIR } },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = normalize(position);',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uSun;',
        'void main() {',
        '  vec3 d = normalize(vDir);',
        '  float h = clamp(d.y, -1.0, 1.0);',
        '  vec3 zenith = vec3(0.055, 0.105, 0.205);',
        '  vec3 horizon = vec3(0.86, 0.55, 0.34);',
        '  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.52));',
        '  col = mix(col, vec3(0.17, 0.13, 0.115), smoothstep(0.0, -0.28, h));',
        '  float sd = max(dot(d, normalize(uSun)), 0.0);',
        '  col += vec3(1.0, 0.70, 0.36) * pow(sd, 240.0) * 1.7;',
        '  col += vec3(0.85, 0.42, 0.18) * pow(sd, 7.0) * 0.20;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var sky = new THREE.Mesh(geo, mat);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    return sky;
  }

  function makeSunSprite() {
    var c = document.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255, 246, 224, 1)');
    g.addColorStop(0.16, 'rgba(255, 219, 160, 0.95)');
    g.addColorStop(0.42, 'rgba(255, 168, 92, 0.32)');
    g.addColorStop(1, 'rgba(255, 150, 80, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(c);
    var mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xffd9a6,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false
    });
    var sprite = new THREE.Sprite(mat);
    sprite.position.copy(SUN_DIR).multiplyScalar(2500);
    sprite.scale.set(360, 360, 1);
    return sprite;
  }

  function makeWater() {
    var geo = new THREE.PlaneGeometry(16000, 16000, 210, 210);
    var uniforms = { uTime: { value: 0 } };
    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      fog: false,
      vertexShader: [
        'uniform float uTime;',
        'varying vec3 vWorld;',
        'varying float vWave;',
        'void main() {',
        '  vec3 p = position;',
        '  float w = sin(p.x * 0.031 + uTime * 0.55) * 0.62;',
        '  w += sin(p.y * 0.024 - uTime * 0.78) * 0.48;',
        '  w += sin((p.x + p.y) * 0.055 + uTime * 1.25) * 0.22;',
        '  p.z += w;',
        '  vWave = w;',
        '  vec4 wp = modelMatrix * vec4(p, 1.0);',
        '  vWorld = wp.xyz;',
        '  gl_Position = projectionMatrix * viewMatrix * wp;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'varying vec3 vWorld;',
        'varying float vWave;',
        'void main() {',
        '  float d = length(vWorld.xz);',
        '  vec3 deep = vec3(0.042, 0.096, 0.126);',
        '  vec3 sea = vec3(0.066, 0.154, 0.186);',
        '  float band = smoothstep(-1.2, 1.2, vWave) * 0.5 + 0.5;',
        '  vec3 col = mix(deep, sea, band * 0.6);',
        '  float haze = smoothstep(380.0, 3000.0, d);',
        '  col = mix(col, vec3(0.49, 0.34, 0.24), haze * 0.72);',
        '  float rip = sin(vWorld.x * 0.09 + vWorld.z * 0.035 + uTime * 0.9)',
        '          * sin(vWorld.z * 0.055 - uTime * 0.6);',
        '  col += vec3(0.14, 0.17, 0.18) * smoothstep(0.78, 1.0, rip) * (1.0 - haze) * 0.12;',
        '  float glint = pow(max(0.0, sin(vWorld.x * 0.028 + vWorld.z * 0.021 + 1.1)), 34.0);',
        '  col += vec3(0.50, 0.30, 0.15) * glint * smoothstep(250.0, 1100.0, d) * (1.0 - haze) * 0.16;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    });
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.frustumCulled = false;
    return { mesh: mesh, uniforms: uniforms };
  }

  function addLand(scene) {
    var baseMat = new THREE.MeshStandardMaterial({ color: 0x5f4d3c, roughness: 0.96, metalness: 0.02 });
    var topMat = new THREE.MeshStandardMaterial({ color: 0x71604c, roughness: 0.94, metalness: 0.02 });

    [-1, 1].forEach(function (s) {
      var base = new THREE.Mesh(new THREE.BoxGeometry(620, 22, 660), baseMat);
      base.position.set(s * 590, 11, 0);
      base.receiveShadow = true;
      scene.add(base);

      var top = new THREE.Mesh(new THREE.BoxGeometry(600, 4, 640), topMat);
      top.position.set(s * 590, 24, 0);
      top.receiveShadow = true;
      scene.add(top);

      var wall = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 660), new THREE.MeshStandardMaterial({ color: 0x45392d, roughness: 0.95 }));
      wall.position.set(s * 281, 4, 0);
      scene.add(wall);
    });

    // wharves poking into the water
    var wharfGeos = [];
    [-1, 1].forEach(function (s) {
      [62, 138, -74, -150].forEach(function (z) {
        var g = new THREE.BoxGeometry(46, 2.2, 16);
        g.translate(s * 258, 3.4, z);
        wharfGeos.push(g);
      });
    });
    var wharfMat = new THREE.MeshStandardMaterial({ color: 0x4f4234, roughness: 0.95 });
    var wharves = new THREE.Mesh(U.mergeGeos(wharfGeos), wharfMat);
    wharves.receiveShadow = true;
    scene.add(wharves);
  }

  function addRoads(scene) {
    var geos = [];
    [-1, 1].forEach(function (s) {
      [94, 186, 268].forEach(function (z) {
        var g = new THREE.BoxGeometry(586, 0.35, 7);
        g.translate(s * 590, 26.18, z);
        geos.push(g);
      });
      [344, 432, 520, 608, 700].forEach(function (x) {
        var g = new THREE.BoxGeometry(7, 0.35, 634);
        g.translate(s * x, 26.18, 0);
        geos.push(g);
      });
      var promenade = new THREE.BoxGeometry(22, 0.3, 640);
      promenade.translate(s * 304, 26.16, 0);
      geos.push(promenade);
    });
    var roads = new THREE.Mesh(
      U.mergeGeos(geos),
      new THREE.MeshStandardMaterial({ color: 0x4c463d, roughness: 0.95, metalness: 0.02 })
    );
    roads.receiveShadow = true;
    scene.add(roads);

    var parkGeos = [];
    [-1, 1].forEach(function (s) {
      [[398, 152, 84, 54], [512, -168, 96, 64]].forEach(function (p) {
        var g = new THREE.BoxGeometry(p[2], 0.3, p[3]);
        g.translate(s * p[0], 26.2, p[1]);
        parkGeos.push(g);
      });
    });
    var parks = new THREE.Mesh(
      U.mergeGeos(parkGeos),
      new THREE.MeshStandardMaterial({ color: 0x46503c, roughness: 1, metalness: 0 })
    );
    parks.receiveShadow = true;
    scene.add(parks);
  }

  function addCity(scene) {
    var rand = U.mulberry32(1932);
    var count = 165;
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshStandardMaterial({ roughness: 0.86, metalness: 0.04 });
    var mesh = new THREE.InstancedMesh(geo, mat, count);
    var palette = [0x7d705f, 0x8a7b68, 0x6d6458, 0x978873, 0x5d574f, 0x837466];
    var m = new THREE.Matrix4();
    var q = new THREE.Quaternion();
    var pos = new V3();
    var scl = new V3();
    for (var i = 0; i < count; i++) {
      var side = i % 2 === 0 ? -1 : 1;
      var x = 372 + rand() * 490;
      var z = (rand() * 2 - 1) * 296;
      if (Math.abs(z) < 52) z += z >= 0 ? 52 : -52;
      var h = 8 + rand() * rand() * 44;
      if (rand() > 0.94) h += 18;
      var w = 11 + rand() * 18;
      var d = 11 + rand() * 18;
      pos.set(side * x, 26 + h / 2, z);
      scl.set(w, h, d);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new THREE.Color(palette[Math.floor(rand() * palette.length)]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    scene.add(mesh);
  }

  function addLights(scene) {
    var hemi = new THREE.HemisphereLight(0x9ab8d8, 0x3b2d22, 0.62);
    scene.add(hemi);

    var sun = new THREE.DirectionalLight(0xffd0a0, 1.45);
    sun.position.copy(SUN_DIR).multiplyScalar(1200);
    sun.target.position.set(0, 50, 0);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -680;
    sun.shadow.camera.right = 680;
    sun.shadow.camera.top = 520;
    sun.shadow.camera.bottom = -320;
    sun.shadow.camera.near = 200;
    sun.shadow.camera.far = 2400;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.7;
    scene.add(sun);
    scene.add(sun.target);

    var fill = new THREE.DirectionalLight(0x6f8fb4, 0.32);
    fill.position.set(600, 240, -500);
    scene.add(fill);
  }

  function createEnvironment(scene) {
    scene.fog = new THREE.Fog(0xd39a6b, 1300, 6200);
    scene.add(makeSky());
    scene.add(makeSunSprite());
    var water = makeWater();
    scene.add(water.mesh);
    addLand(scene);
    addRoads(scene);
    addCity(scene);
    addLights(scene);

    return {
      water: water,
      update: function (elapsed) {
        water.uniforms.uTime.value = elapsed;
      }
    };
  }

  window.HBEnvironment = {
    SUN_DIR: SUN_DIR,
    createEnvironment: createEnvironment
  };
})();
