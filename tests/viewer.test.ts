import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

let serial = 0;
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
async function viewer(t, files = ['/art/photo1.jpg', '/art/photo2.jpg'], restore = false) {
  const dom = new JSDOM(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), { url: 'http://localhost' });
  const { window } = dom;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const name of ['window', 'document', 'HTMLElement', 'localStorage']) {
    const old = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value: name === 'window' ? window : window[name] });
    t.after(() => old ? Object.defineProperty(globalThis, name, old) : delete globalThis[name]);
  }
  let selected = { folder: '/art', files };
  if (restore) window.localStorage.setItem('vitrine.settings.v1', JSON.stringify({ folder: '/art', seconds: 7, shuffle: false }));
  const commands = [];
  globalThis.isTauri = true;
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' } },
    convertFileSrc: path => `http://asset.localhost${path}`,
    invoke: async (command, args) => {
      commands.push({ command, args });
      if (command === 'choose_folder' || command === 'load_folder') return selected;
      if (command === 'plugin:window|is_fullscreen') return false;
    },
  };
  globalThis.Image = function () {
    const img = window.document.createElement('img');
    Object.defineProperty(img, 'src', { set(path) {
      img.setAttribute('src', path);
      const finish = () => img.dispatchEvent(new window.Event(path.includes('bad') ? 'error' : 'load'));
      if (path.includes('slow')) setTimeout(finish, 5000);
      else queueMicrotask(finish);
    }, get() { return img.getAttribute('src'); } });
    return img;
  };
  t.after(() => { delete globalThis.Image; delete globalThis.isTauri; dom.window.close(); });
  await import(`../src/main.ts?test=${serial++}`);
  const $ = id => window.document.getElementById(id);
  if (!restore) $('start').click();
  await flush();
  return { $, window, commands, choose: async value => { selected = value; $('choose').click(); await flush(); } };
}

test('automatic advancement leaves hidden controls hidden', async t => {
  const { $, window } = await viewer(t);
  t.mock.timers.tick(3000); await flush();
  assert.equal(window.document.body.classList.contains('quiet'), true);
  t.mock.timers.tick(27000); await flush();
  assert.equal($('filename').textContent, 'photo2.jpg');
  assert.equal(window.document.body.classList.contains('quiet'), true);
});
test('keyboard navigation works with a toolbar button focused', async t => {
  const { $, window, commands } = await viewer(t);
  $('next').focus();
  $('next').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await flush();
  assert.equal($('filename').textContent, 'photo2.jpg');
  $('next').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'f', bubbles: true }));
  await flush();
  assert.ok(commands.some(c => c.command === 'plugin:window|set_fullscreen' && c.args.value));
});
test('bad images are skipped and all-bad folders terminate with a usable chooser', async t => {
  const { $, choose } = await viewer(t, ['/art/bad1.jpg', '/art/photo2.jpg']);
  assert.equal($('filename').textContent, 'photo2.jpg');
  assert.match($('counter').textContent, /1 skipped/);
  await choose({ folder: '/bad', files: ['/bad/bad1.jpg', '/bad/bad2.jpg'] });
  assert.match($('message').textContent, /None of the images/);
  assert.equal($('welcome').hidden, false);
  assert.equal($('start').disabled, false);
  t.mock.timers.tick(60000); await flush();
  assert.equal($('artwork').children.length, 0);
});
test('pause stops automatic playback, interval persists, and cancelling preserves the album', async t => {
  const { $, window, choose } = await viewer(t);
  $('pause').click();
  t.mock.timers.tick(60000); await flush();
  assert.equal($('filename').textContent, 'photo1.jpg');
  $('seconds').value = '5';
  $('seconds').dispatchEvent(new window.Event('change'));
  assert.equal(JSON.parse(window.localStorage.getItem('vitrine.settings.v1')).seconds, 5);
  await choose(null);
  assert.equal($('filename').textContent, 'photo1.jpg');
  $('pause').click();
  t.mock.timers.tick(5000); await flush();
  assert.equal($('filename').textContent, 'photo2.jpg');
});

test('startup restores the selected folder and playback interval', async t => {
  const { $, commands } = await viewer(t, ['/art/photo1.jpg'], true);
  assert.equal($('filename').textContent, 'photo1.jpg');
  assert.equal($('seconds').value, '7');
  assert.ok(commands.some(c => c.command === 'load_folder' && c.args.folder === '/art'));
});

test('interaction during slow image loading still lets the controls fade', async t => {
  const { $, window } = await viewer(t, ['/art/photo1.jpg', '/art/slow2.jpg']);
  t.mock.timers.tick(2000); await flush();
  $('next').click();
  window.dispatchEvent(new window.Event('pointermove'));
  t.mock.timers.tick(3000); await flush();
  assert.equal($('filename').textContent, 'slow2.jpg');
  assert.equal(window.document.body.classList.contains('quiet'), true);
});
