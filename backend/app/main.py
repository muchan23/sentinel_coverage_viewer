"""FastAPI entry point for sentinel_coverage_viewer.

/api/coverage  : CDSE STAC を検索し、フットプリントを GeoJSON で返す
/api/health    : 生存確認
"""
from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .cdse import cdse_client, CDSEClientError
from .config import settings


app = FastAPI(title="Sentinel Coverage Viewer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


COLLECTION_SENSOR = {
    "sentinel-1-grd": "S1",
    "sentinel-2-l2a": "S2",
}


def _feature_to_geojson(feature: dict[str, Any], sensor: str) -> dict[str, Any] | None:
    """STAC feature を簡素化した GeoJSON Feature に変換。

    元の geometry をそのまま使いつつ、properties は表示に必要なものだけに絞る。
    """
    geom = feature.get("geometry")
    if not geom:
        return None
    props = feature.get("properties", {}) or {}
    dt = props.get("datetime", "")
    cc = props.get("eo:cloud_cover")
    return {
        "type": "Feature",
        "id": feature.get("id"),
        "geometry": geom,
        "properties": {
            "id": feature.get("id"),
            "sensor": sensor,
            "datetime": dt,
            "date": dt[:10] if dt else "",
            "cloud_cover": cc,
            "platform": props.get("platform"),
            "product_type": props.get("product:type") or props.get("productType"),
            "collection": feature.get("collection"),
        },
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok"}


@app.get("/api/coverage")
def coverage(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat"),
    start: str = Query(..., description="ISO8601 start datetime"),
    end: str = Query(..., description="ISO8601 end datetime"),
    collection: str = Query(..., description="sentinel-1-grd or sentinel-2-l2a"),
    max_cloud_cover: float | None = Query(
        None, ge=0, le=100, description="S2 のみ。この値以下のシーンに絞る"
    ),
    limit: int = Query(500, ge=1, le=2000),
) -> dict[str, Any]:
    # bbox パース
    try:
        parts = [float(x) for x in bbox.split(",")]
        if len(parts) != 4:
            raise ValueError
        bbox_tuple = (parts[0], parts[1], parts[2], parts[3])
    except ValueError:
        raise HTTPException(400, "bbox は 'minLon,minLat,maxLon,maxLat' の形式で指定してください")

    if collection not in COLLECTION_SENSOR:
        raise HTTPException(400, f"未対応の collection: {collection}")

    try:
        features = cdse_client.search(bbox_tuple, start, end, collection, limit=limit)
    except CDSEClientError as exc:
        raise HTTPException(502, str(exc))

    sensor = COLLECTION_SENSOR[collection]
    out: list[dict[str, Any]] = []
    for f in features:
        conv = _feature_to_geojson(f, sensor)
        if conv is None:
            continue
        if max_cloud_cover is not None and sensor == "S2":
            cc = conv["properties"].get("cloud_cover")
            if cc is None or cc > max_cloud_cover:
                continue
        out.append(conv)

    return {
        "type": "FeatureCollection",
        "features": out,
        "meta": {
            "count": len(out),
            "raw_count": len(features),
            "bbox": list(bbox_tuple),
            "start": start,
            "end": end,
            "collection": collection,
            "sensor": sensor,
            "max_cloud_cover": max_cloud_cover,
        },
    }
