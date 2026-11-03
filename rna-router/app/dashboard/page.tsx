"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, KeyRound, RefreshCcw, ShieldCheck, Wind, Sparkles, BrainCircuit, ChevronRight } from "lucide-react";
import { MODELS } from "@/lib/models";

type KeyRecord = { provider: string; key_value?: string; created_at?: string };

export default function DashboardPage() {
  const [query, setQuery] = useState("");
  const [keys, setKeys] = useState<KeyRecord[]>([]);
  const [keyProvider, setKeyProvider] = useState("muse");
  const [keyValue, setKeyValue] = useState("");
  const [userApi, setUserApi] = useState(() => { try { return localStorage.getItem("rna_user_api") || "rna-user"; } catch { return "rna-user"; } });
  const [message, setMessage] = useState("");
  const [keyStatus, setKeyStatus] = useState<Record<string, boolean>>({});
  const [models, setModels] = useState(MODELS);

  useEffect(() => {
    fetch(`/api/v1/models?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((j) => setModels(j.data || MODELS))
      .catch(() => setModels(MODELS));
  }, [query]);

  useEffect(() => {
    try { localStorage.setItem("rna_user_api", userApi); } catch {}
    loadKeys();
  }, [userApi]);

  async function loadKeys() {
    try {
      const r = await fetch("/api/keys", { headers: { "x-api-key": userApi } });
      const j = await r.json();
      setKeys(j.data || []);
    } catch {}
  }

  async function saveKey() {
    try {
      const r = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": userApi },
        body: JSON.stringify({ provider: keyProvider, key_value: keyValue }),
      });
      const j = await r.json();
      setMessage(j.message || j.error || "Saved");
      loadKeys();
      setKeyValue("");
    } catch (e: any) {
      setMessage(e.message);
    }
  }

  const filtered = useMemo(() => {
    if (!query) return models;
    return (models || []).filter((m: any) => m && (m?.name?.toLowerCase().includes(query.toLowerCase()) || (m.tags||[]).some((t:any)=>t.includes(query.toLowerCase())) || (m?.provider||"").includes(query.toLowerCase()))) ;
  }, [models, query]);

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-rna-400 to-emerald-400 text-ink-900 flex items-center justify-center shadow-lg shadow-rna-500/20"><Sparkles className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">RNA Router</h1>
              <div className="text-xs text-slate-400">Dashboard · OpenRouter-compatible Gateway</div>
            </div>
          </div>
          <div className="text-xs font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-rna-300">{userApi}</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 space-y-12">
        {/* Search / Model List */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="h-5 w-5 text-rna-300" />
            <h2 className="text-2xl font-bold">Daftar Model</h2>
            <span className="ml-2 text-xs bg-emerald-900/60 text-emerald-300 border border-emerald-700/40 rounded-full px-2.5 py-0.5">{filtered.length} model</span>
          </div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari model: deepseek, gemini, kode, reasoning..."
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-12 pr-4 py-4 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-rna-500/40 focus:border-rna-400 transition shadow-inner shadow-white/[0.02]"
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.filter((m: any) => m && m?.id).map((m: any) => (
              <div key={m?.id} className="glass-card p-6 hover:-translate-y-1 transition-transform duration-300 group">
                <div className="flex items-start justify-between">
                  <div className="text-3xl">{m?.icon}</div>
                  <div className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs font-mono text-slate-300">{m?.provider}</div>
                </div>
                <h3 className="mt-3 text-lg font-bold leading-snug group-hover:text-rna-200 transition-colors">{m?.name}</h3>
                <div className="mt-2 text-sm text-slate-400">{m?.id}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {m.tags.map((t: any) => (
                    <span key={t} className="rounded-md bg-white/5 border border-white/[0.06] px-2 py-0.5 text-xs text-slate-300">{t}</span>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-500">
                  <span>Context: {m.contextWindow.toLocaleString()} tokens</span>
                  <span className="flex items-center gap-1 text-emerald-400">{m.freeTier ? "Gratis" : "Berbayar"}</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">{m.capabilities.join(" · ")}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Key Management */}
        <section className="glass-card p-8 md:p-10">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound className="h-5 w-5 text-amber-300" />
            <h2 className="text-2xl font-bold">Manajemen Key</h2>
          </div>
          <p className="text-sm text-slate-400 mb-6">Simpan API key anda sendiri (Google AI Studio, DeepSeek, Moonshot, etc). Tidak perlu beli token dari kita. Gunakan <code className="bg-white/10 px-1 rounded text-amber-300">x-api-key</code> di request.</p>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">Provider</label>
              <select value={keyProvider} onChange={(e) => setKeyProvider(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-rna-500/40">
                <option value="muse">Muse</option>
                <option value="agnes">Agnes</option>
                <option value="gemini">Gemini / Google</option>
                <option value="deepseek">DeepSeek</option>
                <option value="kimi">Kimi (Moonshot)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">API Key</label>
              <input type="password" value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="sk-... atau api-key" className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rna-500/40 font-mono" />
            </div>
            <div className="flex items-end">
              <button onClick={saveKey} className="w-full rounded-xl bg-rna-600 px-4 py-3 font-semibold text-sm shadow-lg shadow-rna-900/30 hover:bg-rna-500 transition-colors">Simpan Key</button>
            </div>
          </div>

          {message && <div className="mb-4 rounded-xl bg-emerald-900/20 border border-emerald-700/40 px-4 py-3 text-sm text-emerald-200">{message}</div>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase text-slate-400 bg-white/[0.04]">
                <tr>
                  <th className="px-4 py-3 rounded-tl-xl">Provider</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {keys.map((k) => (
                  <tr key={k.provider} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium">{k.provider}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${keyStatus[k.provider] === true ? "bg-emerald-900/40 border-emerald-700/30 text-emerald-200" : keyStatus[k.provider] === false ? "bg-rose-900/40 border-rose-700/30 text-rose-200" : "bg-amber-900/40 border-amber-700/30 text-amber-200"}`}><ShieldCheck className="h-3 w-3" /> {keyStatus[k.provider] === true ? "Valid" : keyStatus[k.provider] === false ? "Invalid" : "Terhubung"}</span></td>
                    <td className="px-4 py-3"><button onClick={async () => { try { const r = await fetch("/api/keys/validate", { method: "POST", headers: { "Content-Type":"application/json", "x-api-key": userApi }, body: JSON.stringify({ provider: k.provider, model_id: "gemini-flash-1.5" }) }); const j = await r.json(); setKeyStatus((prev) => ({ ...prev, [k.provider]: j.valid === true })); } catch(e){} }} className="text-xs text-rna-300 hover:text-rna-200 underline">Test</button> <button onClick={async () => { await fetch("/api/keys", { method: "DELETE", headers: { "Content-Type":"application/json", "x-api-key": userApi }, body: JSON.stringify({ provider: k.provider })}); loadKeys(); }} className="text-xs text-rose-300 hover:text-rose-200 underline">Hapus</button></td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Belum ada key tersimpan. Tambahkan di atas.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl bg-amber-900/10 border border-amber-700/30 p-4 text-sm text-amber-200 flex items-start gap-3">
            <KeyRound className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <strong>Keamanan:</strong> Key disimpan di Supabase dengan service role. Gunakan <code className="bg-white/10 px-1 rounded">x-api-key</code> sebagai autentikasi user. Jangan ekspos endpoint key ke publik tanpa otorisasi lebih lanjut.
            </div>
          </div>
        </section>

        {/* Fallback / Stats */}
        <section className="grid md:grid-cols-3 gap-6">
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-2 text-rna-300"><RefreshCcw className="h-5 w-5" /> <h3 className="font-bold">Auto Fallback</h3></div>
            <p className="text-sm text-slate-400">Jika model utama rate-limit, gateway otomatis berusaha ke model lain dalam urutan: Muse → Agnes → Gemini → DeepSeek → Kimi.</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              {["muse","agnes","gemini","deepseek","kimi"].map(s => <span key={s} className="text-xs bg-white/5 border border-white/10 rounded px-2 py-0.5 text-slate-300">{s}</span>)}
            </div>
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-2 text-emerald-300"><Wind className="h-5 w-5" /> <h3 className="font-bold">Rate Limit</h3></div>
            <p className="text-sm text-slate-400">Status 429, 503, atau pesan error berisi "quota" / "throttle" akan memicu fallback otomatis. Tidak perlu restart server.</p>
          </div>
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-2 text-amber-300"><ShieldCheck className="h-5 w-5" /> <h3 className="font-bold">KRA Webhook</h3></div>
            <p className="text-sm text-slate-400">Tersedia opsi webhook ke <code className="text-amber-200">KRA_WEBHOOK_URL</code> untuk integrasi platform kantor-ramai. Konfigurasi di environment.</p>
          </div>
        </section>

        {/* API Example */}
        <section className="glass-card p-8 md:p-10 overflow-x-auto">
          <h2 className="text-xl font-bold mb-4">Contoh Request (cURL)</h2>
          <pre className="font-mono text-sm text-slate-300 leading-relaxed">
{`curl -X POST https://your-app.vercel.app/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: rna-user-xxx" \\
  -d '{
    "model": "muse-spark-1.2-free",
    "messages": [{"role":"user","content":"Halo, apa kabar?"}],
    "temperature": 0.7
  }'`}
          </pre>
          <div className="mt-4 text-sm text-slate-400">Ganti <code className="text-rna-300">your-app.vercel.app</code> dengan domain Vercel anda. Gunakan model id dari daftar di atas.</div>
        </section>
      </main>
      <footer className="border-t border-white/10 bg-ink-950 py-8 text-center text-xs text-slate-500">
        RNA Router · Fullstack AI Gateway · Deploy Vercel + Supabase · Terhubung ke KRA (kantor-rama-ai)
      </footer>
    </div>
  );
}
