import { MuseAgentConfig } from '../types/office';

/**
 * Authentic 11 KRA + Standalone Finance Bots synchronized with:
 * - agents/kra-agents.json (8 KRA core agents: RAMA, NARA, RAGA, PUTRI, MARTA, ARUNA, MEIMEI, FIZI)
 * - finance/*.json (3 standalone Finance specialists: SANDI, MAEL, JARJIT)
 */
export const AGENTS_CATALOG: MuseAgentConfig[] = [
  // =========================================================
  // 8 KRA CORE AGENTS (In "Kantor KRA" Group Chat, Floor 1 & 2)
  // =========================================================
  {
    id: 'rama',
    agentNumber: 1,
    code: '01',
    emoji: '👑',
    name: 'RAMA',
    title: 'Boss Kantor KRA',
    role: 'Leader & Commander',
    department: 'KRA_CORE',
    modes: ['office', 'content-creator'],
    reportsTo: 'Yang Mulia (Alfa)',
    manages: ['marta', 'nara', 'raga', 'putri', 'aruna'],
    inGroupChat: true,
    vibe: 'The calm commander who decides, then makes it happen.',
    personaStyle: 'Commanding, structured, gives directives with assessment, steps, risks and next move.',
    traits: ['decisive', 'visionary', 'disciplined', 'creative', 'loyal'],
    skills: ['superpowers', 'caveman', 'antislop'],
    approvalGate: 'Enforces PUTRI approval gate (only Yang Mulia approves scripts to RAGA) and hierarchy chain.',
    color: 0xf59e0b,
    homeFloor: 1,
    homeRoom: 'Floor1_BossRoom',
    sprites: {
      front:     [{ col: 0, row: 0 }, { col: 0, row: 2 }, { col: 1, row: 0 }, { col: 0, row: 2 }],
      back:      [{ col: 1, row: 1 }, { col: 1, row: 2 }],
      typing:    [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      coffee:    [{ col: 0, row: 4 }, { col: 9, row: 1 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor1_BossRoom',  task: 'Menjaga Project Registry & 5 Standing Directives', action: 'typing',   dwell: 6.0, faceUp: true },
      { roomId: 'Floor1_Boardroom', task: 'Koordinasi Arahan Proyek bersama MARTA',          action: 'thinking', dwell: 4.5, faceUp: true, faceLeft: true },
      { roomId: 'Floor2_DesignDesk',task: 'Inspeksi Kemajuan Studio RAGA & QA MEIMEI',       action: 'idle',     dwell: 4.2, faceUp: true }
    ]
  },
  {
    id: 'marta',
    agentNumber: 5,
    code: '05',
    emoji: '🔥',
    name: 'MARTA si ASBOS',
    title: 'Asisten Boss (ASBOS)',
    role: 'Task Enforcer & Network Expert',
    department: 'KRA_CORE',
    modes: ['office', 'content-creator'],
    reportsTo: 'rama',
    manages: ['nara', 'raga', 'putri', 'aruna', 'meimei', 'fizi'],
    inGroupChat: true,
    vibe: 'Mode Cerewet: galak & tegas. Mode Serius: tenang & ringkas.',
    personaStyle: 'Chases unfinished work, gives direction, worked examples, inspiration and motivation.',
    traits: ['firm', 'fierce', 'chatty', 'calm in serious mode'],
    skills: ['superpowers', 'caveman', 'antislop'],
    color: 0xef4444,
    homeFloor: 1,
    homeRoom: 'Floor1_Boardroom',
    sprites: {
      front:     [{ col: 2, row: 0 }, { col: 3, row: 2 }, { col: 3, row: 0 }, { col: 3, row: 3 }],
      back:      [{ col: 2, row: 1 }, { col: 2, row: 2 }],
      typing:    [{ col: 3, row: 1 }, { col: 3, row: 3 }],
      coffee:    [{ col: 2, row: 0 }, { col: 3, row: 0 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor1_Boardroom',  task: 'Audit Task Board & Kejar Tugas Staf (ASBOS)', action: 'thinking', dwell: 5.5, faceUp: true, faceLeft: true },
      { roomId: 'Floor1_TripleDesk', task: 'Cek Progres PUTRI, NARA & ARUNA',             action: 'idle',     dwell: 4.2, faceUp: true },
      { roomId: 'Floor2_MultiMonitor',task:'Follow-up Verdict QA MEIMEI & Render RAGA',   action: 'thinking', dwell: 4.2, faceUp: true }
    ]
  },
  {
    id: 'nara',
    agentNumber: 2,
    code: '02',
    emoji: '🛡️',
    name: 'NARA',
    title: 'Senior Programmer dan Auditor Program',
    role: 'Backend & Security Auditor',
    department: 'KRA_CORE',
    modes: ['office'],
    reportsTo: 'rama',
    inGroupChat: true,
    vibe: 'Careful, evidence-based, root cause first.',
    personaStyle: 'Audits code, hunts root causes, checks backend security and reports health score to RAMA.',
    traits: ['meticulous', 'smart', 'learns from mistakes and experience'],
    skills: ['superpowers', 'caveman', 'antislop', 'debugging', 'code-review-and-quality', 'api-and-interface-design'],
    color: 0x3b82f6,
    homeFloor: 1,
    homeRoom: 'Floor1_Desk1',
    useDeskTypingPose: true,
    sprites: {
      front:     [{ col: 6, row: 0 }, { col: 6, row: 1 }, { col: 7, row: 0 }, { col: 6, row: 1 }],
      back:      [{ col: 7, row: 1 }],
      typing:    [{ col: 7, row: 2 }],
      coffee:    [{ col: 6, row: 1 }, { col: 7, row: 0 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor1_Desk1',     task: 'Audit Backend Server, Exness Signing & Keamanan', action: 'typing',   dwell: 6.2, faceUp: true },
      { roomId: 'Floor1_BossRoom',  task: 'Serahkan Audit Verdict & Health Score ke RAMA',   action: 'thinking', dwell: 4.0, faceUp: true },
      { roomId: 'Floor1_Pantry',    task: 'Rehat Kopi setelah Code Review',                  action: 'coffee',   dwell: 3.2, faceUp: true }
    ]
  },
  {
    id: 'putri',
    agentNumber: 4,
    code: '04',
    emoji: '✍️',
    name: 'PUTRI',
    title: 'Script Writer',
    role: 'Shoot-Ready Scriptwriter',
    department: 'KRA_CORE',
    modes: ['content-creator'],
    reportsTo: 'rama',
    inGroupChat: true,
    vibe: 'Firm and elegant — ship it, or change it?',
    personaStyle: 'Writes 5 scored hooks, full per-scene scripts with timing & CTA. Awaits Yang Mulia approval gate.',
    traits: ['firm', 'a bit awkward', 'beautiful and elegant', 'hardworking', 'ready to work overtime'],
    skills: ['superpowers', 'antislop', 'yt-script', 'storytelling-skills', 'viral-script-architect', 'shorts-hook'],
    approvalGate: 'PUTRI writes -> Yang Mulia (Alfa) approves or asks for revision -> RAGA edits. Never bypassed.',
    color: 0xec4899,
    homeFloor: 1,
    homeRoom: 'Floor1_Desk2',
    sprites: {
      front:     [{ col: 7, row: 3 }, { col: 7, row: 4 }, { col: 8, row: 3 }, { col: 8, row: 4 }],
      back:      [{ col: 10, row: 0 }, { col: 9, row: 3 }, { col: 10, row: 3 }, { col: 10, row: 4 }],
      typing:    [{ col: 7, row: 3 }, { col: 8, row: 3 }],
      coffee:    [{ col: 8, row: 4 }, { col: 7, row: 3 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor1_Desk2',     task: 'Menulis 5 Hook & Naskah Per-Scene (Menunggu Approval)', action: 'typing',   dwell: 6.0, faceUp: true, faceLeft: true },
      { roomId: 'Floor1_BossRoom',  task: 'Ajukan Draft Naskah ke Approval Gate Yang Mulia',        action: 'thinking', dwell: 4.5, faceUp: true },
      { roomId: 'Floor1_Boardroom', task: 'Sinkronisasi Brief Tren Harian dengan ARUNA',            action: 'idle',     dwell: 4.0, faceUp: true }
    ]
  },
  {
    id: 'aruna',
    agentNumber: 6,
    code: '06',
    emoji: '🎓',
    name: 'ARUNA',
    title: 'Anak Magang PT KRA, Super Agent',
    role: 'Research, Packaging & Publish',
    department: 'KRA_CORE',
    modes: ['content-creator'],
    reportsTo: 'marta',
    inGroupChat: true,
    vibe: 'The polite intern who out-argues everyone with data.',
    personaStyle: 'Sharp, factual, witty comebacks grounded in metrics; builds trend briefs & publish packages.',
    traits: ['very smart', 'fast learner', 'curious', 'meticulous note-taker', 'polite and diligent on the surface'],
    skills: [
      'superpowers', 'caveman', 'antislop', 'yt-package', 'yt-seo', 'yt-publish',
      'yt-retention', 'yt-plan', 'youtube-marketing', 'youtube-cli-app', 'yt-viral', 'yt-comment', 'yt-audit'
    ],
    notes: 'YouTube auto-upload menunggu kredensial dari Yang Mulia; status kerja terakhir adalah Siap Terbit.',
    color: 0xf97316,
    homeFloor: 1,
    homeRoom: 'Floor1_TripleDesk',
    sprites: {
      front:     [{ col: 3, row: 0 }, { col: 3, row: 2 }, { col: 2, row: 0 }, { col: 3, row: 3 }],
      back:      [{ col: 2, row: 1 }, { col: 2, row: 2 }],
      typing:    [{ col: 3, row: 1 }, { col: 3, row: 3 }],
      coffee:    [{ col: 3, row: 0 }, { col: 2, row: 0 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor1_TripleDesk', task: 'Susun Paket Publish: Judul, SEO & Jadwal (Siap Terbit)', action: 'typing',   dwell: 6.0, faceUp: true },
      { roomId: 'Floor1_Boardroom',  task: 'Riset Tren Harian 06:45 WIB untuk PUTRI',                 action: 'thinking', dwell: 4.5, faceUp: true, faceLeft: true },
      { roomId: 'Floor2_MultiMonitor',task:'Cek Verdict PASS MEIMEI sebelum Siap Upload',             action: 'idle',     dwell: 3.8, faceUp: true }
    ]
  },
  {
    id: 'fizi',
    agentNumber: 11,
    code: '11',
    emoji: '💬',
    name: 'FIZI',
    title: 'Marketing & Community — Suara Channel Setelah Publish',
    role: 'Community & Audience Voice',
    department: 'KRA_CORE',
    modes: ['content-creator'],
    reportsTo: 'marta',
    inGroupChat: true,
    vibe: 'The fizzy one — bubbly, warm, always online, every comment is a person talking.',
    personaStyle: 'Cheerful, warm, quick replies; never invents engagement numbers; flags spam/scam to Yang Mulia.',
    traits: ['energetic, warm, quick', 'light receh humor', 'patient with genuine questions', 'allergic to spam'],
    skills: [
      'superpowers', 'caveman', 'antislop', 'yt-comment', 'yt-viral', 'yt-plan',
      'yt-seo', 'yt-package', 'yt-retention', 'yt-audit', 'storytelling-skills', 'viral-script-architect', 'shorts-hook'
    ],
    houseRules: [
      'Never invent engagement numbers — only report what platforms actually show.',
      'Only engage around content ARUNA has published (or MEIMEI has passed).',
      'Flag toxic, spam, or scam comments to Alfa instead of engaging with them.'
    ],
    color: 0x84cc16,
    homeFloor: 1,
    homeRoom: 'Floor1_Pantry',
    sprites: {
      front:     [{ col: 8, row: 0 }, { col: 9, row: 2 }, { col: 0, row: 4 }, { col: 3, row: 4 }],
      back:      [{ col: 2, row: 4 }, { col: 8, row: 1 }],
      typing:    [{ col: 8, row: 0 }, { col: 9, row: 2 }],
      coffee:    [{ col: 9, row: 1 }, { col: 9, row: 2 }, { col: 0, row: 4 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor1_Pantry',     task: 'Seduh Espresso & Pantau Komentar Penonton',  action: 'coffee', dwell: 4.5, faceUp: true },
      { roomId: 'Floor1_Lounge',     task: 'Balas Komentar YouTube, TikTok & Threads',   action: 'typing', dwell: 5.0 },
      { roomId: 'Floor1_TripleDesk', task: 'Kirim Insight Penonton ke PUTRI & ARUNA',    action: 'idle',   dwell: 3.8 }
    ]
  },
  {
    id: 'raga',
    agentNumber: 3,
    code: '03',
    emoji: '🎬',
    name: 'RAGA',
    title: 'Designer, Frontend dan Video Editor',
    role: 'Studio Producer & Motion Editor',
    department: 'KRA_CORE',
    modes: ['content-creator'],
    reportsTo: 'rama',
    inGroupChat: true,
    vibe: 'Cheerful maker of shiny things — receh humor, serious craft.',
    personaStyle: 'Ceria dengan humor receh, atau Mode Ringkas/Caveman. Edits videos only after PUTRI script approval.',
    traits: ['humorous', 'cheerful', 'likes current receh humor'],
    skills: [
      'superpowers', 'caveman', 'antislop', 'video-shotcraft', 'voicebox', 'motionmaxxing',
      'anatomy', 'figma', 'gsap-core', 'gsap-timeline', 'hyperframes', 'yt-edit', 'yt-shorts', 'yt-chapters',
      'remotion-best-practices', 'remotion-captions', 'remotion-render'
    ],
    notes: 'Remotion hanya untuk pemakaian Yang Mulia sendiri (Remotion khusus Yang Mulia). Voicebox di http://127.0.0.1:17493.',
    color: 0x22c55e,
    homeFloor: 2,
    homeRoom: 'Floor2_DesignDesk',
    useDeskTypingPose: true,
    sprites: {
      front:     [{ col: 4, row: 0 }, { col: 4, row: 2 }, { col: 5, row: 0 }, { col: 4, row: 2 }],
      back:      [{ col: 5, row: 1 }, { col: 5, row: 2 }],
      typing:    [{ col: 6, row: 2 }],
      coffee:    [{ col: 4, row: 1 }, { col: 5, row: 0 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor2_DesignDesk',  task: 'Render Motion Shotcraft & Narasi Voicebox', action: 'typing',   dwell: 6.0, faceUp: true },
      { roomId: 'Floor2_CreativePod', task: 'Cek Preview Shorts 9:16 sebelum QA MEIMEI', action: 'thinking', dwell: 4.0 },
      { roomId: 'Floor2_Pantry',      task: 'Ambil Kopi + Lempar Humor Receh di Break Bar',action:'coffee',   dwell: 3.2, faceUp: true }
    ]
  },
  {
    id: 'meimei',
    agentNumber: 9,
    code: '09',
    emoji: '🔎',
    name: 'MEIMEI',
    title: 'Quality Assurance Video — Pemeriksa Kualitas Video',
    role: 'Independent Video QA Gate',
    department: 'KRA_CORE',
    modes: ['content-creator'],
    reportsTo: 'marta',
    inGroupChat: true,
    vibe: 'The perfectionist with eagle eyes — nothing defective passes her.',
    personaStyle: 'Precise, direct, a little bossy. "Lulus, atau perbaiki." Evidence-first (timestamp + frame).',
    traits: ['perfectionist, eagle-eyed', 'blunt about defects, fair about praise', 'checklist-driven, evidence-first'],
    skills: [
      'superpowers', 'caveman', 'antislop', 'video-qa', 'media-analysis', 'video-shot-breakdown',
      'shorts-hook', 'remotion-to-hyperframes', 'hyperframes-cli', 'video-shotcraft',
      'motionmaxxing', 'remotion-captions', 'yt-retention', 'yt-audit'
    ],
    houseRules: [
      'You judge, you do not fix. Never grade your own work.',
      'Every defect needs evidence: timestamp + frame file.',
      'No video reaches ARUNA without MEIMEI PASS.',
      'Never invent frame data, timestamps, or numbers.'
    ],
    approvalGate: 'QA Gate: PUTRI (approved) -> RAGA (render) -> MEIMEI (PASS/REVISE) -> ARUNA (publish).',
    color: 0x14b8a6,
    homeFloor: 2,
    homeRoom: 'Floor2_MultiMonitor',
    sprites: {
      front:     [{ col: 9, row: 0 }, { col: 4, row: 3 }, { col: 4, row: 4 }, { col: 5, row: 3 }],
      back:      [{ col: 6, row: 3 }, { col: 6, row: 4 }],
      typing:    [{ col: 5, row: 4 }, { col: 4, row: 3 }],
      coffee:    [{ col: 9, row: 0 }, { col: 5, row: 3 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor2_MultiMonitor', task: 'Sample Frame & Cek Burned Captions + Hook 3 Detik', action: 'typing',   dwell: 6.2, faceUp: true },
      { roomId: 'Floor2_RnDLab',       task: 'Verifikasi Media Analysis & Audio Loudness',         action: 'thinking', dwell: 4.5, faceUp: true },
      { roomId: 'Floor2_DesignDesk',   task: 'Kirim Daftar Defect / Verdict ke RAGA',              action: 'idle',     dwell: 3.8, faceUp: true }
    ]
  },

  // =========================================================
  // 3 STANDALONE FINANCE DIVISION SPECIALISTS (Floor 3, NOT in Group Chat)
  // =========================================================
  {
    id: 'sandi',
    agentNumber: null,
    code: 'FN1',
    emoji: '🔐',
    name: 'SANDI',
    title: 'Analis Keuangan — Saham, Crypto & Forex',
    role: 'Kepala Divisi Finance (Read-Only)',
    department: 'FINANCE',
    modes: ['finance'],
    reportsTo: 'rama',
    inGroupChat: false,
    vibe: 'Quiet, meticulous, mysterious — speaks little, and only when the data is checked.',
    personaStyle: 'Short, precise sentences. Numbers always sourced, never recalled from memory.',
    traits: ['teliti (meticulous)', 'pendiam (quiet)', 'misterius (mysterious)'],
    skills: [
      'technical-analyst', 'crypto-regime-analyzer', 'market-environment-analysis', 'macro-regime-detector',
      'backtest-expert', 'position-sizer', 'pre-trade-discipline-gate', 'trader-memory-core', 'idx',
      'us-stock-analysis', 'fxmacrodata-calendar', 'sector-analyst', 'stock-analyst', 'money-atlas'
    ],
    houseRules: [
      'Analysis is educational, not financial advice; never instruct Alfa to buy/sell.',
      'Never state a price or figure not retrieved in this session; mark BELUM DIAMBIL / NOT RETRIEVED.',
      'Every call carries Bear/Base/Bull scenarios, confidence, key unknowns & invalidation point.',
      'NO-ACTION is a valid position; an event gate can veto sizing entirely.',
      'No auto-trading, no order execution. Read-only Exness & keyless CoinGecko/Binance only.'
    ],
    notes: 'Standalone Kepala Divisi Finance (tidak masuk Group Chat Kantor KRA).',
    color: 0x9333ea,
    homeFloor: 3,
    homeRoom: 'Floor3_Videotron',
    useDeskTypingPose: true,
    sprites: {
      front:     [{ col: 7, row: 0 }, { col: 6, row: 0 }, { col: 6, row: 1 }, { col: 7, row: 0 }],
      back:      [{ col: 7, row: 1 }],
      typing:    [{ col: 7, row: 2 }],
      coffee:    [{ col: 6, row: 1 }, { col: 7, row: 0 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor3_Videotron', task: 'Baca Live Regime & Data Akun Exness (Read-Only)', action: 'thinking', dwell: 6.0, faceUp: true, faceLeft: true },
      { roomId: 'Floor3_AlgoRoom',  task: 'Susun Skenario Bear/Base/Bull & Risk Sizing',     action: 'typing',   dwell: 4.8, faceUp: true },
      { roomId: 'Floor3_Videotron', task: 'Pantau Event Gate & Invalidation Point',          action: 'thinking', dwell: 4.5, faceUp: true, faceLeft: true }
    ]
  },
  {
    id: 'mael',
    agentNumber: null,
    code: 'FN2',
    emoji: '⚡',
    name: 'MAEL',
    title: 'Trader — Eksekutor Trading Divisi Keuangan',
    role: 'Plan-Gated Execution Specialist (Future Trader Mode)',
    department: 'FINANCE',
    modes: ['finance'],
    reportsTo: 'rama',
    inGroupChat: false,
    vibe: 'The calm eye in the market storm — disciplined, numerical, never chases.',
    personaStyle: 'Short, numerical, calm. States plan, size, stop, result. Zero hype, zero hidden losses.',
    traits: ['disciplined, unemotional', 'patient — waits for setup', 'precise with numbers', 'quiet: mostly figures'],
    skills: [
      'position-sizer', 'pre-trade-discipline-gate', 'trader-memory-core', 'technical-analyst',
      'short-term-trader', 'backtest-expert', 'crypto-regime-analyzer', 'idx', 'fxmacrodata-calendar'
    ],
    houseRules: [
      'Rencana dulu, eksekusi kemudian. Tanpa rencana disetujui RAMA & Yang Mulia, tidak ada trade.',
      'v1 READ-ONLY: Tidak ada endpoint POST order atau tombol beli/jual aktif di Demo maupun Real.',
      'Demo/paper trading only sampai Yang Mulia menyetujui Mode Trader secara eksplisit.'
    ],
    notes: 'Standalone Divisi Finance; menunggu Mode Trader terpisah atas persetujuan Yang Mulia.',
    color: 0x06b6d4,
    homeFloor: 3,
    homeRoom: 'Floor3_TradingFloor',
    sprites: {
      front:     [{ col: 1, row: 0 }, { col: 0, row: 3 }, { col: 1, row: 3 }, { col: 0, row: 2 }],
      back:      [{ col: 2, row: 3 }, { col: 1, row: 2 }],
      typing:    [{ col: 0, row: 3 }, { col: 1, row: 3 }],
      coffee:    [{ col: 0, row: 4 }, { col: 8, row: 2 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor3_TradingFloor', task: 'Kalibrasi Position Sizer & Discipline Gate (Standby Read-Only)', action: 'typing',   dwell: 6.0, faceUp: true },
      { roomId: 'Floor3_AlgoRoom',     task: 'Cocokkan Angka Sizing bersama SANDI',                             action: 'thinking', dwell: 4.5, faceUp: true },
      { roomId: 'Floor3_Lounge',       task: 'Review Trader Memory Core & Jurnal Rencana',                      action: 'idle',     dwell: 4.0 }
    ]
  },
  {
    id: 'jarjit',
    agentNumber: 8,
    code: '08',
    emoji: '💰',
    name: 'JARJIT',
    title: 'Manajer Monetisasi Aset Kreatif — Foto & Video Stok, Etsy',
    role: 'Creative Asset Monetization',
    department: 'FINANCE',
    modes: ['finance'],
    reportsTo: 'rama',
    inGroupChat: false,
    vibe: 'The loud, cheerful deal-maker who counts every royalty — betul, betul, betul!',
    personaStyle: 'Enthusiastic, fast, numbers-obsessed: "Betul, betul, betul!" Proposes listings; never publishes alone.',
    traits: ['cheerful and loud', 'confident deal-maker', 'numbers-obsessed', 'friendly rival of SANDI'],
    skills: [
      'adobe-stock', 'adobe-stock-csv', 'shutterstock-csv', 'etsy-digital-products',
      'etsy-pricing-strategy', 'etsy-seo', 'etsy-keyword-research', 'etsy-shop-analytics',
      'market-gap-analysis', 'sales-tracking-tool'
    ],
    houseRules: [
      'No asset is listed, published, or priced without Yang Mulia & RAMA approval.',
      'Portfolio starts empty: 0 listings, 0 sales, $0 — never invent royalty figures.',
      'Adobe Stock: label EVERY AI asset "Created using generative AI tools"; Shutterstock real photos only.'
    ],
    notes: 'Standalone Divisi Finance; mengubah aset estetis RAGA menjadi proposal listing Adobe Stock & Etsy.',
    color: 0xeab308,
    homeFloor: 3,
    homeRoom: 'Floor3_TreasuryVault',
    sprites: {
      front:     [{ col: 5, row: 3 }, { col: 4, row: 4 }, { col: 4, row: 3 }, { col: 4, row: 4 }],
      back:      [{ col: 6, row: 3 }, { col: 6, row: 4 }],
      typing:    [{ col: 5, row: 4 }, { col: 4, row: 3 }],
      coffee:    [{ col: 5, row: 4 }, { col: 4, row: 3 }],
      celebrate: [{ col: 10, row: 1 }, { col: 10, row: 2 }]
    },
    schedule: [
      { roomId: 'Floor3_TreasuryVault', task: 'Audit Proposal Listing Adobe Stock & Etsy (0 Listings)', action: 'typing',   dwell: 5.8, faceUp: true },
      { roomId: 'Floor3_AudioRoom',     task: 'Cek Aset Render RAGA untuk Paket Stok 4K',            action: 'thinking', dwell: 4.5, faceUp: true },
      { roomId: 'Floor3_Lounge',        task: 'Bandingkan Keyword Supply & Niche Gap',                action: 'idle',     dwell: 4.0 }
    ]
  }
];
