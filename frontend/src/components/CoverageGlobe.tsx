import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import type { CoverageFeature } from "../services/api";

interface Props {
  features: CoverageFeature[];
}

const S1_COLOR = Cesium.Color.fromCssColorString("#f87171"); // 赤
const S2_COLOR = Cesium.Color.fromCssColorString("#22d3ee"); // シアン

export function CoverageGlobe({ features }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const creditRef    = useRef<HTMLDivElement>(null);
  const viewerRef    = useRef<Cesium.Viewer | null>(null);
  const footprintIdsRef = useRef<string[]>([]);

  // 初期化
  useEffect(() => {
    if (!containerRef.current || !creditRef.current || viewerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      baseLayer: false as unknown as Cesium.ImageryLayer,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayerPicker: false, geocoder: false, homeButton: false,
      sceneModePicker: false, navigationHelpButton: false,
      animation: false, timeline: false, fullscreenButton: false,
      infoBox: false, selectionIndicator: false,
      creditContainer: creditRef.current,
    });

    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#3a6186");
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#020617");
    viewer.scene.globe.enableLighting = false;
    viewer.scene.globe.showGroundAtmosphere = true;

    viewer.imageryLayers.add(new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        subdomains: ["a", "b", "c", "d"], maximumLevel: 19,
        credit: new Cesium.Credit("© OpenStreetMap contributors © CARTO", false),
      }),
      { brightness: 0.55, saturation: 1.4 },
    ));
    viewer.imageryLayers.add(new Cesium.ImageryLayer(
      new Cesium.UrlTemplateImageryProvider({
        url: "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png",
        subdomains: ["a", "b", "c", "d"], maximumLevel: 19,
      }),
      { brightness: 0.7 },
    ));

    // 初期視点: 三亜〜尖閣を俯瞰（高度 7000km, 中心 E.China Sea）
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(117, 22, 7_000_000),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
    });

    // ホバーでツールチップ
    const tooltip = document.createElement("div");
    tooltip.style.cssText = `
      position: absolute; z-index: 20; pointer-events: none;
      background: rgba(15,23,42,0.95); color: #e2e8f0;
      padding: 6px 10px; border-radius: 6px; font-size: 12px;
      border: 1px solid rgba(148,163,184,0.3);
      max-width: 320px; display: none; line-height: 1.5;
    `;
    containerRef.current.appendChild(tooltip);

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((e: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const picked = viewer.scene.pick(e.endPosition);
      if (Cesium.defined(picked) && picked.id instanceof Cesium.Entity) {
        const props = (picked.id as any).__footprintProps;
        if (props) {
          tooltip.style.display = "block";
          tooltip.style.left = `${e.endPosition.x + 14}px`;
          tooltip.style.top = `${e.endPosition.y + 14}px`;
          const cc = props.cloud_cover !== null && props.cloud_cover !== undefined
            ? `${props.cloud_cover.toFixed(1)}%` : "-";
          tooltip.innerHTML = `
            <div><b>${props.sensor}</b> · ${props.datetime}</div>
            <div style="color:#94a3b8; margin-top:2px;">Cloud: ${cc}</div>
            <div style="color:#94a3b8; font-size:11px; margin-top:2px;">${props.id}</div>
          `;
          return;
        }
      }
      tooltip.style.display = "none";
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    viewerRef.current = viewer;

    return () => {
      handler.destroy();
      tooltip.remove();
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // features が変わったら再描画
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || viewer.isDestroyed()) return;

    // 前回のフットプリントをクリア
    for (const id of footprintIdsRef.current) viewer.entities.removeById(id);
    footprintIdsRef.current = [];

    for (const feat of features) {
      const geom = feat.geometry;
      const isS1 = feat.properties.sensor === "S1";
      const color = isS1 ? S1_COLOR : S2_COLOR;
      const cc = feat.properties.cloud_cover;
      // 雲率が高いほど透明度低下（S2）
      const alphaByCloud = cc !== null && cc !== undefined ? 1 - cc / 100 * 0.7 : 1;
      const lineColor = color.withAlpha(Math.max(0.4, 0.9 * alphaByCloud));
      const fillColor = color.withAlpha(0.06 * alphaByCloud);

      const addRing = (ring: [number, number][], suffix: string) => {
        // 経度ラップ（180°を跨ぐポリゴンがまれに存在）は簡易的に無視
        const positions = Cesium.Cartesian3.fromDegreesArray(
          ring.flatMap(([lon, lat]) => [lon, lat])
        );
        const eid = `fp-${feat.id ?? feat.properties.id}-${suffix}`;
        footprintIdsRef.current.push(eid);
        const entity: any = viewer.entities.add({
          id: eid,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(positions),
            material: fillColor,
            outline: false,       // 自前で polyline で描く（点線可）
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(
              [...ring, ring[0]].flatMap(([lon, lat]) => [lon, lat])
            ),
            width: isS1 ? 1.5 : 1.5,
            clampToGround: true,
            material: isS1
              ? new Cesium.PolylineDashMaterialProperty({ color: lineColor, dashLength: 14 })
              : new Cesium.ColorMaterialProperty(lineColor),
          },
        });
        entity.__footprintProps = feat.properties;
      };

      if (geom.type === "Polygon") {
        const coords = (geom.coordinates as unknown as number[][][])[0] as [number, number][];
        if (coords && coords.length >= 3) addRing(coords, "p");
      } else if (geom.type === "MultiPolygon") {
        const polys = geom.coordinates as unknown as number[][][][];
        polys.forEach((poly, i) => {
          const ring = poly[0] as unknown as [number, number][];
          if (ring && ring.length >= 3) addRing(ring, `mp${i}`);
        });
      }
    }
  }, [features]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={creditRef} style={{ display: "none" }} />
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }} />
    </div>
  );
}
