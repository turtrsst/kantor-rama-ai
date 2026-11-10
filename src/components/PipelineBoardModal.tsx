import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Kanban,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
  X
} from 'lucide-react';
import {
  MuseEventPayload,
  PipelineProjectItem,
  PipelineStageId
} from '../types/office';

interface PipelineBoardModalProps {
  open: boolean;
  onClose: () => void;
  items: PipelineProjectItem[];
  setItems: React.Dispatch<React.SetStateAction<PipelineProjectItem[]>>;
  onDispatchEvent: (payload: MuseEventPayload, autoRelay?: boolean) => boolean;
}

const STAGES: Array<{ id: PipelineStageId; label: string; owner: string; badge: string }> = [
  { id: 'ide', label: '1. Ide & Brief', owner: 'RAMA / ARUNA', badge: 'bg-sky-500/20 text-sky-300' },
  { id: 'naskah', label: '2. Naskah', owner: 'PUTRI', badge: 'bg-pink-500/20 text-pink-300' },
  {
    id: 'approval_yang_mulia',
    label: '3. Approval Gate',
    owner: 'Yang Mulia',
    badge: 'bg-amber-500/20 text-amber-300'
  },
  {
    id: 'edit_raga',
    label: '4. Edit & Voicebox',
    owner: 'RAGA',
    badge: 'bg-emerald-500/20 text-emerald-300'
  },
  { id: 'qa_meimei', label: '5. QA Gate', owner: 'MEIMEI', badge: 'bg-teal-500/20 text-teal-300' },
  {
    id: 'siap_terbit',
    label: '6. Siap Terbit',
    owner: 'ARUNA',
    badge: 'bg-orange-500/20 text-orange-300'
  },
  {
    id: 'komunitas_fizi',
    label: '7. Komunitas',
    owner: 'FIZI',
    badge: 'bg-lime-500/20 text-lime-300'
  }
];

export const PipelineBoardModal: React.FC<PipelineBoardModalProps> = ({
  open,
  onClose,
  items,
  setItems,
  onDispatchEvent
}) => {
  const [newTopic, setNewTopic] = useState('');
  const [useVoicebox, setUseVoicebox] = useState(true);
  const [gateAlert, setGateAlert] = useState<string | null>(null);

  if (!open) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTopic.trim();
    if (!clean) return;

    const item: PipelineProjectItem = {
      id: `pipe_${Date.now()}`,
      topic: clean,
      stage: 'ide',
      scriptApprovedByYangMulia: false,
      meimeiVerdict: 'PENDING',
      qaNotes: '',
      useVoicebox,
      remotionRestrictedNote: true,
      createdAt: new Date().toLocaleTimeString('id-ID', { hour12: false })
    };
    setItems((prev) => [item, ...prev]);
    setNewTopic('');
    setGateAlert(null);

    onDispatchEvent(
      {
        agentId: 'aruna',
        action: 'thinking',
        targetRoom: 'Floor1_Boardroom',
        statusText: `Brief Ide baru: "${clean}"`
      },
      false
    );
  };

  const advanceStage = (item: PipelineProjectItem) => {
    setGateAlert(null);
    const idx = STAGES.findIndex((s) => s.id === item.stage);
    if (idx === -1 || idx >= STAGES.length - 1) return;

    // HARD RULE 1: PUTRI approval gate — cannot reach RAGA unless Yang Mulia approved
    if (item.stage === 'approval_yang_mulia' && !item.scriptApprovedByYangMulia) {
      setGateAlert(
        `TERKUNCI (Approval Gate PUTRI): Naskah "${item.topic}" WAJIB disetujui Yang Mulia terlebih dahulu sebelum masuk ke RAGA.`
      );
      return;
    }

    // HARD RULE 2: MEIMEI QA gate — cannot reach ARUNA unless MEIMEI PASS
    if (item.stage === 'qa_meimei' && item.meimeiVerdict !== 'PASS') {
      setGateAlert(
        `TERKUNCI (QA Gate MEIMEI): Video "${item.topic}" wajib mendapat verdict PASS dari MEIMEI sebelum mencapai ARUNA.`
      );
      return;
    }

    const nextStage = STAGES[idx + 1].id;
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, stage: nextStage } : it)));

    // Move corresponding real bot in 2.5D isometric canvas
    const stageAgentMap: Record<PipelineStageId, { id: string; room: string; action: 'typing' | 'thinking' | 'success'; msg: string }> = {
      ide: { id: 'aruna', room: 'Floor1_Boardroom', action: 'thinking', msg: `Riset Ide: ${item.topic}` },
      naskah: { id: 'putri', room: 'Floor1_Desk2', action: 'typing', msg: `Naskah & 5 Hook: ${item.topic}` },
      approval_yang_mulia: { id: 'rama', room: 'Floor1_BossRoom', action: 'thinking', msg: `Menunggu Approval Yang Mulia: ${item.topic}` },
      edit_raga: { id: 'raga', room: 'Floor2_DesignDesk', action: 'typing', msg: `Edit & Voicebox: ${item.topic}` },
      qa_meimei: { id: 'meimei', room: 'Floor2_MultiMonitor', action: 'thinking', msg: `QA Check MEIMEI: ${item.topic}` },
      siap_terbit: { id: 'aruna', room: 'Floor1_TripleDesk', action: 'typing', msg: `Siap Terbit (tunggu YT creds): ${item.topic}` },
      komunitas_fizi: { id: 'fizi', room: 'Floor1_Lounge', action: 'success', msg: `FIZI Komunitas: ${item.topic}` }
    };
    const m = stageAgentMap[nextStage];
    onDispatchEvent({ agentId: m.id, action: m.action, targetRoom: m.room, statusText: m.msg }, false);
  };

  const approveByYangMulia = (id: string, approve: boolean) => {
    setGateAlert(null);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              scriptApprovedByYangMulia: approve,
              stage: approve ? 'edit_raga' : 'naskah'
            }
          : it
      )
    );
    if (approve) {
      onDispatchEvent(
        {
          agentId: 'raga',
          action: 'typing',
          targetRoom: 'Floor2_DesignDesk',
          statusText: 'Naskah Approved Yang Mulia -> RAGA mulai editing!'
        },
        false
      );
    } else {
      onDispatchEvent(
        {
          agentId: 'putri',
          action: 'typing',
          targetRoom: 'Floor1_Desk2',
          statusText: 'Revisi naskah diminta oleh Yang Mulia'
        },
        false
      );
    }
  };

  const setMeimeiVerdict = (id: string, verdict: 'PASS' | 'REVISE') => {
    setGateAlert(null);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              meimeiVerdict: verdict,
              stage: verdict === 'REVISE' ? 'edit_raga' : it.stage
            }
          : it
      )
    );
    if (verdict === 'REVISE') {
      onDispatchEvent(
        {
          agentId: 'raga',
          action: 'typing',
          targetRoom: 'Floor2_DesignDesk',
          statusText: 'MEIMEI QA: REVISE — kembali ke RAGA untuk perbaikan'
        },
        false
      );
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-emerald-400/35 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300">
              <Kanban className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">
                PIPELINE CONTENT CREATOR (7 TAHAP + APPROVAL &amp; QA GATE)
              </h2>
              <p className="text-[10px] text-slate-400">
                Board mulai kosong (zero fake data). Remotion (khusus Yang Mulia). YouTube Upload menunggu kredensial → tahap akhir Siap Terbit.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Project Composer */}
        <form
          onSubmit={handleCreate}
          className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-slate-950/70 px-5 py-3 text-xs"
        >
          <input
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Tambah ide / topik konten baru untuk diproses PUTRI -> RAGA -> MEIMEI -> ARUNA..."
            className="min-w-[260px] flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-400 focus:outline-none"
          />
          <label className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={useVoicebox}
              onChange={(e) => setUseVoicebox(e.target.checked)}
              className="accent-emerald-400"
            />
            Narasi Voicebox (17493)
          </label>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-300"
          >
            <Plus className="h-3.5 w-3.5" />
            Buat Tugas Kosong
          </button>
        </form>

        {gateAlert && (
          <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/15 px-5 py-2 text-xs font-semibold text-amber-200">
            <Lock className="h-4 w-4 shrink-0" />
            {gateAlert}
          </div>
        )}

        {/* Kanban Grid */}
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 md:grid-cols-3 xl:grid-cols-7">
          {STAGES.map((stage) => {
            const stageItems = items.filter((it) => it.stage === stage.id);
            return (
              <div
                key={stage.id}
                className="flex min-h-[260px] flex-col rounded-xl border border-slate-800 bg-slate-950/65 p-2.5"
              >
                <div className="mb-2 border-b border-slate-800 pb-2">
                  <div className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold ${stage.badge}`}>
                    {stage.label}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{stage.owner}</span>
                    <span className="font-mono">{stageItems.length}</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2">
                  {stageItems.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-800 p-3 text-center text-[10px] text-slate-600">
                      Kosong
                    </div>
                  ) : (
                    stageItems.map((it) => (
                      <div
                        key={it.id}
                        className="space-y-2 rounded-lg border border-slate-700/80 bg-slate-900 p-2.5 text-[11px]"
                      >
                        <div className="font-bold text-slate-100">{it.topic}</div>
                        <div className="flex flex-wrap gap-1 text-[9px]">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
                            {it.createdAt}
                          </span>
                          {it.useVoicebox && (
                            <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-violet-300">
                              Voicebox
                            </span>
                          )}
                          {it.stage === 'edit_raga' && (
                            <span className="rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-fuchsia-300">
                              Remotion (khusus Yang Mulia)
                            </span>
                          )}
                        </div>

                        {/* Approval Gate Controls */}
                        {it.stage === 'approval_yang_mulia' && (
                          <div className="space-y-1 rounded border border-amber-500/35 bg-amber-500/10 p-1.5">
                            <div className="text-[10px] font-bold text-amber-200">
                              PUTRI Gate: Ship it, or change it?
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => approveByYangMulia(it.id, true)}
                                className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-400 py-1 text-[10px] font-extrabold text-slate-950"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Approve
                              </button>
                              <button
                                onClick={() => approveByYangMulia(it.id, false)}
                                className="flex flex-1 items-center justify-center gap-1 rounded bg-rose-500/25 py-1 text-[10px] font-bold text-rose-200"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Revisi
                              </button>
                            </div>
                          </div>
                        )}

                        {/* QA Gate Controls */}
                        {it.stage === 'qa_meimei' && (
                          <div className="space-y-1 rounded border border-teal-500/35 bg-teal-500/10 p-1.5">
                            <div className="text-[10px] font-bold text-teal-200">
                              MEIMEI QA: {it.meimeiVerdict}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => setMeimeiVerdict(it.id, 'PASS')}
                                className="flex-1 rounded bg-teal-400 py-1 text-[10px] font-extrabold text-slate-950"
                              >
                                PASS
                              </button>
                              <button
                                onClick={() => setMeimeiVerdict(it.id, 'REVISE')}
                                className="flex-1 rounded bg-rose-500/25 py-1 text-[10px] font-bold text-rose-200"
                              >
                                REVISE
                              </button>
                            </div>
                          </div>
                        )}

                        {it.stage === 'siap_terbit' && (
                          <div className="rounded bg-orange-500/15 px-2 py-1 text-[9px] text-orange-200">
                            Siap Terbit — YouTube upload menunggu kredensial Yang Mulia di Settings.
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-300"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                          {stage.id !== 'komunitas_fizi' && (
                            <button
                              onClick={() => advanceStage(it)}
                              className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] font-bold text-sky-300 hover:bg-sky-400 hover:text-slate-950"
                            >
                              Lanjut <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
