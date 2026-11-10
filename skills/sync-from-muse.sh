#!/bin/bash
# Sync ulang paket skills KRA dari Muse.
# Jalankan dari dalam folder paket ini (workspace/kra/skills/).
# Menyalin ulang 54 skill dari ~/workspace/custom-skills/ lalu memverifikasi
# salinannya identik dengan sumber. Tidak mengubah file sumber.
# HANYA skill di daftar SKILLS yang disalin — skill finance SANDI
# (technical-analyst, crypto-regime-analyzer, dst.) sengaja TIDAK masuk
# paket KRA karena SANDI masih standalone, bukan tim KRA.
set -euo pipefail
SRC="$HOME/workspace/custom-skills"
SKILLS="anatomy antislop api-and-interface-design caveman code-review-and-quality debugging figma gsap-core gsap-frameworks gsap-performance gsap-plugins gsap-react gsap-scrolltrigger gsap-timeline gsap-utils hyperframes hyperframes-cli hyperframes-registry media-use motionmaxxing remotion-best-practices remotion-captions remotion-create remotion-docs remotion-interactivity remotion-license remotion-maps remotion-markup remotion-multimedia remotion-render remotion-saas remotion-studio remotion-to-hyperframes remotion-upgrade reverse-any-video shorts-hook slideshow storytelling-skills style-sampling superpowers video-shotcraft viral-script-architect voicebox yt-audit yt-chapters yt-comment yt-edit yt-package yt-plan yt-retention yt-script yt-seo yt-shorts yt-viral"
for s in $SKILLS; do
  rm -rf "./$s"
  cp -r "$SRC/$s" "./$s"
done
for s in $SKILLS; do
  diff -r "$SRC/$s" "./$s" >/dev/null || { echo "PERINGATAN: $s berbeda dengan sumber"; exit 1; }
done
echo "OK: salinan identik dengan $SRC"
echo "File skill: $(find . -type f -name 'SKILL.md' -o -name 'skill.yaml' -o -path './yt-*/scripts/*' -o -name '*.py' | wc -l) file (termasuk manifest/README/script ini di luar hitungan)"
echo "Selesai. Jangan lupa regenerate ../agents/kra-agents.json lewat Muse bila daftar skill agen berubah."
