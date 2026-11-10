import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Playlist, readSettings } from './playback.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const artwork = $('artwork');
const welcome = $('welcome');
const chrome = $('chrome');
const message = $('message');
const seconds = $<HTMLInputElement>('seconds');
const order = $<HTMLSelectElement>('order');
const pause = $<HTMLButtonElement>('pause');
const choose = $<HTMLButtonElement>('choose');
const start = $<HTMLButtonElement>('start');
const key = 'vitrine.settings.v1';
let stored: string | null = null;
try { stored = localStorage.getItem(key); } catch { /* Playback works without storage. */ }
const settings = readSettings(stored);
let playlist = new Playlist([], false);
let files: string[] = [];
let paused = false;
let ready = false;
let choosing = false;
let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
const failed = new Set<string>();
let preload: { path: string; promise: Promise<HTMLImageElement | null> } | undefined;

interface Album { folder: string; files: string[] }
const basename = (path: string) => path.split(/[\\/]/).pop() || path;
function save() {
  try { localStorage.setItem(key, JSON.stringify(settings)); }
  catch { message.textContent = 'Your settings could not be saved. Playback will still work.'; }
}
function stopTimer() { clearTimeout(timer); }
function schedule() {
  stopTimer();
  if (!paused && ready && files.length - failed.size > 1) {
    timer = setTimeout(() => { void advance(1); }, settings.seconds * 1000);
  }
}
function reveal() {
  document.body.classList.remove('quiet');
  clearTimeout(hideTimer);
  if (files.length && !paused && !choosing) hideTimer = setTimeout(() => {
    if (!chrome.matches(':focus-within') && !chrome.querySelector('header:hover, footer:hover') && !message.textContent) {
      document.body.classList.add('quiet');
    }
  }, 3000);
}
function loadImage(path: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const image = new Image();
    const timeout = setTimeout(() => finish(null), 15000);
    function finish(value: HTMLImageElement | null) {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      resolve(value);
    }
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.alt = basename(path);
    image.src = convertFileSrc(path);
  });
}
async function show(direction = 1) {
  const request = ++generation;
  const currentPlaylist = playlist;
  ready = false;
  stopTimer();
  for (let attempt = 0; attempt < currentPlaylist.files.length; attempt++) {
    const path = currentPlaylist.current!;
    if (!failed.has(path)) {
      const image = await (preload?.path === path ? preload.promise : loadImage(path));
      if (request !== generation) return;
      if (image) {
        artwork.replaceChildren(image);
        welcome.hidden = true;
        chrome.hidden = false;
        $('filename').textContent = basename(path);
        $('counter').textContent = `${currentPlaylist.position} / ${files.length}${failed.size ? ` · ${failed.size} skipped` : ''}`;
        message.textContent = '';
        ready = true;
        const next = currentPlaylist.next;
        preload = next && next !== path && !failed.has(next) ? { path: next, promise: loadImage(next) } : undefined;
        schedule();
        return;
      }
      failed.add(path);
    }
    currentPlaylist.move(direction);
  }
  if (request !== generation) return;
  artwork.replaceChildren();
  welcome.hidden = false;
  chrome.hidden = true;
  message.textContent = files.length ? 'None of the images in this folder could be displayed. Try another folder.' : 'No supported images found. Choose a folder containing JPEG, PNG, WebP, GIF, AVIF, or BMP files.';
  reveal();
}
async function advance(direction: number) {
  if (!files.length || choosing) return;
  playlist.move(direction);
  await show(direction);
}
function acceptAlbum(album: Album) {
  ++generation;
  stopTimer();
  settings.folder = album.folder;
  files = album.files;
  failed.clear();
  preload = undefined;
  playlist = new Playlist(files, settings.shuffle);
  $('folder-name').textContent = basename(album.folder);
  $('folder-name').title = album.folder;
  save();
  void show().then(reveal);
}
async function pickFolder() {
  if (choosing) return;
  if (!isTauri()) { message.textContent = 'Open the desktop app to choose a local folder (pnpm tauri dev).'; return; }
  choosing = true;
  choose.disabled = start.disabled = true;
  stopTimer();
  reveal();
  try {
    const album = await invoke<Album | null>('choose_folder');
    if (album) acceptAlbum(album);
  } catch (error) { message.textContent = String(error); }
  finally { choosing = false; choose.disabled = start.disabled = false; schedule(); reveal(); }
}
function togglePause() {
  paused = !paused;
  pause.textContent = paused ? 'Play' : 'Pause';
  schedule();
  reveal();
}
async function fullscreen(exit = false) {
  try {
    if (isTauri()) {
      const window = getCurrentWindow();
      await window.setFullscreen(exit ? false : !(await window.isFullscreen()));
    } else if (document.fullscreenElement) await document.exitFullscreen();
    else if (!exit) await document.documentElement.requestFullscreen();
  } catch (error) { message.textContent = `Could not change fullscreen: ${error}`; reveal(); }
}
seconds.value = String(settings.seconds);
order.value = settings.shuffle ? 'shuffle' : 'ordered';
chrome.hidden = true;
start.addEventListener('click', () => { void pickFolder(); });
choose.addEventListener('click', () => { void pickFolder(); });
$('previous').addEventListener('click', () => { void advance(-1); });
$('next').addEventListener('click', () => { void advance(1); });
pause.addEventListener('click', togglePause);
$('fullscreen').addEventListener('click', () => { void fullscreen(); });
seconds.addEventListener('change', () => {
  if (!seconds.checkValidity() || !Number.isFinite(seconds.valueAsNumber)) {
    seconds.value = String(settings.seconds); return;
  }
  settings.seconds = seconds.valueAsNumber;
  save(); schedule();
});
order.addEventListener('change', () => {
  settings.shuffle = order.value === 'shuffle';
  playlist = new Playlist(files, settings.shuffle);
  preload = undefined;
  save(); void show();
});
window.addEventListener('pointermove', reveal);
window.addEventListener('pointerdown', reveal);
window.addEventListener('focusin', reveal);
window.addEventListener('focusout', reveal);
window.addEventListener('keydown', event => {
  reveal();
  if (event.key === 'Escape') { void fullscreen(true); return; }
  if (event.target instanceof HTMLElement) {
    if (event.target.closest('input, select')) return;
    if (event.key === ' ' && event.target.closest('button')) return;
  }
  if (event.key === ' ') { event.preventDefault(); togglePause(); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); void advance(1); }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); void advance(-1); }
  else if (event.key.toLowerCase() === 'f') { void fullscreen(); }
});
if (settings.folder && isTauri()) {
  choosing = true;
  choose.disabled = start.disabled = true;
  message.textContent = 'Opening your art folder…';
  invoke<Album>('load_folder', { folder: settings.folder })
    .then(acceptAlbum)
    .catch(error => { message.textContent = `Your previous folder is unavailable. Choose another folder. ${error}`; })
    .finally(() => { choosing = false; choose.disabled = start.disabled = false; reveal(); });
}
