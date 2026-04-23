export type CoverageSensor = "S1" | "S2";

export interface CoverageFeature {
  type: "Feature";
  id: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties: {
    id: string;
    sensor: CoverageSensor;
    datetime: string;
    date: string;
    cloud_cover: number | null;
    platform: string | null;
    product_type: string | null;
    collection: string | null;
  };
}

export interface CoverageResponse {
  type: "FeatureCollection";
  features: CoverageFeature[];
  meta: {
    count: number;
    raw_count: number;
    bbox: number[];
    start: string;
    end: string;
    collection: string;
    sensor: CoverageSensor;
    max_cloud_cover: number | null;
  };
}

export interface CoverageQuery {
  bbox: [number, number, number, number];
  start: string; // ISO
  end: string; // ISO
  collection: "sentinel-1-grd" | "sentinel-2-l2a";
  max_cloud_cover?: number;
  limit?: number;
}

export async function fetchCoverage(q: CoverageQuery): Promise<CoverageResponse> {
  const params = new URLSearchParams({
    bbox: q.bbox.join(","),
    start: q.start,
    end: q.end,
    collection: q.collection,
  });
  if (q.max_cloud_cover !== undefined) params.set("max_cloud_cover", String(q.max_cloud_cover));
  if (q.limit !== undefined) params.set("limit", String(q.limit));

  const res = await fetch(`/api/coverage?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`coverage request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}
