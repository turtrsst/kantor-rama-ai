/* Shared single-flight image/asset cache. CacheStorage survives reloads; the in-memory
 * promise map prevents duplicate requests during a page session. Bump CACHE_VERSION
 * when shipped asset bytes change. */
(function (root) {
  'use strict';

  const CACHE_VERSION = '20261029-1';
  const CACHE_NAME = 'kra-static-assets-' + CACHE_VERSION;
  const imagePromises = new Map();
  let cachePromise = null;

  function assetUrl(input) {
    const url = new URL(input, document.baseURI);
    if (url.origin !== location.origin) {
      throw new Error('KRA asset loader only accepts same-origin assets.');
    }
    if (url.pathname.includes('/assets/') && !url.searchParams.has('v')) {
      url.searchParams.set('v', CACHE_VERSION);
    }
    return url.href;
  }

  function getCache() {
    if (!('caches' in window)) return Promise.resolve(null);
    if (!cachePromise) {
      cachePromise = caches.open(CACHE_NAME).catch(() => null);
    }
    return cachePromise;
  }

  async function fetchAsset(input) {
    const url = assetUrl(input);
    const cache = await getCache();
    if (cache) {
      try {
        const saved = await cache.match(url);
        if (saved) return saved;
      } catch (_) { /* fall back to network */ }
    }

    const response = await fetch(url, { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Asset request failed (' + response.status + '): ' + url);
    if (cache && response.type !== 'opaque') {
      try { await cache.put(url, response.clone()); } catch (_) { /* quota/private mode */ }
    }
    return response;
  }

  function loadImage(input) {
    let url;
    try { url = assetUrl(input); } catch (error) { return Promise.reject(error); }
    if (imagePromises.has(url)) return imagePromises.get(url);

    const promise = fetchAsset(url).then(response => response.blob()).then(blob => new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not decode image asset: ' + url));
      };
      image.src = objectUrl;
    })).catch(error => {
      imagePromises.delete(url);
      throw error;
    });

    imagePromises.set(url, promise);
    return promise;
  }

  root.KRAAssetCache = Object.freeze({
    version: CACHE_VERSION,
    fetch: fetchAsset,
    loadImage,
    get imageCount() { return imagePromises.size; }
  });
})(window);
