import React, { useEffect, useState } from 'react';
import { Film, Play, Sparkles, X } from 'lucide-react';

interface ShotcraftModalProps {
  open: boolean;
  onClose: () => void;
}

const PRESETS = [
  {
    id: 'BentoLightUp',
    name: 'BentoLightUp',
    durationMs: 650,
    staggerMs: 90,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    desc: 'Sequential Bento grid spotlighting with rim-glow entrance for hook reveal.'
  },
  {
    id: 'StaggerEntrance',
    name: 'StaggerEntrance',
    durationMs: 520,
    staggerMs: 75,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    desc: 'Rapid 3-beat staggered card pop-in synced to Voicebox cadence.'
  },
  {
    id: 'CardStackScroll',
    name: 'CardStackScroll',
    durationMs: 820,
    staggerMs: 110,
    easing: 'cubic-bezier(0.33, 1, 0.68, 1)',
    desc: 'Isometric depth-layered card cascade for retention breakdown.'
  },
  {
    id: 'TypewriterErrorRetype',
    name: 'TypewriterErrorRetype',
    durationMs: 980,
    staggerMs: 45,
    easing: 'steps(18, end)',
    desc: 'Pattern-interrupt code typo -> backspace -> crisp retype punchline.'
  }
];

export const ShotcraftModal: React.FC<ShotcraftModalProps> = ({ open, onClose }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const [typedText, setTypedText] = useState('');

  const active = PRESETS[selectedIdx];

  useEffect(() => {
    if (!open) return;
    if (active.id !== 'TypewriterErrorRetype') return;

    const full = 'const viralHook = "Stop building boring bots!";';
    const typo = 'const viralHook = "Stop buidling...';
    let step = 0;
    const timer = window.setInterval(() => {
      step++;
      if (step <= 18) {
        setTypedText(typo.slice(0, step + 12));
      } else if (step <= 24) {
        setTypedText(typo.slice(0, Math.max(18, 30 - (step - 18))));
      } else {
        setTypedText(full.slice(0, Math.min(full.length, 18 + (step - 24) * 2)));
      }
      if (step > 42) step = 0;
    }, 85);

    return () => window.clearInterval(timer);
  }, [open, active.id, pulseKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-fuchsia-400/35 bg-slate-900 shadow-2xl">
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
                {['HOOK 0:03', 'RETENTION 78%', 'CTR +12.4%', 'SHOTCRAFT', 'VOICEBOX', 'SHORTS 9:16'].map(
                  (label, i) => (
                    <div
                      key={label}
                      style={{
                        animation: `pulse 1.4s ease-in-out ${i * 0.14}s infinite alternate`
                      }}
                      className="rounded-lg border border-sky-400/40 bg-sky-500/10 p-2 text-center text-[10px] font-bold text-sky-200 shadow"
                    >
                      {label}
                    </div>
                  )
                )}
              </div>
            )}

            {active.id === 'StaggerEntrance' && (
              <div className="flex w-full max-w-sm flex-col gap-2">
                {['Beat 1 — Pattern Interrupt (0:00)', 'Beat 2 — Proof Visual (0:15)', 'Beat 3 — Payoff CTA (0:45)'].map(
                  (beat, i) => (
                    <div
                      key={beat}
                      style={{
                        animation: `bounce 1.2s ease ${i * 0.12}s infinite`
                      }}
                      className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold text-emerald-200"
                    >
                      {beat}
                    </div>
                  )
                )}
              </div>
            )}

            {active.id === 'CardStackScroll' && (
              <div className="relative flex h-28 w-64 items-center justify-center">
                {[0, 1, 2].map((layer) => (
                  <div
                    key={layer}
                    style={{
                      transform: `translateY(${(layer - 1) * 14}px) scale(${1 - layer * 0.06})`,
                      zIndex: 3 - layer
                    }}
                    className="absolute inset-x-0 rounded-xl border border-violet-400/50 bg-slate-900/95 p-3 shadow-xl transition"
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
              <div className="w-full max-w-md rounded-xl border border-amber-400/35 bg-slate-900 p-3 font-mono text-xs text-emerald-300 shadow">
                <div className="mb-1 text-[9px] uppercase tracking-wider text-amber-400">
                  LIVE CODE RETYPE CUE
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

          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px]">
            <div className="text-slate-300">{active.desc}</div>
            <div className="ml-3 shrink-0 font-mono text-[10px] text-fuchsia-300">
              stagger={active.staggerMs}ms
            </div>
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
