const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: fs.readdirSync('/opt/pw-browsers').includes('chromium-1243') ? undefined : undefined });
  const pg = await b.newPage({ viewport: { width: 390, height: 900 } });
  const errs = []; pg.on('pageerror', e => errs.push('pageerror ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  pg.on('dialog', d => { console.log('DIALOG', d.message().slice(0, 120)); d.accept(); });
  await pg.addInitScript({ path: '/home/claude/work/sim404.js' });
  await pg.addInitScript({ path: '/home/claude/work/e2e/fake.js' });
  await pg.goto('http://127.0.0.1:8765/index.html');
  await pg.waitForTimeout(1500);
  console.log('version', await pg.textContent('#ver'));
  await pg.click('#spConn');
  await pg.waitForSelector('#spBox:not([hidden])', { timeout: 15000 });
  await pg.waitForTimeout(1500);
  console.log('info', (await pg.textContent('#spInfo')).slice(0, 120));
  console.log('pads', await pg.$$eval('#spPads .spPad', x => x.map(e => e.textContent).join(' | ')));
  // pad B5 elegido (estado de la SP: banco 1, pad 2 → B3); elegir B5
  await pg.click('#spPads .spPad[data-i="4"]');
  console.log('sel', await pg.textContent('#spSel'));
  // repartir con el Pitch de la SP al banco C
  await pg.evaluate(() => { document.getElementById('spSpread').open = true; });
  await pg.selectOption('#spSpMode', 'sp'); await pg.selectOption('#spSpBank', '2');
  await pg.click('#spSpGo');
  await pg.waitForFunction(() => /Listo|No se ha podido/.test(document.getElementById('spMsg').textContent), null, { timeout: 120000 });
  console.log('msg', await pg.textContent('#spMsg'));
  console.log('C', await pg.$$eval('#spPads .spPad', x => x.map(e => e.textContent).join(' | ')));
  const pitches = await pg.evaluate(() => { const s = window.__sim, out = []; for (let i = 32; i < 48; i++) { const dv = new DataView(s.pads[i].buffer); out.push([dv.getUint32(3, true), dv.getInt32(3 + (0x73 - 0x66) * 4, true), dv.getUint32(3 + 4 * 4, true)]); } return out; });
  console.log('C pitch/gate', JSON.stringify(pitches.map(p => p[1] + (p[2] ? 'g' : ''))));
  // enviar los bancos A y B de TonoPad a A y B (B está ocupado en B5 → pregunta)
  await pg.click('#spSend');
  await pg.waitForFunction(() => /Enviado|No se ha podido/.test(document.getElementById('spMsg').textContent), null, { timeout: 240000 });
  console.log('msg', await pg.textContent('#spMsg'));
  const files = await pg.evaluate(() => Object.keys(window.__sim.fs).filter(k => /BANK[12]-/.test(k)).length);
  console.log('archivos bancos 1-2', files);
  // con TonoPad: el pad B5 → muestra → banco D
  await pg.selectOption('#spBank', '1'); await pg.waitForTimeout(800);
  await pg.click('#spPads .spPad[data-i="4"]');
  await pg.selectOption('#spSpMode', 'tp'); await pg.selectOption('#spSpBank', '4');
  await pg.click('#spSpGo');
  await pg.waitForFunction(() => /Enviado|No se ha podido/.test(document.getElementById('spMsg').textContent), null, { timeout: 240000 });
  console.log('msg', await pg.textContent('#spMsg'));
  console.log('D', await pg.$$eval('#spPads .spPad', x => x.map(e => e.textContent).join(' | ')));
  await pg.screenshot({ path: '/home/claude/work/e2e/sp.png', fullPage: false, clip: await (await pg.$('#secSp')).boundingBox() });
  await pg.click('#spDisc'); await pg.waitForTimeout(4000);
  console.log('tras desconectar', await pg.textContent('#spMsg'), 'log', (await pg.evaluate(() => window.__sim.log.slice(-3))).join(','));
  console.log('ERRORES', errs.length ? errs.join('\n') : 'ninguno');
  await b.close();
})().catch(e => { console.error('FALLO', e); process.exit(1); });
