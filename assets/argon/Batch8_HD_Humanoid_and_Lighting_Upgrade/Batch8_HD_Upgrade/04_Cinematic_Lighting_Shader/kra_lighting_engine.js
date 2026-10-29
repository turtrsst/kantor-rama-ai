/**
 * KRA Virtual Office — Plug-and-Play Cinematic Lighting Overlay
 * Panggil fungsi ini di akhir loop render Canvas web/index.html Anda
 */
export function applyKRACinematicLighting(ctx, width, height, lightSources = []) {
  // 1. Ambient Room Shadow
  ctx.fillStyle = 'rgba(8, 12, 26, 0.38)';
  ctx.fillRect(0, 0, width, height);

  // 2. Additive Volumetric Light Cones
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  lightSources.forEach(src => {
    const grad = ctx.createRadialGradient(src.x, src.y, 2, src.x, src.y, src.radius || 72);
    grad.addColorStop(0, src.innerColor || 'rgba(255, 210, 110, 0.65)');
    grad.addColorStop(0.45, src.midColor || 'rgba(255, 160, 50, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(src.x - src.radius, src.y - src.radius, src.radius * 2, src.radius * 2);
  });
  ctx.restore();
}