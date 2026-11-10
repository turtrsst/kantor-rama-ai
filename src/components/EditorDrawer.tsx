import React, { useMemo, useState } from 'react';
import { Check, Copy, FlipHorizontal2, RotateCcw, Trash2, X } from 'lucide-react';
import { FurnitureCatalogItem } from '../game/OfficeEngine';
import { WallPieceCatalog } from '../game/spriteLoader';

type TabFilter = 'ALL' | 'OFFICE' | 'PANTRY & LOUNGE' | 'LAB & SERVER' | 'PET & DECOR' | 'TILES' | 'WALLS';

interface EditorDrawerProps {
  open: boolean;
  onClose: () => void;
  furnitureCatalog: FurnitureCatalogItem[];
  wallCatalog: WallPieceCatalog[];
  selectedItemId: string | null;
  onSelectFurniture: (item: FurnitureCatalogItem | null) => void;
  onSelectWall: (piece: WallPieceCatalog | null) => void;
  selectionHint: string;
  hasPlacedSelection: boolean;
  onFlip: () => void;
  onDelete: () => void;
  onCopyJson: () => string;
  onResetDefault: () => void;
}

export const EditorDrawer: React.FC<EditorDrawerProps> = ({
  open,
  onClose,
  furnitureCatalog,
  wallCatalog,
  selectedItemId,
  onSelectFurniture,
  onSelectWall,
  selectionHint,
  hasPlacedSelection,
  onFlip,
  onDelete,
  onCopyJson,
  onResetDefault
}) => {
  const [tab, setTab] = useState<TabFilter>('ALL');
  const [copied, setCopied] = useState(false);

  const filteredFurniture = useMemo(() => {
    if (tab === 'WALLS') return [];
    if (tab === 'ALL') return furnitureCatalog;
    return furnitureCatalog.filter((item) => item.category === tab);
  }, [furnitureCatalog, tab]);

  if (!open) return null;

  const handleCopy = () => {
    const raw = onCopyJson();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(raw).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside className="fixed bottom-16 left-4 top-16 z-30 flex w-72 flex-col overflow-hidden rounded-2xl border border-emerald-400/35 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5">
        <div>
          <h3 className="text-xs font-extrabold tracking-wide text-emerald-400">
            MODULAR STUDIO EDITOR
          </h3>
          <p className="text-[10px] text-slate-400">
            Furnitur, Tiles &amp; {wallCatalog.length} Dinding Cutaway
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1 border-b border-slate-800 px-3 py-2">
        {([
          { id: 'ALL' as TabFilter, label: 'All' },
          { id: 'OFFICE' as TabFilter, label: 'Office' },
          { id: 'PANTRY & LOUNGE' as TabFilter, label: 'Pantry' },
          { id: 'LAB & SERVER' as TabFilter, label: 'Lab' },
          { id: 'PET & DECOR' as TabFilter, label: 'Pet' },
          { id: 'TILES' as TabFilter, label: 'Tiles' },
          { id: 'WALLS' as TabFilter, label: `Walls (${wallCatalog.length})` }
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
              tab === t.id
                ? 'bg-emerald-400 text-slate-950'
                : 'border border-slate-700 bg-slate-800/70 text-slate-300 hover:border-emerald-400/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-3">
        {tab !== 'WALLS' &&
          filteredFurniture.map((item) => {
            const thumbSrc = (item.frames[0]?.image as HTMLCanvasElement | undefined)?.toDataURL?.() ?? '';
            const active = selectedItemId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectFurniture(active ? null : item)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                  active
                    ? 'border-emerald-400 bg-emerald-500/15 shadow-inner'
                    : 'border-slate-800 bg-slate-950/60 hover:border-emerald-400/50'
                }`}
              >
                {thumbSrc ? (
                  <img
                    src={thumbSrc}
                    alt={item.name}
                    className="h-12 w-full object-contain"
                  />
                ) : (
                  <div className="h-12 w-full rounded bg-slate-800" />
                )}
                <span className="line-clamp-1 text-[10px] font-semibold text-slate-200">
                  {item.name}
                </span>
              </button>
            );
          })}

        {(tab === 'WALLS' || tab === 'ALL') &&
          wallCatalog.map((piece) => {
            const thumbSrc = (piece.texture?.image as HTMLCanvasElement | undefined)?.toDataURL?.() ?? '';
            const active = selectedItemId === piece.id;
            return (
              <button
                key={piece.id}
                onClick={() => onSelectWall(active ? null : piece)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                  active
                    ? 'border-sky-400 bg-sky-500/15 shadow-inner'
                    : 'border-slate-800 bg-slate-950/60 hover:border-sky-400/50'
                }`}
              >
                {thumbSrc ? (
                  <img
                    src={thumbSrc}
                    alt={piece.name}
                    className="h-12 w-full object-contain"
                  />
                ) : (
                  <div className="h-12 w-full rounded bg-slate-800" />
                )}
                <span className="line-clamp-1 text-[10px] font-semibold text-sky-200">
                  {piece.name}
                </span>
              </button>
            );
          })}
      </div>

      {/* Footer Actions */}
      <div className="space-y-2 border-t border-slate-800 bg-slate-950/90 p-3">
        <div className="min-h-[26px] text-[10px] leading-snug text-emerald-300">
          {selectionHint}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={onFlip}
            className="flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            Flip (R)
          </button>
          <button
            onClick={onDelete}
            disabled={!hasPlacedSelection}
            className="flex items-center justify-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/15 px-2 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus (Del)
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1 rounded-lg bg-emerald-400 px-2 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-300"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Tersalin!' : 'Copy JSON'}
          </button>
          <button
            onClick={onResetDefault}
            className="flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Default
          </button>
        </div>
      </div>
    </aside>
  );
};
