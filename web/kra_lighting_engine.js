(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  root.KRALightingEngine = engine;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function reducedMotion(mediaQuery) {
    if (mediaQuery && typeof mediaQuery.matches === 'boolean') return mediaQuery.matches;
    return typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function normalizeEmission(emission) {
    if (!emission || !emission.color) return null;
    return {
      color: emission.color,
      radius: Math.max(0, Number(emission.radius) || 0),
      alpha: Math.min(1, Math.max(0, Number(emission.alpha) || 0))
    };
  }

  function create(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  function drawGlow(ctx, x, y, emission) {
    const light = normalizeEmission(emission);
    if (!light) return;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, light.radius);
    gradient.addColorStop(0, colorWithAlpha(light.color, light.alpha));
    gradient.addColorStop(0.46, colorWithAlpha(light.color, light.alpha * 0.26));
    gradient.addColorStop(1, colorWithAlpha(light.color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(x - light.radius, y - light.radius, light.radius * 2, light.radius * 2);
  }

  function colorWithAlpha(hex, alpha) {
    const normalized = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return 'rgba(255,255,255,' + alpha + ')';
    const value = Number.parseInt(normalized, 16);
    return 'rgba(' + ((value >> 16) & 255) + ',' + ((value >> 8) & 255) + ',' + (value & 255) + ',' + alpha + ')';
  }

  function render(ctx, cache, lights, motionReduced) {
    if (!cache || !cache.canvas || !cache.ctx) return;
    const width = cache.canvas.width;
    const height = cache.canvas.height;
    cache.ctx.clearRect(0, 0, width, height);
    cache.ctx.globalCompositeOperation = 'lighter';
    lights.forEach(light => drawGlow(cache.ctx, light.x, light.y, {
      color: light.color,
      radius: light.radius,
      alpha: motionReduced ? light.alpha : light.alpha * (0.92 + Math.sin((light.phase || 0) + performance.now() / 900) * 0.08)
    }));
    cache.ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(cache.canvas, 0, 0);
    ctx.restore();
  }

  return { create, drawGlow, normalizeEmission, reducedMotion, render };
});
