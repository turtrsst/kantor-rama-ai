import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Coins,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wallet,
  X
} from 'lucide-react';
import {
  ExnessConnectivityReport,
  ExnessProfileStatus,
  MuseEventPayload
} from '../types/office';

export interface ExnessStatusState {
  demo: ExnessProfileStatus;
  real: ExnessProfileStatus;
  readOnlyEnforced?: boolean;
  note?: string;
}

export interface ExnessAccountDetails {
  currency: string | null;
  leverage: number | null;
  marginCall: number | null;
  stopOut: number | null;
  balance: number | null;
  equity: number | null;
  margin: number | null;
  freeMargin: number | null;
  fetchedAt?: string;
}

interface FinanceConsoleModalProps {
  open: boolean;
  onClose: () => void;
  exnessStatus: ExnessStatusState | null;
  onRefreshExnessStatus: () => Promise<void>;
  onAccountSnapshotReceived: (
    profile: 'demo' | 'real',
    balance: number | null,
    currency: string | null
  ) => void;
  onOpenSettings: () => void;
  onDispatchEvent: (payload: MuseEventPayload, autoRelay?: boolean) => boolean;
}

interface SandiBriefAsset {
  symbol: string;
  price: number;
  change24hPct: number | null;
  source: string;
}

interface SandiBriefData {
  fetchedAt: string | null;
  regime: string;
  assets: SandiBriefAsset[];
  notRetrieved: string[];
  disclaimer: string;
}

interface SandiAnalyzeResult {
  ticker: string;
  verdict: string;
  confidence: string;
  sizing: {
    accountSize: number | null;
    riskPct: number;
    riskCapitalUsd: number | null;
    stopDistance: number | null;
    fixedFractionalUnits: number | null;
    atrSuggestedStop: number | null;
    halfKellyPct: number;
  };
  scenarios: { bear: string; base: string; bull: string };
  notRetrieved: string[];
  disclaimer: string;
}

interface WatchlistEntry {
  id: string;
  symbol: string;
  note: string;
  addedAt: string;
}

interface ThesisEntry {
  id: string;
  symbol: string;
  thesis: string;
  invalidation: string;
  horizon: string;
  createdAt: string;
}

interface AirdropEntry {
  id: string;
  protocol: string;
  officialUrl: string;
  sybilNote: string;
  addedAt: string;
}

const WATCHLIST_KEY = 'kra_finance_watchlist_v1';
const THESIS_KEY = 'kra_finance_thesis_v1';
const AIRDROP_KEY = 'kra_finance_airdrops_v1';

export const FinanceConsoleModal: React.FC<FinanceConsoleModalProps> = ({
  open,
  onClose,
  exnessStatus,
  onRefreshExnessStatus,
  onAccountSnapshotReceived,
  onOpenSettings,
  onDispatchEvent
}) => {
  const [tab, setTab] = useState<'exness' | 'sandi' | 'mael' | 'jarjit'>('exness');
  const [testingProfile, setTestingProfile] = useState<'demo' | 'real' | null>(null);
  const [fetchingProfile, setFetchingProfile] = useState<'demo' | 'real' | null>(null);
  const [testReport, setTestReport] = useState<Partial<Record<'demo' | 'real', ExnessConnectivityReport>>>({});
  const [accountSnapshots, setAccountSnapshots] = useState<Partial<Record<'demo' | 'real', ExnessAccountDetails>>>({});
  const [exnessError, setExnessError] = useState<string | null>(null);

  // SANDI Market Brief & Sizing
  const [brief, setBrief] = useState<SandiBriefData | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [tickerInput, setTickerInput] = useState('BTCUSDT');
  const [equityUsd, setEquityUsd] = useState('1000');
  const [riskPct, setRiskPct] = useState('1.0');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [atrValue, setAtrValue] = useState('');
  const [winRatePct, setWinRatePct] = useState('48');
  const [rrRatio, setRrRatio] = useState('2.2');
  const [eventGateActive, setEventGateActive] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState<SandiAnalyzeResult | null>(null);

  // Empty Watchlist, Thesis, Airdrop (Zero Fake Data!)
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>(() => {
    try {
      const s = localStorage.getItem(WATCHLIST_KEY);
      return s ? (JSON.parse(s) as WatchlistEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [theses, setTheses] = useState<ThesisEntry[]>(() => {
    try {
      const s = localStorage.getItem(THESIS_KEY);
      return s ? (JSON.parse(s) as ThesisEntry[]) : [];
    } catch {
      return [];
    }
  });
  const [airdrops, setAirdrops] = useState<AirdropEntry[]>(() => {
    try {
      const s = localStorage.getItem(AIRDROP_KEY);
      return s ? (JSON.parse(s) as AirdropEntry[]) : [];
    } catch {
      return [];
    }
  });

  const [newWatchSymbol, setNewWatchSymbol] = useState('');
  const [newWatchNote, setNewWatchNote] = useState('');

  const [newThesisSymbol, setNewThesisSymbol] = useState('');
  const [newThesisText, setNewThesisText] = useState('');
  const [newThesisInvalidation, setNewThesisInvalidation] = useState('');

  const [newAirdropProto, setNewAirdropProto] = useState('');
  const [newAirdropUrl, setNewAirdropUrl] = useState('');
  const [newAirdropRisk, setNewAirdropRisk] = useState('');

  // MAEL Risk Guard Evaluator
  const [maelTradeRiskPct, setMaelTradeRiskPct] = useState('1.0');
  const [maelRR, setMaelRR] = useState('2.5');
  const [maelHasStopLoss, setMaelHasStopLoss] = useState(true);
  const [maelOpenCount, setMaelOpenCount] = useState('1');

  useEffect(() => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
  }, [watchlist]);
  useEffect(() => {
    localStorage.setItem(THESIS_KEY, JSON.stringify(theses));
  }, [theses]);
  useEffect(() => {
    localStorage.setItem(AIRDROP_KEY, JSON.stringify(airdrops));
  }, [airdrops]);

  if (!open) return null;

  const runTestConnection = async (profile: 'demo' | 'real') => {
    setTestingProfile(profile);
    setExnessError(null);
    try {
      const resp = await fetch('/api/exness/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });
      const data = (await resp.json()) as ExnessConnectivityReport;
      setTestReport((prev) => ({ ...prev, [profile]: data }));
      const allPass =
        data.selfTest.allPassed &&
        data.discovery.status === 'PASS' &&
        data.accountDetails.status === 'PASS';

      if (data.accountDetails.status === 'PASS') {
        const snap: ExnessAccountDetails = {
          currency: data.accountDetails.currency ?? null,
          leverage: data.accountDetails.leverage ?? null,
          marginCall: data.accountDetails.marginCall ?? null,
          stopOut: data.accountDetails.stopOut ?? null,
          balance: data.accountDetails.balance ?? null,
          equity: data.accountDetails.equity ?? null,
          margin: data.accountDetails.margin ?? null,
          freeMargin: data.accountDetails.freeMargin ?? null,
          fetchedAt: data.accountDetails.fetchedAt
        };
        setAccountSnapshots((prev) => ({ ...prev, [profile]: snap }));
        onAccountSnapshotReceived(profile, snap.balance, snap.currency);
      }

      onDispatchEvent(
        {
          agentId: 'mael',
          action: allPass ? 'success' : 'thinking',
          targetRoom: 'Floor3_TreasuryVault',
          statusText: `Test Exness ${profile.toUpperCase()}: ${
            allPass ? 'PASS (Read-Only)' : data.discovery.message || data.accountDetails.message || 'Cek Hasil'
          }`
        },
        false
      );
    } catch (e) {
      setExnessError(e instanceof Error ? e.message : 'Gagal menghubungi server.');
    } finally {
      setTestingProfile(null);
    }
  };

  const fetchAccount = async (profile: 'demo' | 'real') => {
    setFetchingProfile(profile);
    setExnessError(null);
    try {
      const resp = await fetch(`/api/exness/account?profile=${profile}`);
      const data = await resp.json();
      if (!resp.ok || data.status === 'not_configured' || !data.account) {
        setExnessError(
          data.error || `Profil ${profile.toUpperCase()} belum dikonfigurasi atau gagal mengambil saldo.`
        );
      } else {
        const acc = data.account as ExnessAccountDetails;
        acc.fetchedAt = data.fetchedAt;
        setAccountSnapshots((prev) => ({ ...prev, [profile]: acc }));
        onAccountSnapshotReceived(profile, acc.balance, acc.currency);
        await onRefreshExnessStatus();
        onDispatchEvent(
          {
            agentId: 'mael',
            action: 'success',
            targetRoom: 'Floor3_TreasuryVault',
            statusText: `Exness ${profile.toUpperCase()} Balance: ${acc.balance ?? 'N/A'} ${acc.currency ?? ''}`
          },
          false
        );
      }
    } catch (e) {
      setExnessError(e instanceof Error ? e.message : 'Gagal fetch akun Exness.');
    } finally {
      setFetchingProfile(null);
    }
  };

  const fetchSandiBrief = async () => {
    setLoadingBrief(true);
    try {
      const resp = await fetch('/api/market/sandi-brief');
      const data = (await resp.json()) as SandiBriefData;
      setBrief(data);
      onDispatchEvent(
        {
          agentId: 'sandi',
          action: 'success',
          targetRoom: 'Floor3_TradingPit',
          statusText: `SANDI Brief (${data.regime}): ${data.assets.length} aset live`
        },
        false
      );
    } catch {
      // ignore
    } finally {
      setLoadingBrief(false);
    }
  };

  const runSandiAnalyze = async () => {
    try {
      const resp = await fetch('/api/sandi/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: tickerInput,
          accountSize: Number(equityUsd) || 0,
          riskPct: Number(riskPct) || 1,
          entry: Number(entryPrice) || 0,
          stop: Number(stopPrice) || 0,
          atr: Number(atrValue) || 0,
          winRate: (Number(winRatePct) || 45) / 100,
          payoffRatio: Number(rrRatio) || 2,
          eventGateActive
        })
      });
      if (resp.ok) {
        const res = (await resp.json()) as SandiAnalyzeResult;
        setAnalyzeResult(res);
        onDispatchEvent(
          {
            agentId: 'sandi',
            action: 'thinking',
            targetRoom: 'Floor3_TradingPit',
            statusText: `SANDI ${res.ticker}: ${res.verdict}`
          },
          false
        );
      }
    } catch {
      // ignore
    }
  };

  // MAEL gate check
  const mRisk = Number(maelTradeRiskPct) || 0;
  const mRR = Number(maelRR) || 0;
  const mOpen = Number(maelOpenCount) || 0;
  const maelViolations: string[] = [];
  if (mRisk > 2.0) maelViolations.push(`Risk ${mRisk}% melebihi hard cap MAEL (max 2.0%)`);
  if (mRR < 2.0) maelViolations.push(`Risk:Reward ${mRR} di bawah batas minimum 1:2.0`);
  if (!maelHasStopLoss) maelViolations.push('Hard Stop-Loss WAJIB aktif');
  if (mOpen >= 3) maelViolations.push('Max posisi terbuka adalah 3');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-purple-400/35 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-400/20 text-purple-300">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">
                DIVISI FINANCE STANDALONE — SANDI · MAEL · JARJIT (LANTAI 3)
              </h2>
              <p className="text-[10px] text-purple-200">
                Terpisah dari Group Chat Kantor KRA · Exness Read-Only Server-Side (GET Only · Zero Order Execution)
              </p>
            </div>
          </div>

          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/70 px-5 py-2 text-xs">
          <div className="flex gap-1.5">
            {[
              { id: 'exness', label: '🏦 Exness DEMO & REAL (Read-Only)' },
              { id: 'sandi', label: '📈 SANDI — Market & Sizing' },
              { id: 'mael', label: '🛡️ MAEL — Treasury & Risk Guard' },
              { id: 'jarjit', label: '🪂 JARJIT — Airdrop Hunter' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`rounded-lg px-3 py-1.5 font-bold transition ${
                  tab === t.id
                    ? 'bg-purple-400 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenSettings}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-amber-300 hover:border-amber-400"
          >
            ⚙️ Atur Kredensial di Settings
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {tab === 'exness' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-emerald-200">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <strong>Mode Read-Only Ketat:</strong> Semua pemanggilan Exness berjalan di server{' '}
                  <code>/api/exness/*</code> menggunakan <strong>GET only</strong>, HTTPS enforced, tanpa auto-redirect,
                  dan <strong>tidak ada endpoint/tombol order BUY/SELL/CLOSE</strong>.
                </div>
              </div>

              {exnessError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {exnessError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {(['demo', 'real'] as const).map((profile) => {
                  const pStatus = exnessStatus?.[profile];
                  const report = testReport[profile];
                  const snap = accountSnapshots[profile];

                  return (
                    <div
                      key={profile}
                      className="flex flex-col justify-between space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                              profile === 'demo'
                                ? 'bg-sky-500/20 text-sky-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            Exness {profile.toUpperCase()} (Read-Only)
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              pStatus?.configured ? 'text-emerald-300' : 'text-slate-500'
                            }`}
                          >
                            {pStatus?.configured ? `TERSIMPAN (${pStatus.source})` : 'BELUM DISET'}
                          </span>
                        </div>

                        {pStatus?.configured ? (
                          <div className="space-y-1 rounded-lg bg-slate-900/90 p-2.5 font-mono text-[10px] text-slate-300">
                            <div>Gateway URL: {pStatus.discoveryBaseUrl}</div>
                            <div>API Key: {pStatus.apiKeyLast4}</div>
                            <div>Account ID: {pStatus.accountIdMasked}</div>
                            <div>Expiry: {pStatus.expiryDate || '-'}</div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-800 p-3 text-[11px] text-slate-400">
                            Belum ada kredensial {profile.toUpperCase()} tersimpan. Klik Test Connection untuk
                            menjalankan offline Ed25519 self-test, atau buka Settings untuk menyimpan kunci server-side.
                          </div>
                        )}

                        {report && (
                          <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-[10px]">
                            <div className="font-bold text-slate-200">
                              Self-Test ({report.selfTest.passedCount}/{report.selfTest.totalCount}) · Discovery:{' '}
                              <span
                                className={
                                  report.discovery.status === 'PASS' ? 'text-emerald-300' : 'text-rose-300'
                                }
                              >
                                {report.discovery.status}
                              </span>{' '}
                              · Account:{' '}
                              <span
                                className={
                                  report.accountDetails.status === 'PASS'
                                    ? 'text-emerald-300'
                                    : report.accountDetails.status === 'SKIP'
                                      ? 'text-amber-300'
                                      : 'text-rose-300'
                                }
                              >
                                {report.accountDetails.status}
                              </span>
                            </div>
                            {report.selfTest.checks.map((c) => (
                              <div key={c.name} className={c.pass ? 'text-emerald-300' : 'text-rose-300'}>
                                {c.pass ? '✓' : '✗'} {c.name}
                              </div>
                            ))}
                            {report.discovery.message && (
                              <div className="text-amber-300">Discovery: {report.discovery.message}</div>
                            )}
                            {report.accountDetails.message && (
                              <div className="text-slate-400">Account: {report.accountDetails.message}</div>
                            )}
                          </div>
                        )}

                        {snap && (
                          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px]">
                            <div>
                              <span className="text-slate-400">Currency:</span>{' '}
                              <span className="font-mono font-bold text-white">{snap.currency ?? '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Leverage:</span>{' '}
                              <span className="font-mono text-white">1:{snap.leverage ?? '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Balance:</span>{' '}
                              <span className="font-mono font-bold text-emerald-300">
                                {snap.balance ?? 'BELUM DIAMBIL'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Equity:</span>{' '}
                              <span className="font-mono font-bold text-emerald-300">
                                {snap.equity ?? 'BELUM DIAMBIL'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Free Margin:</span>{' '}
                              <span className="font-mono text-white">{snap.freeMargin ?? '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Margin Call / SO:</span>{' '}
                              <span className="font-mono text-amber-300">
                                {snap.marginCall ?? '-'}% / {snap.stopOut ?? '-'}%
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => void runTestConnection(profile)}
                          disabled={testingProfile === profile}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/15 py-2 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25 disabled:opacity-40"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {testingProfile === profile ? 'Menguji...' : 'Test Connection'}
                        </button>
                        <button
                          onClick={() => void fetchAccount(profile)}
                          disabled={!pStatus?.configured || fetchingProfile === profile}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-400 py-2 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-300 disabled:opacity-40"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          {fetchingProfile === profile ? 'Mengambil...' : 'Ambil Saldo (GET)'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'sandi' && (
            <div className="space-y-4">
              {/* Disclaimer */}
              <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-amber-200">
                <span>
                  <strong>Disclaimer SANDI:</strong> Analisa &amp; kalkulator posisi bersifat edukatif. Bukan saran
                  investasi / bukan financial advice.
                </span>
                <button
                  onClick={() => void fetchSandiBrief()}
                  disabled={loadingBrief}
                  className="flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-amber-300"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingBrief ? 'animate-spin' : ''}`} />
                  {loadingBrief ? 'Mengambil...' : 'Ambil Brief Pagi (Live)'}
                </button>
              </div>

              {/* Brief Pagi Real Data */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-slate-200">
                    <BarChart3 className="mr-1 inline h-4 w-4 text-sky-300" />
                    Brief Market Publik (CoinGecko Free API)
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    {brief?.fetchedAt ? `Regime: ${brief.regime} • ${brief.fetchedAt}` : 'Status: BELUM DIAMBIL'}
                  </span>
                </div>
                {!brief ? (
                  <p className="text-slate-400">
                    Klik <strong>Ambil Brief Pagi (Live)</strong> untuk menarik data harga riil dari server. Tidak ada
                    angka simulasi.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {brief.assets.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        {brief.assets.map((coin) => (
                          <div key={coin.symbol} className="rounded-lg bg-slate-900 p-2.5">
                            <div className="text-[10px] text-slate-400">{coin.symbol}</div>
                            <div className="font-mono text-sm font-bold text-white">
                              ${coin.price.toLocaleString('en-US')}
                            </div>
                            <div
                              className={`font-mono text-[10px] ${
                                (coin.change24hPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'
                              }`}
                            >
                              {coin.change24hPct != null ? `${coin.change24hPct.toFixed(2)}% (24j)` : '-'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg bg-slate-900 p-3 text-amber-300">
                        Feed eksternal belum dapat diakses dari sandbox (BELUM DIAMBIL).
                      </div>
                    )}
                    {brief.notRetrieved.length > 0 && (
                      <div className="text-[10px] text-slate-400">
                        Belum diambil: {brief.notRetrieved.join(' · ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Server-Backed SANDI Analyze + Position Sizing */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-100">
                    <Activity className="mr-1 inline h-4 w-4 text-emerald-300" />
                    Kalkulator Position Sizing &amp; Skenario SANDI (/api/sandi/analyze)
                  </span>
                  <button
                    onClick={() => void runSandiAnalyze()}
                    className="rounded-lg bg-sky-400 px-3 py-1 text-[11px] font-extrabold text-slate-950 hover:bg-sky-300"
                  >
                    Hitung Sizing (Fixed / ATR / Half-Kelly)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Ticker / Pair</span>
                    <input
                      value={tickerInput}
                      onChange={(e) => setTickerInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Account Equity (USD)</span>
                    <input
                      value={equityUsd}
                      onChange={(e) => setEquityUsd(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Risk % (Default 1%)</span>
                    <input
                      value={riskPct}
                      onChange={(e) => setRiskPct(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">ATR (opsional)</span>
                    <input
                      value={atrValue}
                      onChange={(e) => setAtrValue(e.target.value)}
                      placeholder="mis. 1200"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Entry Price</span>
                    <input
                      value={entryPrice}
                      onChange={(e) => setEntryPrice(e.target.value)}
                      placeholder="Entry riil"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Stop Price (Invalidation)</span>
                    <input
                      value={stopPrice}
                      onChange={(e) => setStopPrice(e.target.value)}
                      placeholder="Hard SL"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Win Rate % / R:R</span>
                    <div className="flex gap-1">
                      <input
                        value={winRatePct}
                        onChange={(e) => setWinRatePct(e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-white"
                      />
                      <input
                        value={rrRatio}
                        onChange={(e) => setRrRatio(e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 font-mono text-white"
                      />
                    </div>
                  </label>
                  <label className="flex items-center gap-2 pt-5 text-slate-200">
                    <input
                      type="checkbox"
                      checked={eventGateActive}
                      onChange={(e) => setEventGateActive(e.target.checked)}
                      className="accent-rose-400"
                    />
                    Event Gate (FOMC/CPI)
                  </label>
                </div>

                {analyzeResult && (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-3 text-[11px]">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                      <span className="text-sky-300">
                        {analyzeResult.ticker}: {analyzeResult.verdict}
                      </span>
                      <span className="text-amber-300">Confidence: {analyzeResult.confidence}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-[10px] md:grid-cols-4">
                      <div>Risk USD: ${analyzeResult.sizing.riskCapitalUsd ?? '-'}</div>
                      <div>Stop Dist: {analyzeResult.sizing.stopDistance ?? '-'}</div>
                      <div>Units: {analyzeResult.sizing.fixedFractionalUnits ?? '-'}</div>
                      <div>Half-Kelly: {analyzeResult.sizing.halfKellyPct}%</div>
                    </div>
                    <div className="text-[10px] text-slate-300">
                      • <strong>Bear:</strong> {analyzeResult.scenarios.bear} · <strong>Base:</strong>{' '}
                      {analyzeResult.scenarios.base} · <strong>Bull:</strong> {analyzeResult.scenarios.bull}
                    </div>
                  </div>
                )}
              </div>

              {/* Empty Watchlist & Thesis Journal */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="font-bold text-slate-100">Watchlist Kosong Awal ({watchlist.length})</div>
                  <div className="flex gap-1.5">
                    <input
                      value={newWatchSymbol}
                      onChange={(e) => setNewWatchSymbol(e.target.value)}
                      placeholder="Simbol (mis. BTCUSDT)"
                      className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                    />
                    <input
                      value={newWatchNote}
                      onChange={(e) => setNewWatchNote(e.target.value)}
                      placeholder="Level / catatan"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                    />
                    <button
                      onClick={() => {
                        if (!newWatchSymbol.trim()) return;
                        setWatchlist((p) => [
                          {
                            id: `w_${Date.now()}`,
                            symbol: newWatchSymbol.trim().toUpperCase(),
                            note: newWatchNote.trim() || '-',
                            addedAt: new Date().toLocaleTimeString('id-ID', { hour12: false })
                          },
                          ...p
                        ]);
                        setNewWatchSymbol('');
                        setNewWatchNote('');
                      }}
                      className="rounded-lg bg-sky-400 px-2.5 py-1 font-bold text-slate-950"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {watchlist.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-800 p-3 text-center text-[11px] text-slate-500">
                      Watchlist kosong (zero fake data).
                    </div>
                  ) : (
                    watchlist.map((w) => (
                      <div key={w.id} className="flex items-center justify-between rounded-lg bg-slate-900 px-2.5 py-1.5">
                        <div>
                          <span className="font-mono font-bold text-sky-300">{w.symbol}</span>{' '}
                          <span className="text-slate-300">— {w.note}</span>
                        </div>
                        <button
                          onClick={() => setWatchlist((p) => p.filter((x) => x.id !== w.id))}
                          className="text-slate-500 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="font-bold text-slate-100">Thesis Journal Kosong Awal ({theses.length})</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      value={newThesisSymbol}
                      onChange={(e) => setNewThesisSymbol(e.target.value)}
                      placeholder="Simbol"
                      className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                    />
                    <input
                      value={newThesisText}
                      onChange={(e) => setNewThesisText(e.target.value)}
                      placeholder="Tesis utama"
                      className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                    />
                    <input
                      value={newThesisInvalidation}
                      onChange={(e) => setNewThesisInvalidation(e.target.value)}
                      placeholder="Level Invalidation (wajib)"
                      className="col-span-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-white"
                    />
                    <button
                      onClick={() => {
                        if (!newThesisSymbol.trim() || !newThesisText.trim()) return;
                        setTheses((p) => [
                          {
                            id: `t_${Date.now()}`,
                            symbol: newThesisSymbol.trim().toUpperCase(),
                            thesis: newThesisText.trim(),
                            invalidation: newThesisInvalidation.trim() || 'Wajib diisi',
                            horizon: 'Swing',
                            createdAt: new Date().toLocaleTimeString('id-ID', { hour12: false })
                          },
                          ...p
                        ]);
                        setNewThesisSymbol('');
                        setNewThesisText('');
                        setNewThesisInvalidation('');
                      }}
                      className="rounded-lg bg-emerald-400 px-2 py-1 font-bold text-slate-950"
                    >
                      Catat Tesis
                    </button>
                  </div>
                  {theses.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-800 p-3 text-center text-[11px] text-slate-500">
                      Thesis Journal kosong (zero fake data).
                    </div>
                  ) : (
                    theses.map((t) => (
                      <div key={t.id} className="flex items-start justify-between rounded-lg bg-slate-900 px-2.5 py-1.5">
                        <div>
                          <span className="font-mono font-bold text-emerald-300">{t.symbol}</span>: {t.thesis}{' '}
                          <span className="text-[10px] text-rose-300">(Invalidation: {t.invalidation})</span>
                        </div>
                        <button
                          onClick={() => setTheses((p) => p.filter((x) => x.id !== t.id))}
                          className="text-slate-500 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'mael' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
                <div className="mb-2 flex items-center gap-2 font-extrabold text-amber-200">
                  <ShieldAlert className="h-4 w-4" />
                  MAEL — Treasury &amp; Risk Guard Rules (finance/risk-rules.json)
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                  <div className="rounded-lg bg-slate-950/70 p-2">Default Risk/Trade: <strong>1.0%</strong></div>
                  <div className="rounded-lg bg-slate-950/70 p-2">Hard Cap/Trade: <strong>2.0%</strong></div>
                  <div className="rounded-lg bg-slate-950/70 p-2">Max Daily Loss: <strong>3.0%</strong></div>
                  <div className="rounded-lg bg-slate-950/70 p-2">Max Open Pos: <strong>3</strong></div>
                  <div className="rounded-lg bg-slate-950/70 p-2">Min R:R Ratio: <strong>1 : 2.0</strong></div>
                  <div className="rounded-lg bg-slate-950/70 p-2">Hard Stop-Loss: <strong>WAJIB</strong></div>
                  <div className="rounded-lg bg-slate-950/70 p-2">Revenge Trading: <strong>DILARANG</strong></div>
                  <div className="rounded-lg bg-slate-950/70 p-2">Averaging Down: <strong>DILARANG</strong></div>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="font-bold text-white">Pre-Trade Risk Gate Simulator (Tanpa Eksekusi Order)</div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Proposed Risk %</span>
                    <input
                      value={maelTradeRiskPct}
                      onChange={(e) => setMaelTradeRiskPct(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Proposed R:R</span>
                    <input
                      value={maelRR}
                      onChange={(e) => setMaelRR(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] text-slate-400">Posisi Terbuka</span>
                    <input
                      value={maelOpenCount}
                      onChange={(e) => setMaelOpenCount(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-white"
                    />
                  </label>
                  <label className="flex items-center gap-2 pt-5 text-slate-200">
                    <input
                      type="checkbox"
                      checked={maelHasStopLoss}
                      onChange={(e) => setMaelHasStopLoss(e.target.checked)}
                      className="accent-emerald-400"
                    />
                    Hard Stop-Loss Terpasang
                  </label>
                </div>

                {maelViolations.length === 0 ? (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 p-3 font-bold text-emerald-300">
                    ✓ MAEL RISK GATE PASS: Setup memenuhi aturan modal &amp; risk guard.
                  </div>
                ) : (
                  <div className="space-y-1 rounded-lg border border-rose-500/40 bg-rose-500/15 p-3 text-rose-200">
                    <div className="font-bold">✗ DITOLAK MAEL:</div>
                    {maelViolations.map((v) => (
                      <div key={v}>• {v}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'jarjit' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-amber-200">
                <strong>Aturan JARJIT (Zero Fake Listing!):</strong> Hanya catat kampanye dengan URL dokumentasi resmi
                protokol. Wajib cantumkan risiko Sybil, lockup, gas/biaya, dan tidak ada jaminan alokasi.
              </div>

              <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-4 md:grid-cols-4">
                <input
                  value={newAirdropProto}
                  onChange={(e) => setNewAirdropProto(e.target.value)}
                  placeholder="Nama Protokol"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                />
                <input
                  value={newAirdropUrl}
                  onChange={(e) => setNewAirdropUrl(e.target.value)}
                  placeholder="https://docs... (URL resmi wajib)"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                />
                <input
                  value={newAirdropRisk}
                  onChange={(e) => setNewAirdropRisk(e.target.value)}
                  placeholder="Risiko: Sybil / lockup / gas"
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-white"
                />
                <button
                  onClick={() => {
                    if (!newAirdropProto.trim() || !newAirdropUrl.trim().startsWith('https://')) return;
                    setAirdrops((p) => [
                      {
                        id: `air_${Date.now()}`,
                        protocol: newAirdropProto.trim(),
                        officialUrl: newAirdropUrl.trim(),
                        sybilNote: newAirdropRisk.trim() || 'Sybil / lockup / gas / no allocation guarantee',
                        addedAt: new Date().toLocaleTimeString('id-ID', { hour12: false })
                      },
                      ...p
                    ]);
                    setNewAirdropProto('');
                    setNewAirdropUrl('');
                    setNewAirdropRisk('');
                  }}
                  className="flex items-center justify-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 font-extrabold text-slate-950"
                >
                  <Coins className="h-3.5 w-3.5" />
                  Catat Resmi
                </button>
              </div>

              {airdrops.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500">
                  Belum ada daftar airdrop. Zero fake listing — tambahkan hanya kampanye dengan sumber HTTPS resmi.
                </div>
              ) : (
                <div className="space-y-2">
                  {airdrops.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5"
                    >
                      <div>
                        <div className="font-bold text-amber-300">{a.protocol}</div>
                        <div className="font-mono text-[10px] text-sky-300">{a.officialUrl}</div>
                        <div className="text-[10px] text-slate-400">Risiko: {a.sybilNote}</div>
                      </div>
                      <button
                        onClick={() => setAirdrops((p) => p.filter((x) => x.id !== a.id))}
                        className="text-slate-500 hover:text-rose-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
