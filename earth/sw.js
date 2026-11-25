/* 나의 가상 지구본 — 서비스 워커
 * 앱을 고친 뒤 반영이 안 되면 아래 CACHE_VERSION 숫자를 올려 주세요. */
const CACHE_VERSION = 'v1';
const APP_CACHE = 'globe-app-' + CACHE_VERSION;
const FONT_CACHE = 'globe-font-' + CACHE_VERSION;
const APP_FILES = [
  './', './index.html', './world-data.js', './manifest.webmanifest',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];
const FONT_CSS = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    await cache.addAll(APP_FILES);
    try { const fc = await caches.open(FONT_CACHE); await fc.add(new Request(FONT_CSS, { mode: 'cors' })); } catch (e) { /* 폰트는 없어도 동작 */ }
    self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('globe-') && k !== APP_CACHE && k !== FONT_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 폰트 (CSS와 글꼴 파일): 캐시 우선, 없으면 받아서 저장
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith((async () => {
      const cache = await caches.open(FONT_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }
      catch (e) { return new Response('', { status: 504 }); }
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  // 앱 파일: 캐시 우선 + 뒤에서 새로 받아 두기
  event.respondWith((async () => {
    const cache = await caches.open(APP_CACHE);
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { event.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') { const idx = await cache.match('./index.html'); if (idx) return idx; }
    return new Response('오프라인이라 불러올 수 없어요.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
