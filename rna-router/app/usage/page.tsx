export const dynamic = "force-dynamic";

import UsageCharts from "./UsageCharts";
import { dbQuery } from "@/lib/db";

export default async function UsagePage() {
  // Aggregate queries
  const byModel = await dbQuery(
    "SELECT model, COUNT(*) as total FROM gateway_logs GROUP BY model"
  );
  const statusDist = await dbQuery(
    "SELECT CASE WHEN status < 400 THEN 'Sukses' ELSE 'Gagal' END as result, COUNT(*) as total FROM gateway_logs GROUP BY result"
  );
  const tokenDaily = await dbQuery(
    "SELECT DATE(created_at) as day, SUM(usage_tokens) as tokens FROM gateway_logs GROUP BY day ORDER BY day DESC LIMIT 7"
  );
  const modelSuccess = await dbQuery(
    "SELECT model, COUNT(*) as total, SUM(CASE WHEN status < 400 THEN 1 ELSE 0 END) as ok FROM gateway_logs GROUP BY model"
  );

  // Format for charts
  const modelData = (byModel || []).map((r: any) => ({
    name: r.model || "unknown",
    total: Number(r.total || 0),
  }));

  const statusData = (statusDist || []).map((r: any) => ({
    name: r.result || "unknown",
    value: Number(r.total || 0),
  }));

  const tokenData = (tokenDaily || [])
    .map((r: any) => ({
      day: String(r.day),
      tokens: Number(r.tokens || 0),
    }))
    .reverse();

  const successRate = (modelSuccess || []).map((r: any) => ({
    name: r.model || "unknown",
    rate: r.total ? Math.round((Number(r.ok || 0) / Number(r.total)) * 100) : 0,
  }));

  return (
    <div className="min-h-screen bg-ink-950 text-slate-100 p-6 md:p-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Usage Analytics</h1>
            <p className="mt-3 text-slate-400">Estimasi token, request, dan status model dari gateway RNA Router.</p>
          </div>
          <a href="/api/usage/export" className="rounded-xl bg-rna-600 px-5 py-2.5 text-sm font-semibold shadow-lg hover:bg-rna-500 transition-colors whitespace-nowrap">📥 Export CSV</a>
        </header>

        <UsageCharts
          modelData={modelData}
          statusData={statusData}
          tokenData={tokenData}
          successRate={successRate}
        />
      </div>
    </div>
  );
}
