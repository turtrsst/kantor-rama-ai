"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

const COLORS = ["#38bdf8", "#10b981", "#f59e0b", "#f43f5e", "#a855f7"];

export default function UsageCharts({
  modelData,
  statusData,
  tokenData,
  successRate,
}: {
  modelData: { name: string; total: number }[];
  statusData: { name: string; value: number }[];
  tokenData: { day: string; tokens: number }[];
  successRate: { name: string; rate: number }[];
}) {
  const totalRequests = modelData.reduce((a, b) => a + b.total, 0);
  const totalTokens = tokenData.reduce((a, b) => a + b.tokens, 0);

  return (
    <div className="space-y-10">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Request", value: totalRequests },
          { label: "Total Token (7h)", value: totalTokens.toLocaleString() },
          { label: "Model Aktif", value: modelData.length },
          { label: "Status Tracked", value: statusData.length },
        ].map((s) => (
          <div key={s.label} className="glass-card p-5">
            <div className="text-xs uppercase tracking-wider text-slate-400">{s.label}</div>
            <div className="mt-2 text-3xl font-extrabold text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="font-bold mb-4">Request per Model</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={modelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
              <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#0a0f1c", borderColor: "#334155", color: "#fff" }} />
              <Bar dataKey="total" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-bold mb-4">Sukses vs Gagal</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                paddingAngle={3} dataKey="value" label
              >
                {statusData.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={i === 0 ? "#10b981" : "#f43f5e"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#0a0f1c", borderColor: "#334155", color: "#fff" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h3 className="font-bold mb-4">Token per Hari (7 hari)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={tokenData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="day" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
              <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
              <Tooltip contentStyle={{ background: "#0a0f1c", borderColor: "#334155", color: "#fff" }} />
              <Line type="monotone" dataKey="tokens" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h3 className="font-bold mb-4">Tingkat Sukses per Model (%)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={successRate}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} />
              <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#0a0f1c", borderColor: "#334155", color: "#fff" }} />
              <Bar dataKey="rate" fill="#a855f7" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
