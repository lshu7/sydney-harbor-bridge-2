/* The bridge itself: parametric arch, cantilever cables, cranes, deck. */
(function () {
  'use strict';

  var U = window.HBUtils;
  var V3 = THREE.Vector3;

  var B = {
    halfSpan: 251.5,
    totalHalf: 574.5,
    panels: 20,
    crownY: 140,
    hingeY: 26,
    deckTop: 52,
    trussDepth: 10.5,
    ribZ: [-24, -8, 8, 24],
    deckWidth: 48,
    startYear: 1923,
    endYear: 1932,
    rivets: 6000000,
    steelTons: 52800,
    workers: 1400
  };
  B.panelW = B.halfSpan / B.panels;

  function archY(x) {
    var t = Math.min(1, Math.abs(x) / B.halfSpan);
    return B.crownY - (B.crownY - B.hingeY) * t * t;
  }

  function buildArchGeometry() {
    var geos = [];
    var depth = B.trussDepth;
    var side, r, i, j, pair;

    for (side = -1; side <= 1; side += 2) {
      for (r = 0; r < B.ribZ.length; r++) {
        var z = B.ribZ[r];
        for (i = 0; i < B.panels; i++) {
          var xa = side * i * B.panelW;
          var xb = side * (i + 1) * B.panelW;
          var ya = archY(xa);
          var yb = archY(xb);
          var topA = new V3(xa, ya, z);
          var topB = new V3(xb, yb, z);
          var botA = new V3(xa, ya - depth, z);
          var botB = new V3(xb, yb - depth, z);
          geos.push(U.memberBox(topA, topB, 2.1, 2.1));
          geos.push(U.memberBox(botA, botB, 2.1, 2.1));
          geos.push(U.memberBox(topA, botA, 1.15, 1.15));
          if (i % 2 === 0) geos.push(U.memberBox(botA, topB, 1.0, 1.0));
          else geos.push(U.memberBox(topA, botB, 1.0, 1.0));
          if (i === B.panels - 1) geos.push(U.memberBox(topB, botB, 1.15, 1.15));
        }
      }
      for (pair = 0; pair < B.ribZ.length - 1; pair++) {
        var zA = B.ribZ[pair];
        var zB = B.ribZ[pair + 1];
        for (j = 0; j <= B.panels; j++) {
          var x = side * j * B.panelW;
          var y = archY(x) - depth;
          geos.push(U.memberBox(new V3(x, y, zA), new V3(x, y, zB), 0.8, 0.8));
          if (j % 2 === 0 && j + 2 <= B.panels) {
            var xc = side * (j + 2) * B.panelW;
            var yc = archY(xc) - depth;
            geos.push(U.memberBox(new V3(x, y, zA), new V3(xc, yc, zB), 0.7, 0.7));
            geos.push(U.memberBox(new V3(x, y, zB), new V3(xc, yc, zA), 0.7, 0.7));
          }
        }
      }
    }
    return U.mergeGeos(geos);
  }

  function buildHangerGeometry() {
    var geos = [];
    var zs = [-24, -8, 8, 24];
    for (var i = -16; i <= 16; i++) {
      var x = i * B.panelW;
      var topY = archY(x) - B.trussDepth;
      if (topY <= B.deckTop + 1.5) continue;
      for (var k = 0; k < zs.length; k++) {
        geos.push(U.memberBox(
          new V3(x, topY, zs[k]),
          new V3(x, B.deckTop, zs[k]),
          0.55, 0.55
        ));
      }
    }
    return U.mergeGeos(geos);
  }

  function addDeckRun(geos, x1, x2, withPiers) {
    var len = x2 - x1;
    if (len <= 0) return;
    var cx = (x1 + x2) * 0.5;

    var slab = new THREE.BoxGeometry(len, 2.2, B.deckWidth);
    slab.translate(cx, B.deckTop - 1.1, 0);
    geos.push(slab);

    [-1, 1].forEach(function (s) {
      var girder = new THREE.BoxGeometry(len, 3.4, 2.0);
      girder.translate(cx, B.deckTop - 2.9, s * (B.deckWidth / 2 - 1.0));
      geos.push(girder);

      var rail = new THREE.BoxGeometry(len, 1.1, 0.5);
      rail.translate(cx, B.deckTop + 0.55, s * (B.deckWidth / 2 - 0.55));
      geos.push(rail);
    });

    var beams = Math.max(1, Math.round(len / B.panelW));
    for (var i = 0; i <= beams; i++) {
      var x = x1 + (len * i) / beams;
      var cross = new THREE.BoxGeometry(0.8, 1.1, B.deckWidth - 4);
      cross.translate(x, B.deckTop - 2.5, 0);
      geos.push(cross);
    }

    if (withPiers) {
      var trussTop = B.deckTop - 4.8;
      var trussBot = trussTop - 8;
      [-1, 1].forEach(function (s) {
        var z = s * (B.deckWidth / 2 - 1.4);
        var topChord = new THREE.BoxGeometry(len, 1.2, 1.2);
        topChord.translate(cx, trussTop, z);
        geos.push(topChord);
        var botChord = new THREE.BoxGeometry(len, 1.2, 1.2);
        botChord.translate(cx, trussBot, z);
        geos.push(botChord);

        var n = Math.max(1, Math.round(len / 24));
        for (var k = 0; k <= n; k++) {
          var vx = x1 + (len * k) / n;
          geos.push(U.memberBox(new V3(vx, trussBot, z), new V3(vx, trussTop, z), 0.6, 0.6));
          if (k < n) {
            var nx = x1 + (len * (k + 1)) / n;
            if (k % 2 === 0) geos.push(U.memberBox(new V3(vx, trussBot, z), new V3(nx, trussTop, z), 0.55, 0.55));
            else geos.push(U.memberBox(new V3(vx, trussTop, z), new V3(nx, trussBot, z), 0.55, 0.55));
          }
        }
      });

      for (var px = x1 + 34; px < x2 - 20; px += 62) {
        for (var ps = -1; ps <= 1; ps += 2) {
          var ph = trussBot - 26;
          var pier = new THREE.BoxGeometry(8, ph, 9);
          pier.translate(px, 26 + ph / 2, ps * 15);
          geos.push(pier);
        }
      }
    }
  }

  function buildMainDeckGeometry() {
    var geos = [];
    addDeckRun(geos, -B.halfSpan, B.halfSpan, false);
    return U.mergeGeos(geos);
  }

  function buildApproachGeometry() {
    var geos = [];
    addDeckRun(geos, -B.totalHalf, -B.halfSpan, true);
    addDeckRun(geos, B.halfSpan, B.totalHalf, true);
    return U.mergeGeos(geos);
  }

  function buildAbutments() {
    var geos = [];
    [-1, 1].forEach(function (s) {
      var block = new THREE.BoxGeometry(30, 42, 86);
      block.translate(s * (B.halfSpan + 8), 21, 0);
      geos.push(block);
      var toe = new THREE.BoxGeometry(52, 10, 108);
      toe.translate(s * (B.halfSpan + 2), 5, 0);
      geos.push(toe);
    });
    return U.mergeGeos(geos);
  }

  function createPylon(x, z, mat) {
    var g = new THREE.Group();
    function step(w, h, d, y0) {
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.y = y0 + h / 2;
      mesh.castShadow = true;
      g.add(mesh);
    }
    step(21, 54, 17, 0);
    step(17, 28, 15, 54);
    step(13, 14, 12, 82);
    step(15, 3, 14, 96);
    g.position.set(x, 0, z);
    g.scale.y = 0.001;
    return g;
  }

  function createCrane() {
    var yellow = new THREE.MeshStandardMaterial({ color: 0xd6a24a, roughness: 0.5, metalness: 0.35 });
    var dark = new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.7, metalness: 0.4 });
    var group = new THREE.Group();

    var base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 4.2), dark);
    base.position.y = 0.7;
    group.add(base);

    var mast = new THREE.Mesh(new THREE.BoxGeometry(2.3, 25, 2.3), yellow);
    mast.position.y = 13.6;
    group.add(mast);

    var pivot = new THREE.Group();
    pivot.position.y = 0;
    group.add(pivot);

    var cab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.2, 3.6), dark);
    cab.position.set(1.4, 25.4, 0);
    pivot.add(cab);

    var jib = new THREE.Mesh(new THREE.BoxGeometry(23, 1.2, 1.5), yellow);
    jib.position.set(11.5, 26.2, 0);
    pivot.add(jib);

    var counter = new THREE.Mesh(new THREE.BoxGeometry(8, 0.9, 1.3), yellow);
    counter.position.set(-5.5, 26.0, 0);
    pivot.add(counter);

    var tie = new THREE.Mesh(new THREE.BoxGeometry(0.35, 12, 0.35), dark);
    tie.position.set(-1.8, 20.2, 0);
    tie.rotation.z = 0.55;
    pivot.add(tie);

    var beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffb35c })
    );
    beacon.position.set(0, 27.2, 0);
    group.add(beacon);

    group.userData.pivot = pivot;
    group.userData.beacon = beacon;
    group.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    return group;
  }

  function createSparkSystem() {
    var count = 90;
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var vel = new Float32Array(count * 3);
    var life = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      pos[i * 3 + 1] = -999;
      life[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: 0xffb35c,
      size: 3.2,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    return { points: points, geo: geo, pos: pos, vel: vel, life: life, count: count };
  }

  function respawnSpark(sys, i, x, y) {
    var a = Math.random() * Math.PI * 2;
    var r = 2 + Math.random() * 9;
    sys.pos[i * 3] = x + Math.cos(a) * r;
    sys.pos[i * 3 + 1] = y + (Math.random() - 0.3) * 10;
    sys.pos[i * 3 + 2] = Math.sin(a) * r + (Math.random() - 0.5) * 8;
    sys.vel[i * 3] = (Math.random() - 0.5) * 6;
    sys.vel[i * 3 + 1] = 4 + Math.random() * 10;
    sys.vel[i * 3 + 2] = (Math.random() - 0.5) * 6;
    sys.life[i] = 0.35 + Math.random() * 0.75;
  }

  function updateSparks(sys, x, y, active, dt) {
    sys.points.visible = active;
    if (!active) return;
    for (var i = 0; i < sys.count; i++) {
      sys.life[i] -= dt;
      if (sys.life[i] <= 0) {
        respawnSpark(sys, i, x, y);
      }
      sys.vel[i * 3 + 1] -= 16 * dt;
      sys.pos[i * 3] += sys.vel[i * 3] * dt;
      sys.pos[i * 3 + 1] += sys.vel[i * 3 + 1] * dt;
      sys.pos[i * 3 + 2] += sys.vel[i * 3 + 2] * dt;
    }
    sys.geo.attributes.position.needsUpdate = true;
  }

  function createCars() {
    var count = 14;
    var geo = new THREE.BoxGeometry(4.6, 1.5, 2.0);
    var mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.5 });
    var mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    var palette = [0xd8d2c4, 0x38424c, 0x9b3c32, 0x5f7a82, 0x2b2b2b, 0xbfa76a];
    var cars = [];
    var m = new THREE.Matrix4();
    for (var i = 0; i < count; i++) {
      var lane = [6, 11, 17][i % 3] * (i % 2 === 0 ? 1 : -1);
      cars.push({
        x: -560 + Math.random() * 1120,
        z: lane,
        dir: lane > 0 ? 1 : -1,
        speed: 18 + Math.random() * 16
      });
      mesh.setColorAt(i, new THREE.Color(palette[i % palette.length]));
      m.makeScale(0.001, 0.001, 0.001);
      mesh.setMatrixAt(i, m);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = false;
    mesh.frustumCulled = false;
    return { mesh: mesh, list: cars };
  }

  function makeCable(start, end) {
    var mid = start.clone().lerp(end, 0.54);
    mid.y -= 13;
    var curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return new THREE.TubeGeometry(curve, 22, 0.8, 5, false);
  }

  function createBridge(scene) {
    var root = new THREE.Group();
    root.name = 'harbour-bridge';
    scene.add(root);

    var archU = { a: { value: -B.halfSpan }, b: { value: B.halfSpan } };
    var hangerU = { a: { value: 206 } };
    var deckU = { a: { value: B.halfSpan } };
    var approachU = { a: { value: B.halfSpan - 1 }, b: { value: B.halfSpan } };

    var steelMat = U.makeRevealMaterial(
      { color: 0x93999d, roughness: 0.46, metalness: 0.26 },
      archU, 'middle'
    );
    var hangerMat = U.makeRevealMaterial(
      { color: 0xa2a7aa, roughness: 0.44, metalness: 0.3 },
      hangerU, 'inside'
    );
    var deckMat = U.makeRevealMaterial(
      { color: 0x434c54, roughness: 0.82, metalness: 0.12 },
      deckU, 'inside'
    );
    var approachMat = U.makeRevealMaterial(
      { color: 0x555f68, roughness: 0.78, metalness: 0.12 },
      approachU, 'band'
    );
    var concreteMat = new THREE.MeshStandardMaterial({ color: 0x9a8a74, roughness: 0.95, metalness: 0.02 });
    var graniteMat = new THREE.MeshStandardMaterial({ color: 0xb29b81, roughness: 0.88, metalness: 0.03 });
    var anchorMat = new THREE.MeshStandardMaterial({ color: 0x6e6152, roughness: 0.95 });

    var archMesh = new THREE.Mesh(buildArchGeometry(), steelMat);
    archMesh.name = 'arch';
    root.add(archMesh);

    var hangerMesh = new THREE.Mesh(buildHangerGeometry(), hangerMat);
    hangerMesh.name = 'hangers';
    root.add(hangerMesh);

    var deckMesh = new THREE.Mesh(buildMainDeckGeometry(), deckMat);
    deckMesh.name = 'deck';
    deckMesh.receiveShadow = true;
    root.add(deckMesh);

    var approachMesh = new THREE.Mesh(buildApproachGeometry(), approachMat);
    approachMesh.name = 'approach';
    approachMesh.receiveShadow = true;
    root.add(approachMesh);

    var abutmentMesh = new THREE.Mesh(buildAbutments(), concreteMat);
    abutmentMesh.receiveShadow = true;
    root.add(abutmentMesh);

    var anchorGeo = [];
    [-1, 1].forEach(function (s) {
      var block = new THREE.BoxGeometry(16, 13, 48);
      block.translate(s * 330, 28.5, 0);
      anchorGeo.push(block);
      var tunnel = new THREE.BoxGeometry(2.6, 4.6, 7);
      tunnel.translate(s * 321.5, 31, 0);
      anchorGeo.push(tunnel);
    });
    var anchorMesh = new THREE.Mesh(U.mergeGeos(anchorGeo), anchorMat);
    anchorMesh.castShadow = true;
    root.add(anchorMesh);

    var pylons = [];
    [-1, 1].forEach(function (sx) {
      [-1, 1].forEach(function (sz) {
        var p = createPylon(sx * B.halfSpan, sz * 33, graniteMat);
        pylons.push(p);
        root.add(p);
      });
    });

    var cranL = createCrane();
    var cranR = createCrane();
    cranR.rotation.y = Math.PI;
    cranL.visible = cranR.visible = false;
    root.add(cranL);
    root.add(cranR);

    var cableGroup = new THREE.Group();
    root.add(cableGroup);
    var cableMat = new THREE.MeshStandardMaterial({
      color: 0xc8a05c,
      emissive: 0x3a240a,
      emissiveIntensity: 0.7,
      roughness: 0.5,
      metalness: 0.5,
      transparent: true,
      opacity: 1
    });
    var cableZs = [-18, -6, 6, 18];
    var cableMeshes = [];
    // four cables per side, two sides
    for (var side = -1; side <= 1; side += 2) {
      for (var ci = 0; ci < cableZs.length; ci++) {
        var m = new THREE.Mesh(new THREE.BufferGeometry(), cableMat);
        m.frustumCulled = false;
        cableGroup.add(m);
        cableMeshes.push(m);
      }
    }

    var sparkL = createSparkSystem();
    var sparkR = createSparkSystem();
    var closureSparks = createSparkSystem();
    root.add(sparkL.points);
    root.add(sparkR.points);
    root.add(closureSparks.points);
    var closureTimer = 0;
    var wasClosed = false;

    var cars = createCars();
    root.add(cars.mesh);

    var lastGrow = -1;
    var craneTime = 0;

    function rebuildCables(grow) {
      var idx = 0;
      var tipL = -B.halfSpan + grow * B.halfSpan;
      var tipR = B.halfSpan - grow * B.halfSpan;
      for (var s = -1; s <= 1; s += 2) {
        var tipX = s === -1 ? tipL : tipR;
        var tipY = archY(tipX) + 2;
        for (var ci = 0; ci < cableZs.length; ci++) {
          var z = cableZs[ci];
          var start = new V3(tipX, tipY, z);
          var end = new V3(s * 330, 34, z);
          var mesh = cableMeshes[idx++];
          if (mesh.geometry) mesh.geometry.dispose();
          mesh.geometry = makeCable(start, end);
        }
      }
      lastGrow = grow;
    }

    function updateCars(dt, visible) {
      cars.mesh.visible = visible;
      if (!visible) return;
      var m = new THREE.Matrix4();
      for (var i = 0; i < cars.list.length; i++) {
        var c = cars.list[i];
        c.x += c.dir * c.speed * dt;
        if (c.x > 570) c.x = -570;
        if (c.x < -570) c.x = 570;
        m.makeTranslation(c.x, B.deckTop + 1.1, c.z);
        cars.mesh.setMatrixAt(i, m);
      }
      cars.mesh.instanceMatrix.needsUpdate = true;
    }

    function update(t, dt, elapsed) {
      var grow = Math.pow(U.smoothRange(t, 0.30, 0.78), 0.72);
      var tipL = -B.halfSpan + grow * B.halfSpan;
      var tipR = B.halfSpan - grow * B.halfSpan;

      archU.a.value = tipL;
      archU.b.value = tipR;

      var hangerP = U.smoothRange(t, 0.805, 0.895);
      hangerU.a.value = U.lerp(206, 0, hangerP);
      var deckP = U.smoothRange(t, 0.825, 0.925);
      deckU.a.value = U.lerp(B.halfSpan, 0, deckP);
      var approachP = U.lerp(B.halfSpan, 640, U.smoothRange(t, 0.055, 0.30));
      approachU.b.value = approachP;

      var pylonP = U.easeOutCubic(U.smoothRange(t, 0.10, 0.28));
      for (var i = 0; i < pylons.length; i++) {
        pylons[i].scale.y = Math.max(0.001, pylonP);
      }

      var cantilever = grow > 0.004 && grow < 0.999;
      cranL.visible = cantilever;
      cranR.visible = cantilever;
      if (cantilever) {
        var yL = archY(tipL) + 1.2;
        var yR = archY(tipR) + 1.2;
        cranL.position.set(tipL, yL, 0);
        cranR.position.set(tipR, yR, 0);
        craneTime += dt;
        cranL.userData.pivot.rotation.y = Math.sin(craneTime * 0.6) * 0.07;
        cranR.userData.pivot.rotation.y = Math.sin(craneTime * 0.6 + 1.1) * 0.07;
        var blink = 0.55 + 0.45 * Math.sin(elapsed * 6);
        cranL.userData.beacon.material.color.setRGB(1, blink * 0.7, blink * 0.35);
        cranR.userData.beacon.material.color.setRGB(1, blink * 0.7, blink * 0.35);
      }

      cableGroup.visible = grow > 0.012 && grow < 0.999;
      if (cableGroup.visible) {
        if (Math.abs(grow - lastGrow) > 0.0012 || lastGrow < 0) rebuildCables(grow);
        cableMat.opacity = Math.max(0, Math.min(1, (1 - grow) / 0.012));
        cableMat.transparent = cableMat.opacity < 0.999;
      }

      updateSparks(sparkL, tipL, archY(tipL) + 2, cantilever, dt);
      updateSparks(sparkR, tipR, archY(tipR) + 2, cantilever, dt);

      if (grow >= 0.999) {
        if (!wasClosed) {
          closureTimer = 2.2;
          wasClosed = true;
        }
      } else {
        wasClosed = false;
      }
      closureTimer = Math.max(0, closureTimer - dt);
      updateSparks(closureSparks, 0, B.crownY - B.trussDepth, closureTimer > 0, dt);

      updateCars(dt, t > 0.94);
    }

    return {
      root: root,
      update: update,
      B: B,
      archY: archY,
      meshes: {
        arch: archMesh,
        deck: deckMesh,
        hangers: hangerMesh,
        approach: approachMesh
      }
    };
  }

  window.HBBridge = {
    B: B,
    archY: archY,
    createBridge: createBridge
  };
})();
