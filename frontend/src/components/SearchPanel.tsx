import { useState } from "react";

export interface SearchFormValues {
  bbox: [number, number, number, number]; // minLon, minLat, maxLon, maxLat
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  useS1: boolean;
  useS2: boolean;
  maxCloudCover: number; // 0-100
}

interface Props {
  onSubmit: (values: SearchFormValues) => void;
  loading: boolean;
}

// 事前定義 AOI プリセット
const AOI_PRESETS: { label: string; bbox: [number, number, number, number] }[] = [
  { label: "三亜〜尖閣（回廊全域）", bbox: [109, 18, 124, 27] },
  { label: "尖閣諸島",               bbox: [123, 25, 124.5, 26.5] },
  { label: "台湾海峡",               bbox: [118, 23, 122, 26] },
  { label: "福州周辺",               bbox: [118.5, 25.5, 120.5, 26.5] },
  { label: "三亜周辺",               bbox: [109, 18, 110.5, 19] },
  { label: "現在のAOI（手動入力）",   bbox: [0, 0, 0, 0] },
];

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 4, display: "block",
};
const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "6px 8px", background: "#1e293b",
  border: "1px solid rgba(148,163,184,0.25)", borderRadius: 5,
  color: "#ffffff", fontSize: 13, outline: "none",
};

export function SearchPanel({ onSubmit, loading }: Props) {
  // 過去14日をデフォルト
  const today = new Date();
  const twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(today.getDate() - 14);
  const toYMD = (d: Date) => d.toISOString().slice(0, 10);

  const [preset, setPreset] = useState<number>(0); // index into AOI_PRESETS
  const [bbox, setBbox] = useState<[number, number, number, number]>(AOI_PRESETS[0].bbox);
  const [startDate, setStartDate] = useState<string>(toYMD(twoWeeksAgo));
  const [endDate, setEndDate] = useState<string>(toYMD(today));
  const [useS1, setUseS1] = useState(true);
  const [useS2, setUseS2] = useState(true);
  const [maxCloudCover, setMaxCloudCover] = useState(40);

  const changePreset = (idx: number) => {
    setPreset(idx);
    if (AOI_PRESETS[idx].bbox.some((v) => v !== 0)) {
      setBbox(AOI_PRESETS[idx].bbox);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ bbox, startDate, endDate, useS1, useS2, maxCloudCover });
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label style={labelStyle}>AOI プリセット</label>
        <select
          value={preset}
          onChange={(e) => changePreset(Number(e.target.value))}
          style={inputStyle}
        >
          {AOI_PRESETS.map((p, i) => (
            <option key={i} value={i}>{p.label}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <label style={labelStyle}>minLon</label>
          <input type="number" step="0.01" value={bbox[0]}
            onChange={(e) => setBbox([Number(e.target.value), bbox[1], bbox[2], bbox[3]])}
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>minLat</label>
          <input type="number" step="0.01" value={bbox[1]}
            onChange={(e) => setBbox([bbox[0], Number(e.target.value), bbox[2], bbox[3]])}
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>maxLon</label>
          <input type="number" step="0.01" value={bbox[2]}
            onChange={(e) => setBbox([bbox[0], bbox[1], Number(e.target.value), bbox[3]])}
            style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>maxLat</label>
          <input type="number" step="0.01" value={bbox[3]}
            onChange={(e) => setBbox([bbox[0], bbox[1], bbox[2], Number(e.target.value)])}
            style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div>
          <label style={labelStyle}>開始日</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>終了日</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>衛星</label>
        <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#fca5a5" }}>
            <input type="checkbox" checked={useS1} onChange={(e) => setUseS1(e.target.checked)} />
            <span>Sentinel-1 (SAR)</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: "#7dd3fc" }}>
            <input type="checkbox" checked={useS2} onChange={(e) => setUseS2(e.target.checked)} />
            <span>Sentinel-2 (光学)</span>
          </label>
        </div>
      </div>

      {useS2 && (
        <div>
          <label style={labelStyle}>最大雲率: {maxCloudCover}%</label>
          <input type="range" min={0} max={100} value={maxCloudCover}
            onChange={(e) => setMaxCloudCover(Number(e.target.value))}
            style={{ width: "100%" }} />
        </div>
      )}

      <button type="submit" disabled={loading || (!useS1 && !useS2)} style={{
        marginTop: 4, padding: "8px 0",
        background: loading ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.35)",
        border: "1px solid rgba(99,102,241,0.6)",
        borderRadius: 6, color: "#e0e7ff",
        fontSize: 14, fontWeight: 700, letterSpacing: "0.04em",
        cursor: loading ? "not-allowed" : "pointer",
      }}>
        {loading ? "検索中..." : "検索"}
      </button>
    </form>
  );
}
