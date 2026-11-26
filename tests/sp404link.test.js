// módulo: extraer de index.html el bloque «sp404link.js» a ./sp404link.js antes de ejecutar
require('./sp404link.js'); require('./sim404.js');
const S4 = globalThis.TP.sp404, assert = require('assert');
// septetos según la especificación
assert.deepStrictEqual(Array.from(S4._test.sept(-1)), [0x7f,0x7f,0x7f,0x7f,0x7f]);
assert.deepStrictEqual(Array.from(S4._test.sept(0x8043CDE8|0)), [0x78,0x02,0x0F,0x1B,0x68]);
assert.strictEqual(S4._test.unsept(S4._test.sept(0x8043CDE8|0),0).i, 0x8043CDE8|0);
// trama corta del sondeo
assert.deepStrictEqual(Array.from(S4._test.msgShort(5,[0xfe,0x66,0x00])), [0x12,0x60,0xe0,0x05,0xfe,0x66,0,0,0,0,0,0x03]);
// md5 conocido
const hex = u => Buffer.from(u).toString('hex');
assert.strictEqual(hex(S4.md5(Buffer.from('abc'))), '900150983cd24fb0d6963f7d28e17f72');
assert.strictEqual(hex(S4.md5(new Uint8Array(0))), 'd41d8cd98f00b204e9800998ecf8427e');
const crypto=require('crypto'); for (let n of [16,55,56,63,64,65,1000]) { const b=crypto.randomBytes(n); assert.strictEqual(hex(S4.md5(b)), crypto.createHash('md5').update(b).digest('hex')); }
// cabecera SMP
const L = new Float32Array(48000).map((_,i)=>Math.sin(i/20)*0.5);
const smp = S4.smpFromFloat(L, L);
assert.strictEqual(smp.length, 512 + 48000*4);
const dv = new DataView(smp.buffer); assert.strictEqual(dv.getUint32(4), smp.length - 8);
assert.strictEqual(hex(smp.slice(0x20,0x30)), crypto.createHash('md5').update(smp.slice(4,20)).digest('hex'));
const back = S4.smpParse(smp); assert.strictEqual(back.L.length, 48000); assert(Math.abs(back.L[100]-L[100])<1e-3);
assert.strictEqual(S4.smpShift(smp, 12).length, 512 + 24000*4);
(async () => {
  const sim = new globalThis.Sim404({ project: 5 });
  const d = await S4.connect(m => {}, sim);
  const st = await d.status(); assert.strictEqual(st.project, 5); assert.strictEqual(st.bank, 1);
  const pj = await d.projectNames(5); assert.strictEqual(pj.name, 'PRUEBA'); assert.strictEqual(pj.names[15], 'PROJECT_16'); assert.strictEqual(pj.protected[3], true); assert.strictEqual(pj.protected[0], false);
  let prog = 0;
  await d.importSmp(17, smp, 'C3 Prueba', { gate: 1, pitch: -3 }, (a,b)=>prog=a/b);
  assert.strictEqual(prog, 1);
  const path = '/SP404REMOTE///ROLAND/SP-404MKII/PROJECT_06/SMPL/BANK2-02.SMP';
  assert.ok(sim.fs[path], 'archivo escrito'); assert.strictEqual(hex(sim.fs[path]), hex(smp));
  const b = await d.op(() => d.padBlock(17)); assert.strictEqual(b.size, smp.length); assert.strictEqual(b.name, 'C3 Prueba'); assert.strictEqual(b.pitch, -3); assert.strictEqual(b.gate, 1); assert.strictEqual(b.start, 512);
  const bank = await d.bank(1); assert.strictEqual(bank[1].has, true); assert.strictEqual(bank[0].has, false);
  const got = await d.readPad(17, ()=>{}); assert.strictEqual(hex(got), hex(smp));
  await d.preview(17, true); await d.preview(17, false);
  // orden de la importación como la app oficial
  const seq = sim.log.filter(x=>!x.startsWith('c5 fe')).join(' | ');
  assert.ok(/c5 9e \| c5 fb \| c5 91 \| c5 9d \| f a .*TMP \| f a .*SMP \| f 0 .*SMP \| f 7 \| (f 6 \| )+f 7 \| f 6 \| f 3 \| f 12 .*SMP \| c5 1e \| c5 9f \| c5 1 \| c5 1 \| c5 fc/.test(seq), seq);
  const t0 = Date.now(); await d.close(); assert.ok(sim.log.includes('close'));
  console.log('OK · secuencia:', seq.slice(0, 400), '· cierre tras', Date.now()-t0, 'ms');
})().catch(e => { console.error('FALLO', e); process.exit(1); });
