import Link from "next/link";
import { Zap, ShieldCheck, Search, RefreshCcw, KeyRound, Globe, Box } from "lucide-react";

const features = [
  { icon: Zap, title: "OpenRouter API", desc: "Kompatibel penuh: /v1/chat/completions, /v1/models, streaming." },
  { icon: ShieldCheck, title: "Key Management", desc: "Vault key sendiri di Supabase. Tidak perlu beli token dari kami." },
  { icon: Search, title: "Search Model", desc: "Cari model berdasarkan nama, provider, atau capability." },
  { icon: RefreshCcw, title: "Auto Fallback", desc: "Jika rate-limit atau error, otomatis beralih ke provider lain." },
  { icon: KeyRound, title: "Multi-Provider Gratis", desc: "Muse Spark, Agnes, Gemini Flash, DeepSeek, Kimi — gratis." },
  { icon: Globe, title: "KRA Integration", desc: "Webhook & API endpoint untuk integrasi platform KRA (kantor-rama-ai)." },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background glows */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-rna-700/30 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/20 blur-[120px]" />
      </div>

      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-rna-300 backdrop-blur-md">
          <Box className="h-4 w-4" />
          RNA Router v1.0 — OpenRouter-compatible AI Gateway
        </div>
        <h1 className="mt-8 text-5xl font-extrabold leading-tight tracking-tight md:text-7xl">
          Aggregator AI Gateway <br />
          <span className="bg-gradient-to-r from-rna-300 via-emerald-300 to-rna-400 bg-clip-text text-transparent">Multi-Provider Gratis</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 leading-relaxed">
          Gateway AI open-source yang menggabungkan <strong className="text-white">Muse Spark, Agnes, Gemini Flash, DeepSeek, dan Kimi</strong> dalam satu API kompatibel OpenRouter. Key management sendiri, auto-fallback saat rate-limit, dan integrasi mudah ke platform anda seperti <strong>KRA (kantor-rama-ai)</strong>.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/dashboard" className="rounded-xl bg-rna-600 px-8 py-3.5 text-white font-semibold shadow-lg shadow-rna-900/40 hover:bg-rna-500 transition-colors">Buka Dashboard</Link>
          <Link href="https://github.com/turtrsst/RNA-Router" target="_blank" className="rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 font-semibold hover:bg-white/10 transition-colors">GitHub</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass-card p-7 hover:-translate-y-1 transition-transform duration-300">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rna-900/60 text-rna-300 shadow-inner shadow-rna-400/10">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20">
        <div className="glass-card p-10 md:p-14">
          <h2 className="text-3xl font-extrabold">Integrasi KRA (Kantor Rama AI)</h2>
          <p className="mt-3 text-slate-400">Gunakan endpoint RNA Router sebagai backend AI untuk platform KRA anda. Webhook, API key rotation, dan logging otomatis sudah disediakan.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-white/5 p-4 border border-white/5">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Endpoint Chat</div>
              <code className="mt-1 block text-sm text-emerald-300 font-mono">POST /api/v1/chat/completions</code>
            </div>
            <div className="rounded-xl bg-white/5 p-4 border border-white/5">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Endpoint Models</div>
              <code className="mt-1 block text-sm text-rna-300 font-mono">GET /api/v1/models?q=deepseek</code>
            </div>
            <div className="rounded-xl bg-white/5 p-4 border border-white/5">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Webhook KRA</div>
              <code className="mt-1 block text-sm text-amber-300 font-mono">KRA_WEBHOOK_URL</code>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink-900/60 py-12 text-center text-sm text-slate-500">
        RNA Router — Dibuat oleh turtrsst · Deploy ke Vercel + Supabase · Open Source
      </footer>
    </div>
  );
}
