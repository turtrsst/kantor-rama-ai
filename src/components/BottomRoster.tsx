import React from 'react';
import { ArrowUpDown, BrainCircuit, Coffee, Info, Keyboard, Sparkles } from 'lucide-react';
import { AgentActionState, AgentRuntimeSnapshot } from '../types/office';

interface BottomRosterProps {
  agents: AgentRuntimeSnapshot[];
  followAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onInspectAgent: (agentId: string) => void;
}

function ActionBadge({ action }: { action: AgentActionState }) {
  switch (action) {
    case 'typing':
      return <Keyboard className="h-3 w-3 text-sky-400" />;
    case 'thinking':
      return <BrainCircuit className="h-3 w-3 text-violet-400" />;
    case 'coffee':
      return <Coffee className="h-3 w-3 text-amber-400" />;
    case 'celebrating':
      return <Sparkles className="h-3 w-3 text-emerald-400" />;
    case 'elevator_wait':
    case 'elevator_ride':
      return <ArrowUpDown className="h-3 w-3 text-cyan-400" />;
    default:
      return null;
  }
}

export const BottomRoster: React.FC<BottomRosterProps> = ({
  agents,
  followAgentId,
  onSelectAgent,
  onInspectAgent
}) => {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-2.5 z-20 flex justify-center px-3">
      <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-slate-700/75 bg-slate-900/92 px-3 py-1.5 shadow-2xl backdrop-blur-md">
        {agents.map((a) => {
          const isSelected = followAgentId === a.id;
          const isFinance = a.department === 'FINANCE';
          return (
            <div
              key={a.id}
              className={`flex shrink-0 items-center rounded-full border transition ${
                isSelected
                  ? 'border-sky-400 bg-sky-400/20 text-white'
                  : isFinance
                    ? 'border-purple-500/40 bg-purple-950/35 text-slate-200 hover:border-purple-400'
                    : 'border-slate-700/80 bg-slate-950/65 text-slate-300 hover:border-slate-500 hover:text-white'
              }`}
            >
              <button
                onClick={() => onSelectAgent(isSelected ? '' : a.id)}
                title={`Fokus ke ${a.name} (${a.title}) — ${a.task}`}
                className="flex items-center gap-1.5 py-1 pl-2.5 pr-1.5 text-[11px] font-semibold"
              >
                <span className="text-xs leading-none">{a.emoji}</span>
                <span className="max-w-[92px] truncate">{a.name}</span>
                <ActionBadge action={a.action} />
                <span
                  className={`rounded px-1 font-mono text-[9px] ${
                    isFinance ? 'bg-purple-500/25 text-purple-200' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  L{a.floor}
                </span>
              </button>
              <button
                onClick={() => onInspectAgent(a.id)}
                title={`Buka Konsol ${a.name}`}
                className="rounded-r-full border-l border-slate-700/70 px-1.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-sky-300"
              >
                <Info className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </footer>
  );
};
