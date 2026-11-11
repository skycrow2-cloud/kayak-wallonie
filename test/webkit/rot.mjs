// Test Safari (WebKit) : tiroir rabattu en portrait puis passage en paysage
import { webkit, devices } from 'playwright';
const b = await webkit.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8765/'); await p.waitForTimeout(4000);
const info = async tag => console.log(tag, JSON.stringify(await p.evaluate(() => {
  const t = document.querySelector('#panel-toggle'), q = t.getBoundingClientRect(), cs = getComputedStyle(t), pn = document.querySelector('#panel').getBoundingClientRect();
  const hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
  return { cls: document.body.className, vw: innerWidth, vh: innerHeight, mqSheet: matchMedia('(max-width:760px) and (min-height:501px)').matches,
    mqLand: matchMedia('(max-height:500px) and (orientation:landscape)').matches, toggle: [q.x, q.y, q.width, q.height].map(Math.round),
    disp: cs.display, vis: cs.visibility, op: cs.opacity, top: cs.top, bottom: cs.bottom, left: cs.left, tr: cs.transform, z: cs.zIndex,
    hit: hit && (hit.id || hit.className?.baseVal || hit.className || hit.tagName), panel: [pn.x, pn.y, pn.width, pn.height].map(Math.round) };
})));
await info('portrait'); await p.screenshot({ path: 'shots/1-portrait.png' });
await p.tap('#panel-toggle'); await p.waitForTimeout(700); await info('peek'); await p.screenshot({ path: 'shots/2-peek.png' });
await p.setViewportSize({ width: 844, height: 340 }); await p.waitForTimeout(1200); await info('paysage'); await p.screenshot({ path: 'shots/3-paysage.png' });
await p.setViewportSize({ width: 390, height: 664 }); await p.waitForTimeout(1200); await info('retour'); await p.screenshot({ path: 'shots/4-retour.png' });
await b.close();
