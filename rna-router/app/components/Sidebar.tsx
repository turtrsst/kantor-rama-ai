"use client";
import Link from "next/link";
import { LayoutDashboard, BarChart3, Box, Home, KeyRound, Zap } from "lucide-react";

export default function Sidebar() {
  const links = [
    { href: "/", label: "Beranda", icon: Home },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/usage", label: "Usage / Analytics", icon: BarChart3 },
    { href: "/widget", label: "Widget Embed", icon: Box },
    { href: "/api/keys", label: "Key Management", icon: KeyRound },
  ];
  return (
    <aside className="hidden md:flex w-64 flex-shrink-0 flex-col border-r border-white/10 bg-ink-950/80 backdrop-blur-xl p-6 gap-2 sticky top-0 h-screen">
      <div className="mb-6">
        <Link href="/" className="flex items-center gap-3 text-xl font-extrabold text-white hover:text-rna-300 transition-colors">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-rna-400 to-emerald-400 text-ink-900 flex items-center justify-center shadow-lg shadow-rna-500/20"><Zap className="h-5 w-5" /></div>
          RNA Router
        </Link>
        <div className="text-xs text-slate-500 mt-1">AI Gateway Aggregator</div>
      </div>
      <nav className="flex flex-col gap-1">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors">
            <l.icon className="h-4 w-4 text-rna-300" />
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-white/10 text-xs text-slate-500">
        Branch: <span className="text-rna-300 font-mono">arena/ffbada04</span>
      </div>
    </aside>
  );
}
