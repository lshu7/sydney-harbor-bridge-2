/* Shared geometry helpers — classic script, expects THREE global. */
(function () {
  'use strict';

  var UP = new THREE.Vector3(0, 1, 0);

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function easeOutCubic(t) {
    t = clamp01(t);
    return 1 - Math.pow(1 - t, 3);
  }

  function smoothRange(x, a, b) {
    return THREE.MathUtils.smoothstep(x, a, b);
  }

  /* A box member stretched between two world-space points. */
  function memberBox(p1, p2, width, depth) {
    var dir = new THREE.Vector3().subVectors(p2, p1);
    var len = dir.length();
    if (len < 1e-4) len = 1e-4;
    var geo = new THREE.BoxGeometry(width, len, depth);
    if (dir.length() > 1e-4) {
      dir.normalize();
      var q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q));
    }
    var mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    geo.translate(mid.x, mid.y, mid.z);
    return geo;
  }

  /* Merge non-indexed copies into one buffer geometry (position + normal). */
  function mergeGeos(geos) {
    var prepared = [];
    var total = 0;
    var i, g;
    for (i = 0; i < geos.length; i++) {
      g = geos[i];
      if (g.index) {
        var n = g.toNonIndexed();
        g.dispose();
        g = n;
      }
      prepared.push(g);
      total += g.attributes.position.count;
    }
    var pos = new Float32Array(total * 3);
    var nor = new Float32Array(total * 3);
    var offset = 0;
    for (i = 0; i < prepared.length; i++) {
      g = prepared[i];
      pos.set(g.attributes.position.array, offset * 3);
      if (g.attributes.normal) nor.set(g.attributes.normal.array, offset * 3);
      offset += g.attributes.position.count;
      g.dispose();
    }
    var merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.computeBoundingSphere();
    return merged;
  }

  /*
   * Standard material with a world-space reveal rule injected into the shader.
   * mode 'middle'  : discard when x is between a and b  (arch growing inward)
   * mode 'outside' : discard when |x| is greater than a  (deck from centre out)
   * mode 'inside'  : discard when |x| is less than a     (approach spans)
   * uniforms: { a: {value}, b: {value} }
   */
  var revealId = 0;

  function makeRevealMaterial(params, uniforms, mode) {
    var mat = new THREE.MeshStandardMaterial(params);
    var id = ++revealId;
    var condition;
    if (mode === 'middle') {
      condition = 'vRevealPos.x > uRevealA && vRevealPos.x < uRevealB';
    } else if (mode === 'outside') {
      condition = 'abs(vRevealPos.x) > uRevealA';
    } else if (mode === 'band') {
      condition = 'abs(vRevealPos.x) < uRevealA || abs(vRevealPos.x) > uRevealB';
    } else {
      condition = 'abs(vRevealPos.x) < uRevealA';
    }

    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uRevealA = uniforms.a;
      shader.uniforms.uRevealB = uniforms.b || uniforms.a;
      shader.vertexShader =
        'varying vec3 vRevealPos;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n  vRevealPos = (modelMatrix * vec4(transformed, 1.0)).xyz;'
        );
      shader.fragmentShader =
        'uniform float uRevealA;\nuniform float uRevealB;\nvarying vec3 vRevealPos;\n' +
        shader.fragmentShader.replace(
          '#include <clipping_planes_fragment>',
          '#include <clipping_planes_fragment>\n  if (' + condition + ') discard;'
        );
    };
    mat.customProgramCacheKey = function () { return 'reveal-' + mode + '-' + id; };
    return mat;
  }

  /* Deterministic PRNG so the skyline is identical on every load. */
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function formatInt(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  window.HBUtils = {
    clamp01: clamp01,
    lerp: lerp,
    easeOutCubic: easeOutCubic,
    smoothRange: smoothRange,
    memberBox: memberBox,
    mergeGeos: mergeGeos,
    makeRevealMaterial: makeRevealMaterial,
    mulberry32: mulberry32,
    formatInt: formatInt
  };
})();
