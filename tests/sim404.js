/* SP-404MKII simulada (según la especificación de SparkyMK2) para probar sp404link.js sin la máquina.
   new Sim() → transporte { write, close, onData, onClose } + estado (fs, pads, project). */
(function (root) {
  function Sim(opts) {
    opts = opts || {};
    var T = root.TP.sp404._test, self = this;
    this.project = opts.project || 0; this.fs = {}; this.handles = {}; this.nextH = 3; this.pads = []; this.log = [];
    this.params = {};
    for (var i = 0; i < 160; i++) { var b = new Uint8Array(327); b[0] = 0x1E; b[1] = i & 255; b[2] = i >> 8; for (var c = 0; c < 16; c++) { var o = 199 + c * 4; b[o] = b[o + 1] = b[o + 2] = b[o + 3] = 255; } this.pads.push(b); }
    this.dec = new T.Decoder(); this.kind = 'simulada'; this.slow = opts.slow || 0;
    this.write = function (u8) { self.dec.push(u8); var m; while ((m = self.dec.next())) self.handle(m); return Promise.resolve(); };
    this.close = function () { self.log.push('close'); return Promise.resolve(); };
    this.T = T;
  }
  Sim.prototype.out = function (ch, payload, short) {
    var self = this, T = this.T, msg = short ? T.msgShort(ch, payload) : T.msgLong(ch, payload);
    msg[1] = 0xE0; msg[2] = 0x60;
    // trocear en pedazos para probar el reensamblado
    setTimeout(function () { for (var i = 0; i < msg.length; i += 37) if (self.onData) self.onData(msg.slice(i, i + 37)); }, this.slow);
  };
  function le32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
  Sim.prototype.handle = function (m) {
    var p = m.p, T = this.T;
    if (m.ch === 5) {
      var c = p[0]; this.log.push('c5 ' + c.toString(16));
      if (c === 0xFE) { var s = new Uint8Array(19); s[0] = 0x7E; s[1] = this.project; s[3] = 1; s[5] = 2; return this.out(5, s); }
      if (c === 0xFD) { var a = new Uint8Array(147); a[0] = 0x7D; a[1] = p[1]; var nm = 'PRUEBA'; for (var i = 0; i < nm.length; i++) a[115 + i] = nm.charCodeAt(i); a[3 + 12 * 4 + 3 * 4] = 1; this.out(5, a); for (var k = 0; k < 16; k++) { var n = 'PROJECT_' + (k + 1); this.out(5, [0x35, k].concat(n.split('').map(function (x) { return x.charCodeAt(0); }))); } return; }
      if (c === 0x9E) { var pad = p[1] | p[2] << 8; return this.out(5, this.pads[pad]); }
      if (c === 0x1E) { var pd = p[1] | p[2] << 8; this.pads[pd].set(p.slice(0, 199)); return this.out(5, p.slice(0, 199)); }
      if (c === 0x01) { var tg = p[3] | p[4] << 8, v = (p[5] | p[6] << 8 | p[7] << 16 | p[8] << 24); this.params[p[1].toString(16) + '@' + tg] = v; if (tg < 160 && p[1] >= 0x66 && p[1] <= 0x7B) { var at = 3 + (p[1] - 0x66) * 4; this.pads[tg].set(le32(v), at); } return this.out(5, p); }
      if (c === 0x91) return this.out(5, [0x11, 0], true);
      if (c === 0x9D) return this.out(5, [0x1D, 0], true);
      if (c === 0x9F) { var pp = p[1] | p[2] << 8, f = this.fs[T_path(this.project, pp)]; return this.out(5, [0x1F, p[1], p[2], f && f.length === (this.pads[pp][3] | this.pads[pp][4] << 8 | this.pads[pp][5] << 16 | this.pads[pp][6] << 24) ? 0 : 5], true); }
      if (c === 0x8E) return this.out(5, [0x0E, p[1], p[2], 0], true);
      if (c === 0x8F) return this.out(5, [0x0F, p[1], p[2], 0], true);
      return;   // FB, FC, 3A: sin respuesta
    }
    if (m.ch === 6) {
      var op = p[4], first = T.unsept(p, 5), second = T.unsept(p, 10), tail = p.slice(15, p.length - 1), self = this;
      function path() { var s = ''; for (var i = 0; i < tail.length && tail[i]; i++) s += String.fromCharCode(tail[i]); return s; }
      function st(r, e) { var o = [0xF0, 0x41, 0x7A, 0x7A]; o = o.concat(Array.from(T.sept(r)), Array.from(T.sept(e == null ? 0 : e)), [0xF7]); self.out(6, new Uint8Array(o)); }
      function data(h, d, last) { var o = new Uint8Array(15 + d.length); o.set([0xF0, 0x41, 0x7A, 0x02]); o.set(T.sept(h), 4); o.set(T.sept(d.length, last ? 0x40 : 0), 9); o.set(d, 14); o[o.length - 1] = 0xF7; self.out(6, o); }
      this.log.push('f ' + op.toString(16) + (op === 0 || op === 0x0A || op === 0x12 ? ' ' + path() : ''));
      if (op === 0x00) { var pa = path(); if (first.i === 0 && !this.fs[pa]) return st(-1, 2); if (first.i === 0x602) this.fs[pa] = new Uint8Array(0); var h = this.nextH++; this.handles[h] = { path: pa, pos: 0, batch: 0 }; return st(h, 2); }
      if (op === 0x03) { delete this.handles[first.i]; return st(0); }
      if (op === 0x07) { this.handles[first.i].pos = second.u; return st(second.u); }
      if (op === 0x06) {
        var hd = this.handles[first.i], d = tail.slice(0, second.u), f = this.fs[hd.path], end = hd.pos + d.length;
        if (f.length < end) { var nf = new Uint8Array(end); nf.set(f); f = nf; } f.set(d, hd.pos); this.fs[hd.path] = f; hd.pos = end; hd.batch += d.length;
        if (second.last) { var b = hd.batch; hd.batch = 0; st(b); } return;
      }
      if (op === 0x0A) { var had = !!this.fs[path()]; delete this.fs[path()]; return st(had ? 0 : -1, had ? 0 : 2); }
      if (op === 0x12) { var ff = this.fs[path()]; if (!ff) return st(-1, 2); return data(0, new Uint8Array(le32(0x81FF).concat(le32(ff.length))), true); }
      if (op === 0x04) {
        var hh = this.handles[first.i], fl = this.fs[hh.path], want = second.u, part = fl.slice(hh.pos, hh.pos + want); hh.pos += part.length;
        if (!part.length) return data(first.i, new Uint8Array(0), true);
        for (var q = 0; q < part.length; q += 0x5000) data(first.i, part.slice(q, q + 0x5000), q + 0x5000 >= part.length);
        return;
      }
      return st(-1, 22);
    }
  };
  function T_path(project, pad) { return '/SP404REMOTE///' + root.TP.sp404.smpPath(project + 1, pad); }
  root.Sim404 = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
