import { useMemo, useState } from "react";
import type { CoverageFeature } from "../services/api";

interface Props {
  dates: string[];
  selected: string | null;
  onSelect: (date: string | null) => void;
  features: CoverageFeature[];
}

export function TimelineSlider({ dates, selected, onSelect, features }: Props) {
  const [playing, setPlaying] = useState(false);

  // 日付ごとのシーン数（S1 / S2 別）
  const dateCounts = useMemo(() => {
    const m = new Map<string, { s1: number; s2: number }>();
    for (const f of features) {
      const d = f.properties.date;
      if (!m.has(d)) m.set(d, { s1: 0, s2: 0 });
      const entry = m.get(d)!;
      if (f.properties.sensor === "S1") entry.s1 += 1;
      else entry.s2 += 1;
    }
    return m;
  }, [features]);

  // 再生ロジック
  useMemo(() => {
    if (!playing) return;
    const idx = selected ? dates.indexOf(selected) : -1;
    const next = idx + 1 < dates.length ? dates[idx + 1] : null;
    const t = setTimeout(() => {
      if (next === null) {
        setPlaying(false);
        onSelect(null);
      } else {
        onSelect(next);
      }
    }, 700);
    return () => clearTimeout(t);
  }, [playing, selected, dates, onSelect]);

  const currentIdx = selected ? dates.indexOf(selected) : -1;

  return (
    <div style={{
      position: "absolute", zIndex: 10,
      bottom: 16, left: "50%", transform: "translateX(-50%)",
      width: "min(900px, calc(100% - 380px - 32px))",
      background: "rgba(15, 23, 42, 0.92)",
      border: "1px solid rgba(148, 163, 184, 0.2)",
      borderRadius: 10, padding: "10px 14px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    }}>
      {/* ヘッダ */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button onClick={() => {
          if (dates.length === 0) return;
          if (!selected) onSelect(dates[0]);
          setPlaying((p) => !p);
        }} style={{
          padding: "4px 12px",
          background: playing ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.3)",
          border: "1px solid rgba(148,163,184,0.3)",
          borderRadius: 5, color: "#e0e7ff",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          {playing ? "■ 停止" : "▶ 再生"}
        </button>
        <div style={{ fontSize: 13, color: "#cbd5e1", flex: 1 }}>
          {selected ? (
            <>
              <b>{selected}</b>
              <span style={{ color: "#94a3b8", marginLeft: 8 }}>
                S1: {dateCounts.get(selected)?.s1 ?? 0}
                {" / "}
                S2: {dateCounts.get(selected)?.s2 ?? 0}
              </span>
            </>
          ) : (
            <span style={{ color: "#94a3b8" }}>全期間表示中（{dates.length}日）</span>
          )}
        </div>
        <button onClick={() => onSelect(null)} style={{
          padding: "3px 10px",
          background: "transparent",
          border: "1px solid rgba(148,163,184,0.3)",
          borderRadius: 5, color: "#94a3b8",
          fontSize: 12, cursor: "pointer",
        }}>
          全日表示
        </button>
      </div>

      {/* タイムラインバー */}
      <div style={{
        position: "relative", height: 40,
        background: "rgba(0,0,0,0.3)", borderRadius: 5,
        padding: "4px 6px",
      }}>
        <div style={{ display: "flex", height: "100%", gap: 2 }}>
          {dates.map((d, i) => {
            const counts = dateCounts.get(d) ?? { s1: 0, s2: 0 };
            const total = counts.s1 + counts.s2;
            const isSelected = i === currentIdx;
            return (
              <div key={d} onClick={() => onSelect(d)}
                title={`${d} / S1:${counts.s1} S2:${counts.s2}`}
                style={{
                  flex: 1, display: "flex", flexDirection: "column",
                  justifyContent: "flex-end", gap: 1,
                  cursor: "pointer", position: "relative",
                  background: isSelected ? "rgba(99,102,241,0.2)" : "transparent",
                  borderRadius: 3, border: isSelected
                    ? "1px solid rgba(165,180,252,0.6)" : "1px solid transparent",
                }}
              >
                {/* S2バー (シアン) */}
                {counts.s2 > 0 && (
                  <div style={{
                    height: `${Math.min(counts.s2 * 6, 20)}px`,
                    background: "#22d3ee", borderRadius: 2, opacity: 0.85,
                  }} />
                )}
                {/* S1バー (赤) */}
                {counts.s1 > 0 && (
                  <div style={{
                    height: `${Math.min(counts.s1 * 6, 20)}px`,
                    background: "#f87171", borderRadius: 2, opacity: 0.85,
                  }} />
                )}
                {/* 件数なしならごく薄いバー */}
                {total === 0 && (
                  <div style={{ height: 4, background: "rgba(148,163,184,0.15)", borderRadius: 2 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 日付ラベル（両端・中央） */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 11, color: "#94a3b8", marginTop: 4,
      }}>
        <span>{dates[0]}</span>
        {dates.length > 2 && (
          <span>{dates[Math.floor(dates.length / 2)]}</span>
        )}
        <span>{dates[dates.length - 1]}</span>
      </div>
    </div>
  );
}
