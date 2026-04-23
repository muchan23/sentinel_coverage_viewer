"""CDSE STAC client (search-only, no download)."""
from __future__ import annotations

import time
from typing import Any

import httpx

from .config import settings


class CDSEClientError(RuntimeError):
    """CDSE 関連の失敗で投げる例外。"""


class CDSEClient:
    """Search-only CDSE STAC client.

    - OAuth トークンをメモリキャッシュ（expires_in の 90% を有効期間として使う）
    - /search エンドポイントに GET で問い合わせ、そのまま STAC features を返す
    """

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expires_at: float = 0.0  # epoch seconds

    # ─── OAuth ────────────────────────────────────────────────────────────────

    def _fetch_token(self) -> str:
        if not settings.CDSE_USERNAME or not settings.CDSE_PASSWORD:
            raise CDSEClientError("CDSE_USERNAME / CDSE_PASSWORD が .env に設定されていません")

        data = {
            "grant_type": "password",
            "client_id": settings.CDSE_CLIENT_ID,
            "username": settings.CDSE_USERNAME,
            "password": settings.CDSE_PASSWORD,
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                r = client.post(settings.CDSE_TOKEN_URL, data=data)
                r.raise_for_status()
        except httpx.HTTPError as exc:
            raise CDSEClientError(f"CDSE トークン取得失敗: {exc}") from exc

        payload = r.json()
        token = payload.get("access_token")
        if not token:
            raise CDSEClientError("access_token がレスポンスに含まれていません")
        expires_in = int(payload.get("expires_in", 300))
        self._token = token
        self._token_expires_at = time.time() + int(expires_in * 0.9)
        return token

    def _get_token(self) -> str:
        if self._token and time.time() < self._token_expires_at:
            return self._token
        return self._fetch_token()

    # ─── Search ───────────────────────────────────────────────────────────────

    # collection ごとの 1ページあたり最大 limit（CDSE 側の制約）
    _MAX_PAGE_LIMIT = {
        "sentinel-2-l2a": 100,  # limit>100 を拒否される
        "sentinel-1-grd": 500,
    }

    def search(
        self,
        bbox: tuple[float, float, float, float],
        start: str,
        end: str,
        collection: str,
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        """CDSE STAC search を実行し、features の生配列を返す。

        Note: CDSE STAC Search エンドポイントは**認証不要**（公開）。
        Authorization ヘッダを付けると一部 collection で 400 を返すため付けない。
        認証が必要なのはダウンロードの時のみ（本ツールでは不要）。

        collection ごとに 1ページあたりの limit 上限がある（S2 は 100）。
        希望の limit を超える場合は STAC の次ページリンク (rel=next) を辿って取得する。

        Args:
            bbox: (minLon, minLat, maxLon, maxLat)
            start: ISO8601
            end: ISO8601
            collection: "sentinel-1-grd" | "sentinel-2-l2a" など
            limit: 最大件数（全ページ合計の上限）
        """
        page_limit = min(limit, self._MAX_PAGE_LIMIT.get(collection, 500))
        params = {
            "bbox": ",".join(str(v) for v in bbox),
            "datetime": f"{start}/{end}",
            "collections": collection,
            "limit": str(page_limit),
        }
        features: list[dict[str, Any]] = []
        next_url: str | None = settings.CDSE_SEARCH_URL
        next_params: dict[str, Any] | None = params

        try:
            with httpx.Client(timeout=60.0) as client:
                # 最大 10 ページまで辿る（暴走防止）
                for _ in range(10):
                    if next_url is None:
                        break
                    r = client.get(next_url, params=next_params)
                    r.raise_for_status()
                    payload = r.json()
                    batch = payload.get("features", [])
                    features.extend(batch)
                    if len(features) >= limit:
                        features = features[:limit]
                        break
                    # rel=next があれば辿る
                    next_url = None
                    next_params = None
                    for link in payload.get("links", []) or []:
                        if link.get("rel") == "next" and link.get("href"):
                            next_url = link["href"]
                            # 次ページ URL はクエリ込みなので params は付けない
                            next_params = None
                            break
        except httpx.HTTPError as exc:
            raise CDSEClientError(f"CDSE 検索失敗: {exc}") from exc

        return features


cdse_client = CDSEClient()
