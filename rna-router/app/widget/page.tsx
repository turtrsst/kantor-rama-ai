"use client";
import { useState, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";

export default function WidgetPage() {
  const [msgs, setMsgs] = useState<{role:string;content:string}[]>([
    {role:"system",content:"Anda menggunakan RNA Router Widget — gateway AI multi-provider."},
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("muse-spark-1.2-free");
  const [netStatus, setNetStatus] = useState("Menunggu...");
  const [rpm, setRpm] = useState(0);
  const [lastReq, setLastReq] = useState(0);
  const [dailyUsed, setDailyUsed] = useState(0);
  const [dailyReset, setDailyReset] = useState("");

  const DAY_KEY = "rna-widget-day";
  const COUNT_KEY = "rna-widget-chats";

  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0,10);
      const savedDay = localStorage.getItem(DAY_KEY);
      if (savedDay !== today) {
        localStorage.setItem(DAY_KEY, today);
        localStorage.setItem(COUNT_KEY, "0");
      }
      setDailyUsed(parseInt(localStorage.getItem(COUNT_KEY) || "0", 10));
      setDailyReset(today);
    } catch {}
  }, []);

  async function testNetwork() {
    setNetStatus("Mengecek...");
    try {
      const res = await fetch("/api/v1/models");
      if (res.ok) {
        setNetStatus("Online — Koneksi baik");
        setRpm(30);
      } else {
        setNetStatus("Gagal: status " + res.status);
      }
    } catch {
      setNetStatus("Offline / Rate-limit");
    }
  }

  async function send() {
    if (dailyUsed >= 5) {
      setMsgs((m) => [...m, { role: "assistant", content: "Batas 5 chat/hari sudah tercapai. Tunggu besok atau ganti model." }]);
      return;
    }
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input.trim() };
    setMsgs((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": "rna-user-demo" },
        body: JSON.stringify({ model, messages: [...msgs.filter((m: any) => m.role !== "system"), userMsg], temperature: 0.7 }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || data.error || "Tidak ada respons";
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: "Error: " + (e.message || "Gagal menghubungi gateway.") }]);
    } finally {
      setLoading(false);
      const today = new Date().toISOString().slice(0,10);
      const used = parseInt(localStorage.getItem("rna-widget-chats") || "0", 10) + 1;
      localStorage.setItem("rna-widget-chats", String(used));
      localStorage.setItem("rna-widget-day", today);
      setDailyUsed(used);
      setLastReq(Date.now());
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-950 to-ink-900 text-white flex flex-col items-center">
      <header className="w-full max-w-2xl px-6 pt-10 pb-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rna-400 to-emerald-400 text-ink-900 flex items-center justify-center shadow-lg"><Sparkles className="h-5 w-5" /></div>
        <div>
          <h1 className="text-xl font-extrabold">RNA Router Widget</h1>
          <p className="text-xs text-slate-400">Embed ini ke platform KRA atau website anda.</p>
        </div>
      </header>

      <main className="w-full max-w-2xl flex-1 px-6 flex flex-col gap-4">
        <div className="glass-card p-4">
          <label className="text-xs uppercase tracking-wider text-slate-400">Model</label>
          <select value={model} onChange={e=>setModel(e.target.value)} className="mt-2 w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rna-500/40">
            <option value="muse-spark-1.2-free">Muse Spark 1.2 (Free)</option>
            <option value="agnes-7b-instruct">Agnes 7B</option>
            <option value="gemini-flash-1.5">Gemini Flash</option>
            <option value="deepseek-chat">DeepSeek</option>
            <option value="kissing-kimi-k2">Kimi K2</option>
            <option value="openai/gpt-4o">GPT-4o (Free)</option>
            <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
          </select>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Jaringan: <b className={netStatus.includes("Online") ? "text-emerald-300" : "text-rose-300"}>{netStatus}</b></span>
            <button onClick={testNetwork} className="rounded-md bg-white/10 px-2 py-0.5 hover:bg-white/20">Test</button>
          </div>
          <div className="mt-2 text-xs text-amber-300 font-mono">Chat hari ini: {dailyUsed} / 5</div>
        </div>

        <div className="glass-card p-4 flex items-center gap-4">
          <div className="text-sm font-semibold text-slate-200">Status: <span className={dailyUsed >= 5 ? "text-rose-300" : "text-emerald-300"}>{dailyUsed >= 5 ? "Maksimal (5/5)" : `${5 - dailyUsed} tersisa`}</span></div>
          <div className="text-xs text-slate-500">RPM estimasi: ~{rpm} req/min</div>
        </div>

        <div className="glass-card flex-1 overflow-y-auto p-6 space-y-4 min-h-[320px]">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-rna-600 text-white" : "bg-white/10 text-slate-100 border border-white/10"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-slate-400">Merespons...</div>}
        </div>

        <div className="flex gap-2">
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ketik pesan ke RNA Router..." className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rna-500/40" />
          <button onClick={send} disabled={loading || dailyUsed >= 5} className="rounded-xl bg-rna-600 px-4 py-3 hover:bg-rna-500 transition shadow-lg shadow-rna-900/30 disabled:opacity-50"><Send className="h-5 w-5" /></button>
        </div>
      </main>

      <footer className="w-full max-w-2xl px-6 py-8 text-xs text-slate-500 text-center">
        Widget RNA Router · Gunakan dengan <code className="bg-white/10 px-1 rounded">iframe</code> atau embed ke KRA.
      </footer>
    </div>
  );
}
