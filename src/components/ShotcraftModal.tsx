import React, { useEffect, useState } from 'react';
import { Check, Copy, Film, Play, Sparkles, X } from 'lucide-react';

export type ShotcraftPresetKey =
  | 'BentoLightUp'
  | 'StaggerEntrance'
  | 'CardStackScroll'
  | 'TypewriterErrorRetype';

interface ShotcraftModalProps {
  open: boolean;
  onClose: () => void;
}

interface PresetSpec {
  id: ShotcraftPresetKey;
  name: string;
  durationMs: number;
  staggerMs: number;
  easing: string;
  desc: string;
}

const PRESETS: PresetSpec[] = [
  {
    id: 'BentoLightUp',
    name: 'BentoLightUp',
    durationMs: 650,
    staggerMs: 90,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    desc: 'Pendar border neon berurutan pada modul Bento Grid dengan scale-in lembut untuk hook reveal.'
  },
  {
    id: 'StaggerEntrance',
    name: 'StaggerEntrance',
    durationMs: 520,
    staggerMs: 110,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    desc: 'Transisi masuk berjenjang Y+24px dengan overshoot spring ringan mengikuti cadence Voicebox.'
  },
  {
    id: 'CardStackScroll',
    name: 'CardStackScroll',
    durationMs: 780,
    staggerMs: 140,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    desc: 'Kartu bertumpuk isometrik dengan pergeseran Z-depth dan skala latar untuk retention breakdown.'
  },
  {
    id: 'TypewriterErrorRetype',
    name: 'TypewriterErrorRetype',
    durationMs: 1400,
    staggerMs: 45,
    easing: 'steps(18, end)',
    desc: 'Pattern-interrupt ketikan cepat -> deteksi typo merah -> backspace -> koreksi punchline.'
  }
];

export const ShotcraftModal: React.FC<ShotcraftModalProps> = ({ open, onClose }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const [stageEntered, setStageEntered] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [copiedJson, setCopiedJson] = useState(false);

  const active = PRESETS[selectedIdx];

  useEffect(() => {
    if (!open) return;
    setStageEntered(false);
    const raf = window.requestAnimationFrame(() => {
      window.setTimeout(() => setStageEntered(true), 30);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, selectedIdx, pulseKey]);

  useEffect(() => {
    if (!open || active.id !== 'TypewriterErrorRetype') return;

    const full = 'const viralHook = "Kantor Rama AI: Render Blindspot OK";';
    const typo = 'const viralHook = "Kantor Rama AI: Render Blndsp0t...';
    let step = 0;
    const timer = window.setInterval(() => {
      step++;
      if (step <= 20) {
        setTypedText(typo.slice(0, Math.min(typo.length, 18 + step)));
      } else if (step <= 28) {
        setTypedText(typo.slice(0, Math.max(24, typo.length - (step - 20) * 2)));
      } else {
        setTypedText(full.slice(0, Math.min(full.length, 24 + (step - 28) * 2)));
      }
      if (step > 48) step = 0;
    }, 85);

    return () => window.clearInterval(timer);
  }, [open, active.id, pulseKey]);

  if (!open) return null;

  const copyPresetJson = () => {
    const payload = JSON.stringify(
      {
        agentId: 'raga',
        skill: 'video-shotcraft',
        remotionPolicy: 'Remotion (khusus Yang Mulia)',
        preset: active.id,
        curve: active.easing,
        durationMs: active.durationMs,
        staggerMs: active.staggerMs
      },
      null,
      2
    );
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(payload).catch(() => {});
    }
    setCopiedJson(true);
    window.setTimeout(() => setCopiedJson(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-fuchsia-400/35 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/20 text-fuchsia-300">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold tracking-wide text-slate-100">
                RAGA • VIDEO-SHOTCRAFT &amp; REMOTION STUDIO
              </h3>
              <p className="text-[10px] text-slate-400">
                Remotion (khusus Yang Mulia) — Motion Curves &amp; Timing Blueprint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedIdx(idx);
                  setPulseKey((k) => k + 1);
                }}
                className={`rounded-xl border px-2.5 py-2 text-left text-[11px] font-bold transition ${
                  selectedIdx === idx
                    ? 'border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="truncate">{p.name}</div>
                <div className="mt-0.5 font-mono text-[9px] text-slate-500">{p.durationMs}ms</div>
              </button>
            ))}
          </div>

          {/* Live Motion Stage */}
          <div
            key={`${active.id}-${pulseKey}`}
            className="relative flex h-44 flex-col items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-4"
          >
            {active.id === 'BentoLightUp' && (
              <div className="grid w-full max-w-sm grid-cols-3 gap-2">
                {['HOOK 0:03', 'RETENTION', 'CTR FOCUS', 'SHOTCRAFT', 'VOICEBOX', 'SHORTS 9:16'].map(
                  (label, i) => (
                    <div
                      key={label}
                      style={{
                        transitionProperty: 'transform, opacity, border-color, box-shadow',
                        transitionDuration: `${active.durationMs}ms`,
                        transitionTimingFunction: active.easing,
                        transitionDelay: `${i * active.staggerMs}ms`,
                        opacity: stageEntered ? 1 : 0.15,
                        transform: stageEntered ? 'scale(1)' : 'scale(0.86)'
                      }}
                      className="rounded-lg border border-sky-400/50 bg-sky-500/15 p-2 text-center text-[10px] font-bold text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.18)]"
                    >
                      {label}
                    </div>
                  )
                )}
              </div>
            )}

            {active.id === 'StaggerEntrance' && (
              <div className="flex w-full max-w-sm flex-col gap-2">
                {[
                  'Beat 1 — Pattern Interrupt (0:00)',
                  'Beat 2 — Proof Visual (0:15)',
                  'Beat 3 — Payoff CTA (0:45)'
                ].map((beat, i) => (
                  <div
                    key={beat}
                    style={{
                      transitionProperty: 'transform, opacity',
                      transitionDuration: `${active.durationMs}ms`,
                      transitionTimingFunction: active.easing,
                      transitionDelay: `${i * active.staggerMs}ms`,
                      opacity: stageEntered ? 1 : 0,
                      transform: stageEntered ? 'translateY(0px)' : 'translateY(24px)'
                    }}
                    className="rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold text-emerald-200"
                  >
                    {beat}
                  </div>
                ))}
              </div>
            )}

            {active.id === 'CardStackScroll' && (
              <div className="relative flex h-28 w-64 items-center justify-center">
                {[0, 1, 2].map((layer) => (
                  <div
                    key={layer}
                    style={{
                      transitionProperty: 'transform, opacity',
                      transitionDuration: `${active.durationMs}ms`,
                      transitionTimingFunction: active.easing,
                      transitionDelay: `${layer * active.staggerMs}ms`,
                      opacity: stageEntered ? 1 : 0.2,
                      transform: stageEntered
                        ? `translateY(${(layer - 1) * 14}px) scale(${1 - layer * 0.06})`
                        : `translateY(${(layer - 1) * 28}px) scale(0.85)`,
                      zIndex: 3 - layer
                    }}
                    className="absolute inset-x-0 rounded-xl border border-violet-400/50 bg-slate-900/95 p-3 shadow-xl"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-violet-300">
                      <span>SCENE LAYER #{layer + 1}</span>
                      <span>z={30 - layer * 10}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-3/4 rounded-full bg-violet-400/40" />
                  </div>
                ))}
              </div>
            )}

            {active.id === 'TypewriterErrorRetype' && (
              <div
                className={`w-full max-w-md rounded-xl border bg-slate-900 p-3 font-mono text-xs shadow ${
                  typedText.includes('Blndsp0t')
                    ? 'border-rose-400/50 text-rose-300'
                    : 'border-amber-400/35 text-emerald-300'
                }`}
              >
                <div className="mb-1 text-[9px] uppercase tracking-wider text-amber-400">
                  LIVE CODE RETYPE CUE ({active.easing})
                </div>
                {typedText}
                <span className="animate-pulse text-sky-400">|</span>
              </div>
            )}

            <button
              onClick={() => setPulseKey((k) => k + 1)}
              className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/90 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white"
            >
              <Play className="h-3 w-3" />
              Replay
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px]">
            <div className="space-y-0.5 text-slate-300">
              <div>{active.desc}</div>
              <div className="font-mono text-[10px] text-sky-300">
                curve={active.easing} • duration={active.durationMs}ms • stagger={active.staggerMs}ms
              </div>
            </div>
            <button
              onClick={copyPresetJson}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-fuchsia-400/35 bg-fuchsia-500/15 px-2.5 py-1.5 text-[10px] font-bold text-fuchsia-200 hover:bg-fuchsia-500/25"
            >
              {copiedJson ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiedJson ? 'Tersalin' : 'Copy JSON'}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-fuchsia-400" />
              Remotion (khusus Yang Mulia — 13 skills remotion-* use-only)
            </span>
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-3 py-1 font-bold text-slate-200 hover:bg-slate-700"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
