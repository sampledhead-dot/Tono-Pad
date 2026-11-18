function tpFuzz(root) {
  'use strict';
  /* FuzzHead dentro de TonoPad: los 5 motores de FuzzHead como sonidos de pad y su cadena de efectos
     (distorsión, modulación, bitcrush, ring mod, gated reverb). El DSP es el mismo que el de FuzzHead
     (repositorio FuzzHead, web/dsp.js v1.0.1); si se cambia allí, hay que cambiarlo aquí igual. */
  var TP = root.TP = root.TP || {};
  var F = TP.fuzz = {};
  var TWO_PI = Math.PI * 2;
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function db2lin(d) { return Math.pow(10, d / 20); }

  // ---------------------------------------------------------------- osciladores y filtro (FuzzHead)
  function blep(t, dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1; }
    if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
    return 0;
  }
  function saw(p, dt) { return 2 * p - 1 - blep(p, dt); }
  function pulse(p, dt, pw) { var v = p < pw ? 1 : -1; v += blep(p, dt); var q = p - pw; if (q < 0) q += 1; return v - blep(q, dt); }
  function SVF() { this.ic1 = 0; this.ic2 = 0; this.lastFc = -1; this.g = 0; }
  SVF.prototype.lp = function (v0, fc, q, sr) {
    if (Math.abs(fc - this.lastFc) > fc * 0.002) { this.lastFc = fc; this.g = Math.tan(Math.PI * clamp(fc, 20, sr * 0.45) / sr); }
    var g = this.g, k = 1 / q, a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    var v3 = v0 - this.ic2, v1 = a1 * this.ic1 + a2 * v3, v2 = this.ic2 + a2 * this.ic1 + a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    return v2;
  };
  function Voice(engine, sr, ratio, seed) {
    var r = seed || 1; function rnd() { r = (r * 1103515245 + 12345) >>> 0; return r / 4294967296; }
    this.engine = engine; this.sr = sr; this.ratio = ratio;
    this.p1 = rnd(); this.p2 = rnd(); this.p3 = rnd(); this.p4 = rnd(); this.f1 = new SVF();
  }
  Voice.prototype.tick = function (freq, ampN) {
    var sr = this.sr, f = freq * this.ratio, dt = f / sr, v;
    switch (this.engine) {
      case 'deep':
        this.p1 += dt; if (this.p1 >= 1) this.p1 -= 1; this.p2 += dt * 0.5; if (this.p2 >= 1) this.p2 -= 1;
        v = 0.65 * Math.sin(TWO_PI * this.p1) + 0.55 * Math.sin(TWO_PI * this.p2) + 0.2 * saw(this.p1, dt);
        v = this.f1.lp(v, Math.min(f * 3 + 150, 1500), 0.7, sr);
        return Math.tanh(1.6 * v) / Math.tanh(1.6);
      case 'solo':
        // en FuzzHead la 2.ª onda va +5 cents; en los pads se reparte a ambos lados (−2,6 / +2,6) para que la nota quede centrada
        var dt1 = dt * 0.9985; this.p1 += dt1; if (this.p1 >= 1) this.p1 -= 1;
        var dt3 = dt * 1.0015; this.p3 += dt3; if (this.p3 >= 1) this.p3 -= 1;
        v = 0.6 * saw(this.p1, dt1) + 0.5 * pulse(this.p3, dt3, 0.3);
        v = this.f1.lp(v, clamp(f * 8 * (0.6 + 0.8 * ampN), 500, 10000), 2.2, sr);
        return Math.tanh(2 * v) * 0.6;
      case 'strings':
        var d1 = dt * 0.9954, d3 = dt * 1.0046, d4 = dt * 2;
        this.p1 += d1; if (this.p1 >= 1) this.p1 -= 1; this.p2 += dt; if (this.p2 >= 1) this.p2 -= 1;
        this.p3 += d3; if (this.p3 >= 1) this.p3 -= 1; this.p4 += d4; if (this.p4 >= 1) this.p4 -= 1;
        v = saw(this.p1, d1) + saw(this.p2, dt) + saw(this.p3, d3) + 0.25 * saw(this.p4, d4);
        return this.f1.lp(v, clamp(f * 5, 400, 6000), 0.6, sr) * 0.4;
      default: // vintage y harmony
        this.p1 += dt; if (this.p1 >= 1) this.p1 -= 1;
        v = 0.55 * saw(this.p1, dt) + 0.45 * pulse(this.p1, dt, 0.5);
        return this.f1.lp(v, clamp(f * (this.engine === 'harmony' ? 6 : 4.5), 250, 5000), 0.8, sr) * 0.9;
    }
  };
  // ataque (s) y caída (constante de tiempo, s) de cada motor tocado como pad
  var ENV = { deep: [0.005, 1.1], vintage: [0.006, 1.5], solo: [0.003, 1.9], strings: [0.12, 3.5], harmony: [0.006, 1.6] };

  /* Una nota con un motor de FuzzHead (devuelve {L, R} como TP.renderNote) */
  F.renderNote = function (midi, preset, dur, sr, cents) {
    var engine = preset.fh, f = 440 * Math.pow(2, (midi - 69) / 12) * Math.pow(2, (cents || 0) / 1200);
    var N = Math.max(1, Math.floor(dur * sr)), out = new Float32Array(N), e = ENV[engine] || ENV.vintage;
    var ratios = [1]; if (engine === 'harmony') { ratios.push(Math.pow(2, (preset.int1 == null ? 7 : preset.int1) / 12)); if (preset.int2 !== null) ratios.push(Math.pow(2, (preset.int2 == null ? 12 : preset.int2) / 12)); }
    var voices = ratios.map(function (r, k) { return new Voice(engine, sr, r, 12345 + k * 777 + midi); });
    var rel = Math.min(0.06, dur * 0.2), relN = Math.floor(rel * sr), norm = 1 / Math.sqrt(ratios.length), pk = 0, n, k;
    for (n = 0; n < N; n++) {
      var t = n / sr, a = (t < e[0] ? t / e[0] : 1) * Math.exp(-t / e[1]);
      if (n > N - relN) a *= (N - n) / relN;
      var s = 0; for (k = 0; k < voices.length; k++) s += voices[k].tick(f, Math.min(1, a));
      out[n] = s * norm * a; if (Math.abs(out[n]) > pk) pk = Math.abs(out[n]);
    }
    if (pk > 0) { var g = 0.85 / pk; for (n = 0; n < N; n++) out[n] *= g; }
    return { L: out, R: new Float32Array(out) };
  };

  // ---------------------------------------------------------------- efectos (FuzzHead)
  function distShape(mode, u) {
    switch (mode) {
      case 'hard': var v = 1.2 * u; return v > 1 ? 1 : (v < -1 ? -1 : v);
      case 'rich': return Math.tanh(u + 0.35 * u * u / (1 + u * u));
      case 'wavefold': return Math.sin(Math.PI / 2 * u);
      default: return Math.tanh(u);
    }
  }
  function distortion(ch, sr, p) {
    var g = p.distGain, mode = p.distMode, drive = mode === 'wavefold' ? 1 + g * 12 : db2lin(g * 40);
    var comp = mode === 'wavefold' ? 0.7 : 0.3 / Math.max(1e-3, Math.abs(distShape(mode, 0.3 * drive)));
    var lpHz = mode === 'soft' ? 7000 : (mode === 'rich' ? 5000 : 0), lpC = lpHz ? 1 - Math.exp(-TWO_PI * lpHz / sr) : 1, dcR = 1 - TWO_PI * 20 / sr;
    ch.forEach(function (b) {
      var lp = 0, x1 = 0, y1 = 0;
      for (var i = 0; i < b.length; i++) {
        var y = distShape(mode, b[i] * drive) * comp;
        if (lpHz) { lp += (y - lp) * lpC; y = lp; }
        var o = y - x1 + dcR * y1; x1 = y; y1 = o; b[i] = o;
      }
    });
  }
  function bitcrush(ch, sr, p) {
    var step = Math.min(p.crushRate, 44100) / sr, bits = Math.round(p.crushBits), q = Math.pow(2, bits - 1);
    ch.forEach(function (b) {
      var ph = 1, held = 0;
      for (var i = 0; i < b.length; i++) {
        if (step >= 1) held = b[i]; else { ph += step; if (ph >= 1) { ph -= 1; held = b[i]; } }
        b[i] = bits >= 24 ? held : Math.round(held * q) / q;
      }
    });
  }
  function ringmod(ch, sr, p) {
    var w = TWO_PI * p.ringFreq / sr, m = p.ringMix;
    ch.forEach(function (b) { for (var i = 0; i < b.length; i++) b[i] = b[i] * (1 - m) + b[i] * Math.sin(w * i) * m; });
  }
  function makeFFT(n) {
    var levels = Math.log2(n) | 0, rev = new Uint32Array(n), i, j;
    for (i = 0; i < n; i++) { var r = 0, x = i; for (j = 0; j < levels; j++) { r = (r << 1) | (x & 1); x >>= 1; } rev[i] = r; }
    var cs = new Float64Array(n / 2), sn = new Float64Array(n / 2);
    for (i = 0; i < n / 2; i++) { cs[i] = Math.cos(TWO_PI * i / n); sn[i] = Math.sin(TWO_PI * i / n); }
    return function (re, im, inverse) {
      var i, t;
      for (i = 0; i < n; i++) { var j = rev[i]; if (j > i) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
      for (var size = 2; size <= n; size <<= 1) {
        var half = size >> 1, step = n / size;
        for (i = 0; i < n; i += size) for (var a = i, k = 0; a < i + half; a++, k += step) {
          var c = cs[k], s = inverse ? sn[k] : -sn[k], l = a + half, tr = re[l] * c - im[l] * s, ti = re[l] * s + im[l] * c;
          re[l] = re[a] - tr; im[l] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
      if (inverse) for (i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    };
  }
  function makeGatedIR(sr, timeMs, seed) {
    var L = Math.max(16, Math.round((0.025 + timeMs / 1000) * sr)), ir = new Float32Array(L), s = seed >>> 0, i;
    function rnd() { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; }
    var rise = Math.max(1, Math.round(Math.min(0.004 * sr, L * 0.1))), fall = Math.max(1, Math.round(Math.min(0.006 * sr, L * 0.15))), ph = (seed % 7) * 0.9;
    var hpX = 0, hpY = 0, lp = 0, hpR = 1 - TWO_PI * 200 / sr, lpC = 1 - Math.exp(-TWO_PI * 6500 / sr), E = 0;
    for (i = 0; i < L; i++) {
      var e = 1 - 0.4 * (i / L); if (i < rise) e *= i / rise; if (i > L - fall) e *= (L - i) / fall;
      e *= 1 + 0.15 * Math.sin(TWO_PI * 7 * i / sr + ph);
      var v = rnd() * e; lp += (v - lp) * lpC; v = lp;
      var o = v - hpX + hpR * hpY; hpX = v; hpY = o; ir[i] = o; E += o * o;
    }
    var k = 0.6 / Math.sqrt(E || 1); for (i = 0; i < L; i++) ir[i] *= k;
    return ir;
  }
  function fftConvolve(x, ir) {
    var N = x.length, L = ir.length, B = 1; while (B < L) B <<= 1;
    var n = 2 * B, fft = makeFFT(n), hRe = new Float64Array(n), hIm = new Float64Array(n), out = new Float32Array(N), re = new Float64Array(n), im = new Float64Array(n), i;
    hRe.set(ir); fft(hRe, hIm, false);
    for (var pos = 0; pos < N; pos += B) {
      re.fill(0); im.fill(0); var len = Math.min(B, N - pos);
      for (i = 0; i < len; i++) re[i] = x[pos + i];
      fft(re, im, false);
      for (i = 0; i < n; i++) { var r = re[i] * hRe[i] - im[i] * hIm[i], q = re[i] * hIm[i] + im[i] * hRe[i]; re[i] = r; im[i] = q; }
      fft(re, im, true);
      var lim = Math.min(n, N - pos); for (i = 0; i < lim; i++) out[pos + i] += re[i];
    }
    return out;
  }
  function gatedReverb(ch, sr, p) {
    var N = ch[0].length, mono = new Float32Array(N), i;
    for (i = 0; i < N; i++) mono[i] = 0.5 * (ch[0][i] + ch[1][i]);
    var wl = fftConvolve(mono, makeGatedIR(sr, p.revTime, 0x9E3779B1)), wr = fftConvolve(mono, makeGatedIR(sr, p.revTime, 0x85EBCA6B)), m = p.revMix;
    for (i = 0; i < N; i++) { ch[0][i] = ch[0][i] * (1 - m) + wl[i] * m; ch[1][i] = ch[1][i] * (1 - m) + wr[i] * m; }
  }
  // Modulación de FuzzHead (dos voces desafinadas ±30 cents a la izquierda y derecha) aplicada a una muestra:
  // aquí las voces se obtienen leyendo la muestra un poco más lenta / más rápida.
  function modulation(ch, p) {
    var N = ch[0].length, c = p.modDepth * 30, mix = p.modMix, rf = Math.pow(2, -c / 1200), rs = Math.pow(2, c / 1200), norm = 1 / (1 + 0.6 * mix), i;
    var mono = new Float32Array(N); for (i = 0; i < N; i++) mono[i] = 0.5 * (ch[0][i] + ch[1][i]);
    function read(pos) { var a = Math.floor(pos), fr = pos - a; return a + 1 < N ? mono[a] * (1 - fr) + mono[a + 1] * fr : 0; }
    for (i = 0; i < N; i++) {
      var fl = read(i * rf) * mix, sh = read(i * rs) * mix;
      ch[0][i] = (ch[0][i] + 0.9 * fl + 0.1 * sh) * norm; ch[1][i] = (ch[1][i] + 0.1 * fl + 0.9 * sh) * norm;
    }
  }

  F.DEFAULT_FX = {
    on: false, who: 'AB', mix: 1,
    distOn: false, distGain: 0.35, distMode: 'soft', distPre: true, distPost: false,
    modOn: false, modDepth: 0.4, modMix: 0.5,
    crushOn: false, crushRate: 44100, crushBits: 24,
    ringOn: false, ringFreq: 440, ringMix: 0.5,
    revOn: false, revTime: 300, revMix: 0.35,
    order: ['crush', 'ring', 'rev']
  };
  // Combinaciones de efectos de los presets de fábrica de FuzzHead
  F.FX_PRESETS = [
    { id: 'none', name: 'Sin efectos', fx: {} },
    { id: 'lofi', name: 'Lo-fi cassette', fx: { crushOn: true, crushRate: 9000, crushBits: 9, distOn: true, distMode: 'soft', distGain: 0.3 } },
    { id: 'fold', name: 'Fuzz plegado', fx: { distOn: true, distMode: 'wavefold', distGain: 0.55, distPre: false, distPost: true } },
    { id: 'bells', name: 'Campanas metálicas', fx: { ringOn: true, ringFreq: 830, ringMix: 0.6, revOn: true, revTime: 350, revMix: 0.3, order: ['ring', 'rev', 'crush'] } },
    { id: 'boom', name: 'Explosión gated', fx: { distOn: true, distMode: 'hard', distGain: 0.4, revOn: true, revTime: 550, revMix: 0.55 } },
    { id: 'wide', name: 'Coro ancho', fx: { modOn: true, modDepth: 0.5, modMix: 0.6, revOn: true, revTime: 300, revMix: 0.25 } },
    { id: 'rich', name: 'Saturado rico', fx: { distOn: true, distMode: 'rich', distGain: 0.45, modOn: true, modDepth: 0.25, modMix: 0.4 } }
  ];
  F.active = function (fx) { return !!(fx && fx.on && (fx.distOn || fx.modOn || fx.crushOn || fx.ringOn || fx.revOn) && fx.mix > 0); };
  F.signature = function (fx) {
    var k = ['mix', 'distOn', 'distGain', 'distMode', 'distPre', 'distPost', 'modOn', 'modDepth', 'modMix', 'crushOn', 'crushRate', 'crushBits', 'ringOn', 'ringFreq', 'ringMix', 'revOn', 'revTime', 'revMix'];
    return 'fx:' + k.map(function (x) { return fx[x]; }).join(',') + ',' + fx.order.join('>');
  };

  /* Aplica la cadena de FuzzHead a un sonido {L, R}; devuelve otro {L, R} (más largo si hay reverb) */
  F.applyFx = function (o, sr, fx) {
    var p = fx, tail = p.revOn ? Math.round((p.revTime / 1000 + 0.05) * sr) : 0, N = o.L.length + tail, i;
    var L = new Float32Array(N), R = new Float32Array(N); L.set(o.L); R.set(o.R || o.L);
    var ch = [L, R];
    if (p.modOn && p.modDepth > 0 && p.modMix > 0) modulation(ch, p);
    var pre = p.distPre || !p.distPost;
    if (p.distOn && pre) distortion(ch, sr, p);
    p.order.forEach(function (fxid) {
      if (fxid === 'crush' && p.crushOn) bitcrush(ch, sr, p);
      if (fxid === 'ring' && p.ringOn) ringmod(ch, sr, p);
      if (fxid === 'rev' && p.revOn) gatedReverb(ch, sr, p);
    });
    if (p.distOn && p.distPost) distortion(ch, sr, p);
    var m = clamp(p.mix, 0, 1), pk = 0;
    for (i = 0; i < N; i++) {
      var dl = i < o.L.length ? o.L[i] : 0, dr = i < o.L.length ? (o.R || o.L)[i] : 0;
      L[i] = dl * (1 - m) + L[i] * m; R[i] = dr * (1 - m) + R[i] * m;
      pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    }
    if (pk > 0.95) { var g = 0.89 / pk; for (i = 0; i < N; i++) { L[i] *= g; R[i] *= g; } }
    return { L: L, R: R };
  };
}
tpFuzz(typeof window !== 'undefined' ? window : globalThis);
