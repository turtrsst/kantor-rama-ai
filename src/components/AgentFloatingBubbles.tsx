import React from 'react';
import { AgentRuntimeSnapshot } from '../types/office';

interface AgentFloatingBubblesProps {
  agents: AgentRuntimeSnapshot[];
  showAllDetails?: boolean;
}

export const AgentFloatingBubbles: React.FC<AgentFloatingBubblesProps> = ({ agents }) => {
  return (
    <div className="pointer-events-none fixed inset-0 z-[15] overflow-hidden">
      {agents
        .filter((a) => a.visibleOnScreen)
        .map((a) => {
          const isBusy =
            a.action === 'typing' || a.action === 'thinking' || a.action === 'celebrating';
          const clampedX = Math.max(92, a.screenX);
          const clampedY = Math.max(88, a.screenY);

          return (
            <div
              key={a.id}
              style={{
                transform: `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0) translate(-50%, -100%)`
              }}
              className="absolute left-0 top-0 flex flex-col items-center gap-0.5 transition-[transform] duration-[40ms] ease-linear will-change-transform"
            >
              {/* Status / Task Pill */}
              {(isBusy || a.action === 'coffee' || a.isElevatorRiding) && (
                <div
                  className={`flex max-w-[156px] items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold shadow-lg backdrop-blur-sm ${
                    a.action === 'celebrating'
                      ? 'border-emerald-400/70 bg-emerald-950/90 text-emerald-200'
                      : a.action === 'thinking'
                        ? 'border-violet-400/60 bg-slate-900/90 text-violet-200'
                        : a.action === 'coffee'
                          ? 'border-amber-400/60 bg-slate-900/90 text-amber-200'
                          : 'border-sky-400/50 bg-slate-900/85 text-sky-100'
                  }`}
                >
                  <span className="truncate">{a.task}</span>
                </div>
              )}

              {/* Compact RimWorld-style Nameplate + Progress */}
              <div className="flex flex-col items-center rounded-md border border-slate-700/80 bg-slate-950/85 px-1.5 py-0.5 shadow">
                <div className="flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: a.colorHex }}
                  />
                  <span className="whitespace-nowrap text-[10px] font-bold tracking-tight text-slate-100">
                    {a.name}
                  </span>
                </div>
                {isBusy && (
                  <div className="mt-0.5 h-[2px] w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${a.progressPct}%`,
                        backgroundColor: a.colorHex
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
};
