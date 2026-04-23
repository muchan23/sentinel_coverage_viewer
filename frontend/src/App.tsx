import { useCallback, useMemo, useState } from "react";
import { CoverageGlobe } from "./components/CoverageGlobe";
import { SearchPanel, type SearchFormValues } from "./components/SearchPanel";
import { TimelineSlider } from "./components/TimelineSlider";
import { fetchCoverage, type CoverageFeature } from "./services/api";

export function App() {
  const [features, setFeatures] = useState<CoverageFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ count: number; rawCount: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const runSearch = useCallback(async (form: SearchFormValues) => {
    setLoading(true);
    setError(null);
    setFeatures([]);
    setMeta(null);
    setSelectedDate(null);

    const bbox = form.bbox;
    const start = new Date(form.startDate + "T00:00:00Z").toISOString();
    const end = new Date(form.endDate + "T23:59:59Z").toISOString();

    try {
      const requests: Promise<CoverageFeature[]>[] = [];
      if (form.useS1) {
        requests.push(
          fetchCoverage({ bbox, start, end, collection: "sentinel-1-grd" }).then((r) => r.features),
        );
      }
      if (form.useS2) {
        requests.push(
          fetchCoverage({
            bbox, start, end,
            collection: "sentinel-2-l2a",
            max_cloud_cover: form.maxCloudCover,
          }).then((r) => r.features),
        );
      }
      const results = await Promise.all(requests);
      const all = results.flat();
      setFeatures(all);
      setMeta({ count: all.length, rawCount: all.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : "検索エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  // 選択日でフィルタ
  const displayedFeatures = useMemo(() => {
    if (!selectedDate) return features;
    return features.filter((f) => f.properties.date === selectedDate);
  }, [features, selectedDate]);

  // 日付一覧
  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const f of features) {
      if (f.properties.date) set.add(f.properties.date);
    }
    return Array.from(set).sort();
  }, [features]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <CoverageGlobe features={displayedFeatures} />

      {/* 左: 検索パネル */}
      <div style={{
        position: "absolute", zIndex: 10,
        top: 16, left: 16, width: 340,
        background: "rgba(15, 23, 42, 0.92)",
        border: "1px solid rgba(148, 163, 184, 0.2)",
        borderRadius: 10, padding: "14px 14px",
        maxHeight: "calc(100vh - 32px)", overflowY: "auto",
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: "#ffffff" }}>
          Sentinel カバレッジ検索
        </div>
        <SearchPanel onSubmit={runSearch} loading={loading} />

        {error && (
          <div style={{ marginTop: 10, padding: "8px 10px",
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 6, color: "#fca5a5", fontSize: 13, lineHeight: 1.5 }}>
            {error}
          </div>
        )}

        {meta && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#94a3b8" }}>
            {meta.count} シーン
            {selectedDate && ` (${selectedDate} に絞込中 / 全${availableDates.length}日)`}
          </div>
        )}
      </div>

      {/* 下: タイムライン */}
      {availableDates.length > 0 && (
        <TimelineSlider
          dates={availableDates}
          selected={selectedDate}
          onSelect={setSelectedDate}
          features={features}
        />
      )}
    </div>
  );
}
