const { chromium } = require('playwright');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
async function setup(width = 1440) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERR ' + e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push('CONSOLE ' + m.text().slice(0, 200)); });
  p.on('response', r => { if (r.status() >= 500) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
  return { b, ctx, p, errors };
}
let fails = 0;
async function step(p, errors, name, fn) {
  const before = errors.length;
  try {
    await fn();
    const newErr = errors.slice(before);
    console.log((newErr.length ? 'WARN ' : 'PASS ') + name + (newErr.length ? ' :: ' + newErr.join(' | ') : ''));
  } catch (e) {
    fails++;
    console.log('FAIL ' + name + ' :: ' + e.message.split('\n')[0].slice(0, 250));
    await p.screenshot({ path: `shots/fail-${name.replace(/\W+/g, '_')}.png` }).catch(() => {});
  }
}
async function toast(p, text) {
  await p.getByText(text, { exact: false }).first().waitFor({ timeout: 10000 });
}
async function select(p, label, option, scope) {
  const s = scope ?? p;
  await s.getByLabel(label, { exact: true }).click();
  const esc = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await p.getByRole('option', { name: new RegExp('^' + esc + '( ·|$)') }).first().click();
}
async function dialog(p) { const d = p.getByRole('dialog'); await d.waitFor(); return d; }
async function save(d) { await d.locator('button[type=submit]').click(); }
async function closedDialog(p) { await p.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 }); }
module.exports = { setup, step, toast, select, dialog, save, closedDialog, BASE, get fails() { return fails; } };
