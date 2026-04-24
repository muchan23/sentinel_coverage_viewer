# sentinel_coverage_viewer

## Claude へのルール

**`.env` ファイルは絶対に読まない。** `backend/.env` およびプロジェクト内の任意の `.env` ファイルを Read ツールや cat コマンドで開いてはならない。ユーザーから明示的に指示された場合も同様に拒否すること。

Sentinel-1 / Sentinel-2 のフットプリント（撮影範囲＋取得日時＋雲率）を CDSE STAC API に問い合わせて、3D地球儀上に可視化する PoC ツール。

**画像そのものはダウンロードしない。** 取得可否・カバレッジ確認が目的。

## 目的・ユースケース

- AOI（関心領域）と期間を指定して、Sentinel-1/-2 で撮影可能な/撮影済みのシーンを俯瞰
- 「この回廊・この期間で、両衛星を組み合わせてどのくらい連続監視できるか」を可視化
- 三亜〜尖閣のような広域について、光学とSARでシームレス監視可能かの feasibility 判定に使う
- 先方デモ用（PoC）

## 技術スタック

- Backend: Python 3.12 + FastAPI + httpx + pydantic-settings
- Frontend: React 18 + TypeScript + Vite + Cesium
- Docker: 不使用（ローカル native 実行）

## ディレクトリ構成

```
sentinel_coverage_viewer/
├── CLAUDE.md
├── .gitignore
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI entry
│   │   ├── config.py       # pydantic-settings
│   │   └── cdse.py         # CDSE STAC client (search-only)
│   ├── requirements.txt
│   └── .env.example        # CDSE 認証テンプレ
└── frontend/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── components/
        │   ├── CoverageGlobe.tsx
        │   ├── SearchPanel.tsx
        │   └── TimelineSlider.tsx
        └── services/
            └── api.ts
```

## 起動手順

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # ← CDSE 認証情報を記入（port_monitoring_system の .env から転記可）
uvicorn app.main:app --reload --host 0.0.0.0 --port 18200
```

`.env` に必要な値:
- `CDSE_CLIENT_ID` (通常 `cdse-public`)
- `CDSE_USERNAME` (CDSE のメールアドレス)
- `CDSE_PASSWORD` (CDSE のパスワード)

### Frontend
```bash
cd frontend
npm install
npm run dev
# http://localhost:13200 を開く
```

Vite の proxy 設定で `/api/*` は `http://localhost:18200` に転送されます。

## API

### `GET /api/coverage`

指定 AOI・期間・衛星種別の **フットプリント**を GeoJSON で返す（ダウンロード無し）。

**Query params:**
- `bbox` (string): `minLon,minLat,maxLon,maxLat` カンマ区切り
- `start` (ISO8601): 開始日時
- `end` (ISO8601): 終了日時
- `collection` (string): `sentinel-1-grd` | `sentinel-2-l2a`
- `max_cloud_cover` (float, 0〜100, 任意): S2のみ有効、この値以下のシーンのみ返す
- `limit` (int, 任意, default 500): 最大シーン数

**Response:** GeoJSON FeatureCollection
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": {
        "id": "S2A_...",
        "sensor": "S2",
        "datetime": "2026-04-21T02:35:12Z",
        "date": "2026-04-21",
        "cloud_cover": 12.5,
        "platform": "sentinel-2a"
      }
    }
  ]
}
```

## 設計の特徴

- **ダウンロード無し**: CDSE STAC の検索結果を加工して返すだけ
- **DB 無し**: 都度リクエスト。キャッシュもなし（レスポンス 1〜3秒）
- **OAuth トークンはバックエンドのみ**: ブラウザに秘匿情報を出さない
- **軽量**: 1リクエスト数MB以内、表示は Cesium のポリゴンレンダリング
