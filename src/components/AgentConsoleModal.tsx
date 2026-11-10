import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  GitBranch,
  Send,
  Shield,
  X
} from 'lucide-react';
import { AGENTS_CATALOG } from '../data/agentsCatalog';
import { ROOM_DEFINITIONS } from '../data/floorNavGraph';
import { MuseEventPayload } from '../types/office';

interface AgentConsoleModalProps {
  agentId: string | null;
  onClose: () => void;
  onDispatchEvent: (payload: MuseEventPayload, autoRelay?: boolean) => boolean;
  onOpenFinance?: () => void;
  onOpenGroupChat?: () => void;
}

export const AgentConsoleModal: React.FC<AgentConsoleModalProps> = ({
  agentId,
  onClose,
  onDispatchEvent,
  onOpenFinance,
  onOpenGroupChat
}) => {
  const agent = AGENTS_CATALOG.find((a) => a.id === agentId);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<string | null>(null);
  const [skillPath, setSkillPath] = useState<string | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [customOrder, setCustomOrder] = useState('');
  const [targetRoom, setTargetRoom] = useState('');
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      setTargetRoom(agent.homeRoom);
      setSelectedSkill(null);
      setSkillContent(null);
      setReportNotice(null);
    }
  }, [agentId, agent]);

  if (!agent) return null;

  const handleLoadSkill = async (skillName: string) => {
    setSelectedSkill(skillName);
    setSkillLoading(true);
    setSkillContent(null);
    setSkillPath(null);
    try {
      const resp = await fetch(`/api/kra/skill?name=${encodeURIComponent(skillName)}`);
      const data = await resp.json();
      if (resp.ok) {
        setSkillContent(data.content);
        setSkillPath(data.sourcePath);
      } else {
        setSkillContent(`Katalog-only tool / skill eksternal (${skillName}). ${data.error || ''}`);
      }
    } catch {
      setSkillContent('Gagal memuat file SKILL.md dari server.');
    } finally {
      setSkillLoading(false);
    }
  };

  const handleSendOrder = (e: React.FormEvent) => {
    e.preventDefault();
    onDispatchEvent(
      {
        agentId: agent.id,
        action: 'typing',
        targetRoom: targetRoom || agent.homeRoom,
        statusText: customOrder.trim() || `Eksekusi tugas oleh ${agent.name}`
      },
      false
    );
    setReportNotice(`${agent.name} bergerak menjalankan arahan di ${ROOM_DEFINITIONS[targetRoom]?.label || targetRoom}.`);
    setCustomOrder('');
  };

  const handleReportToRama = () => {
    onDispatchEvent(
      {
        agentId: agent.id,
        action: 'thinking',
        targetRoom: 'Floor1_BossRoom',
        statusText: `Laporan dari ${agent.name} ke RAMA`
      },
      false
    );
    setReportNotice(`${agent.name} menuju Boss Office RAMA untuk menyampaikan laporan resmi.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-sky-400/35 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-xl shadow-inner"
              style={{
                backgroundColor: `#${agent.color.toString(16).padStart(6, '0')}26`,
                border: `1px solid #${agent.color.toString(16).padStart(6, '0')}66`
              }}
            >
              {agent.emoji}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold text-white">{agent.name}</h2>
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                  {agent.department === 'FINANCE' ? 'FINANCE STANDALONE' : `KRA TEAM #${agent.agentNumber ?? agent.code}`}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    agent.inGroupChat
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-purple-500/20 text-purple-300'
                  }`}
                >
                  {agent.inGroupChat ? 'Di Group Chat Kantor KRA' : 'Di Luar Group Chat (Finance)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">{agent.title} — {agent.role}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
          {/* Hierarchy & Persona */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                <GitBranch className="h-3.5 w-3.5" />
                Hierarki &amp; Gaya Persona
              </div>
              <p className="text-slate-200">{agent.personaStyle}</p>
              <p className="italic text-cyan-300/90">&ldquo;{agent.vibe}&rdquo;</p>
              <div className="pt-1 text-[11px] text-slate-400">
                Melapor ke: <span className="font-bold text-slate-200">{agent.reportsTo}</span>
                {agent.manages && agent.manages.length > 0 && (
                  <> • Mengelola: <span className="font-bold text-slate-200">{agent.manages.join(', ').toUpperCase()}</span></>
                )}
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {agent.traits.map((t) => (
                  <span key={t} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300">
                <Shield className="h-3.5 w-3.5" />
                Aturan &amp; Gerbang Kerja
              </div>
              {agent.id === 'raga' && (
                <div className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/15 px-2.5 py-1.5 text-[11px] font-semibold text-fuchsia-200">
                  Remotion (khusus Yang Mulia) — Render Remotion dibatasi khusus pemakaian Yang Mulia. Voicebox lokal di port 17493.
                </div>
              )}
              {agent.approvalGate && (
                <div className="rounded-lg border border-pink-400/35 bg-pink-500/10 px-2.5 py-1.5 text-[11px] text-pink-200">
                  {agent.approvalGate}
                </div>
              )}
              {agent.houseRules && agent.houseRules.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-[11px] text-slate-300">
                  {agent.houseRules.map((hr) => (
                    <li key={hr}>{hr}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">
                  {agent.notes || 'Mengikuti hierarki Yang Mulia -> RAMA -> MARTA -> Staf, tanpa mengarang data/analitik palsu.'}
                </p>
              )}
            </div>
          </div>

          {/* Skills Loader (reads real SKILL.md from skills/ & skills-extra-meimei/) */}
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                <BookOpen className="h-3.5 w-3.5" />
                Skills Terpasang ({agent.skills.length}) — klik untuk baca SKILL.md asli
              </div>
              {skillPath && <span className="font-mono text-[10px] text-slate-400">{skillPath}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {agent.skills.map((sk) => (
                <button
                  key={sk}
                  onClick={() => handleLoadSkill(sk)}
                  className={`rounded-lg border px-2 py-1 font-mono text-[10px] font-semibold transition ${
                    selectedSkill === sk
                      ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-emerald-400/50 hover:text-white'
                  }`}
                >
                  {sk}
                </button>
              ))}
            </div>
            {(skillLoading || skillContent) && (
              <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                {skillLoading ? 'Memuat SKILL.md...' : skillContent}
              </pre>
            )}
          </div>

          {/* Direct Command & Laporan ke RAMA */}
          <form
            onSubmit={handleSendOrder}
            className="space-y-2 rounded-xl border border-sky-400/25 bg-slate-950/60 p-3"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
              Konsol Aksi {agent.name} di Kantor 2.5D
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <select
                value={targetRoom}
                onChange={(e) => setTargetRoom(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-100"
              >
                {Object.values(ROOM_DEFINITIONS).map((r) => (
                  <option key={r.id} value={r.id}>
                    L{r.floor} — {r.label}
                  </option>
                ))}
              </select>
              <input
                value={customOrder}
                onChange={(e) => setCustomOrder(e.target.value)}
                placeholder={`Perintah langsung untuk ${agent.name}...`}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] text-slate-100 md:col-span-2"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-sky-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-sky-300"
              >
                <Send className="h-3.5 w-3.5" />
                Jalankan di Kantor 2.5D
              </button>

              {agent.id !== 'rama' && (
                <button
                  type="button"
                  onClick={handleReportToRama}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Laporan ke RAMA
                </button>
              )}

              {agent.department === 'FINANCE' && onOpenFinance && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFinance();
                  }}
                  className="rounded-lg border border-purple-400/40 bg-purple-500/20 px-3 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-500/30"
                >
                  Buka Konsol Finance — SANDI &amp; Exness
                </button>
              )}

              {agent.inGroupChat && onOpenGroupChat && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGroupChat();
                  }}
                  className="rounded-lg border border-emerald-400/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25"
                >
                  Mention di Group Chat Kantor KRA
                </button>
              )}
            </div>

            {reportNotice && (
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {reportNotice}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
