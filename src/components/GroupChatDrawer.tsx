import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, ShieldAlert, Trash2, X } from 'lucide-react';
import { AGENTS_CATALOG } from '../data/agentsCatalog';
import { GroupChatMessage, MuseEventPayload } from '../types/office';

const CHAT_STORAGE_KEY = 'kra_group_chat_v1';

interface GroupChatDrawerProps {
  open: boolean;
  onClose: () => void;
  onDispatchEvent: (payload: MuseEventPayload, autoRelay?: boolean) => boolean;
}

const STARTER_PROMPTS = [
  '@RAMA laporan proyek hari ini dan arah berikutnya?',
  '@MARTA cek status tugas staf sekarang',
  '@PUTRI siapkan 5 hook & naskah video baru untuk approval',
  '@MEIMEI checklist QA Gate untuk render RAGA',
  '@NARA audit keamanan koneksi server Exness read-only'
];

export const GroupChatDrawer: React.FC<GroupChatDrawerProps> = ({
  open,
  onClose,
  onDispatchEvent
}) => {
  const coreAgents = AGENTS_CATALOG.filter((a) => a.inGroupChat);

  const [messages, setMessages] = useState<GroupChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as GroupChatMessage[]) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore storage quota
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (!open) return null;

  const sendMessage = async (textToSend: string) => {
    const clean = textToSend.trim();
    if (!clean || sending) return;

    const userMsg: GroupChatMessage = {
      id: `u_${Date.now()}`,
      senderId: 'yang_mulia',
      senderName: 'Yang Mulia (Alfa)',
      emoji: '👑',
      colorHex: '#22d3ee',
      text: clean,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const resp = await fetch('/api/kra/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: clean })
      });
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.replies)) {
        const botMsgs: GroupChatMessage[] = data.replies.map(
          (r: { agentId: string; text: string; source?: string }, idx: number) => {
            const meta = coreAgents.find((a) => a.id === r.agentId);
            if (meta) {
              onDispatchEvent(
                {
                  agentId: meta.id,
                  action: 'thinking',
                  targetRoom: meta.homeRoom,
                  statusText: `Menjawab Yang Mulia di Group Chat`
                },
                false
              );
            }
            return {
              id: `b_${Date.now()}_${idx}`,
              senderId: r.agentId,
              senderName: meta?.name ?? r.agentId.toUpperCase(),
              emoji: meta?.emoji ?? '🤖',
              colorHex: meta ? `#${meta.color.toString(16).padStart(6, '0')}` : '#38bdf8',
              text: r.text,
              timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
              source: r.source
            };
          }
        );
        setMessages((prev) => [...prev, ...botMsgs]);
      }
    } catch {
      // ignore offline error
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-sky-400/35 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-400/20 text-sky-300">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">
                GROUP CHAT &ldquo;KANTOR KRA&rdquo; (Yang Mulia + 8 Agen KRA)
              </h2>
              <p className="text-[10px] text-slate-400">
                Gunakan @RAMA, @MARTA, @NARA, @PUTRI, @RAGA, @MEIMEI, @ARUNA, @FIZI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!confirmClear ? (
              <button
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-300 hover:bg-rose-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Bersihkan Chat
              </button>
            ) : (
              <div className="flex items-center gap-1 rounded-lg border border-rose-400/50 bg-rose-950/80 px-2 py-1 text-[10px]">
                <span className="text-rose-200">Hapus riwayat?</span>
                <button
                  onClick={() => {
                    setMessages([]);
                    setConfirmClear(false);
                  }}
                  className="rounded bg-rose-500 px-1.5 py-0.5 font-bold text-white"
                >
                  Ya
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-200"
                >
                  Batal
                </button>
              </div>
            )}
            <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Anchor Rule Notice: SANDI / MAEL / JARJIT standalone */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-4 py-2 text-[10px] text-slate-300">
          <div className="flex flex-wrap items-center gap-1.5">
            {coreAgents.map((a) => (
              <button
                key={a.id}
                onClick={() => setInput((prev) => `${prev ? prev + ' ' : ''}@${a.id.toUpperCase()} `)}
                className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 font-semibold hover:border-sky-400"
              >
                {a.emoji} {a.name.split(' ')[0]}
              </button>
            ))}
          </div>
          <span className="hidden items-center gap-1 text-purple-300 md:flex">
            <ShieldAlert className="h-3 w-3" />
            SANDI / MAEL / JARJIT standalone di konsol Finance
          </span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4 text-xs">
          {messages.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center">
              <p className="font-semibold text-slate-200">
                Ruang chat masih kosong. Mulai perintah untuk 8 agen KRA di bawah:
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => void sendMessage(p)}
                    className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-left text-[11px] text-sky-200 hover:bg-sky-500/20"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.senderId === 'yang_mulia';
              return (
                <div key={m.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span>{m.emoji}</span>
                    <span className="font-bold" style={{ color: m.colorHex }}>
                      {m.senderName}
                    </span>
                    <span className="font-mono">{m.timestamp}</span>
                    {m.source && (
                      <span className="rounded bg-slate-800 px-1 font-mono text-[9px] text-slate-400">
                        {m.source}
                      </span>
                    )}
                  </div>
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2 leading-relaxed ${
                      isUser
                        ? 'bg-sky-400 font-medium text-slate-950'
                        : 'border border-slate-800 bg-slate-950/85 text-slate-100'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="flex items-center gap-2 border-t border-slate-800 bg-slate-950/70 p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik perintah atau @mention agen KRA (contoh: @PUTRI buat naskah)..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-sky-400 px-4 py-2 text-xs font-extrabold text-slate-950 hover:bg-sky-300 disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Mengirim...' : 'Kirim'}
          </button>
        </form>
      </div>
    </div>
  );
};
