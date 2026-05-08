/* Minimal NAVER Maps SDK ambient types — covers what we use. */
export {};

declare global {
  interface Window {
    naver?: NaverNamespace;
  }
}

export interface NaverPoint {
  x: number;
  y: number;
}

export interface NaverLatLng {
  lat(): number;
  lng(): number;
  equals(other: NaverLatLng): boolean;
}

export interface NaverLatLngBounds {
  extend(latlng: NaverLatLng): void;
}

export interface NaverProjection {
  fromCoordToOffset(latlng: NaverLatLng): NaverPoint;
  fromOffsetToCoord(point: NaverPoint): NaverLatLng;
}

export interface NaverMap {
  setCenter(latlng: NaverLatLng): void;
  panTo(latlng: NaverLatLng, opts?: { duration?: number; easing?: string }): void;
  panBy(point: NaverPoint): void;
  setZoom(level: number, useEffect?: boolean): void;
  getZoom(): number;
  getCenter(): NaverLatLng;
  getProjection(): NaverProjection;
  fitBounds(bounds: NaverLatLngBounds, padding?: number | { top: number; right: number; bottom: number; left: number }): void;
  refresh(): void;
  destroy(): void;
}

export interface NaverMarker {
  setMap(map: NaverMap | null): void;
  setPosition(latlng: NaverLatLng): void;
  getPosition(): NaverLatLng;
  setIcon(icon: { content: string | HTMLElement; anchor?: NaverPoint; size?: NaverPoint }): void;
  setZIndex(z: number): void;
  setVisible(visible: boolean): void;
}

export interface NaverPolyline {
  setMap(map: NaverMap | null): void;
  setPath(path: NaverLatLng[]): void;
  setOptions(options: Record<string, unknown>): void;
}

export interface NaverBicycleLayer {
  setMap(map: NaverMap | null): void;
  getMap(): NaverMap | null;
}

export interface NaverEventListener { /* opaque */ }

export interface NaverNamespace {
  maps: {
    LatLng: new (lat: number, lng: number) => NaverLatLng;
    LatLngBounds: new () => NaverLatLngBounds;
    Point: new (x: number, y: number) => NaverPoint;
    Map: new (
      container: HTMLElement | string,
      opts: { center: NaverLatLng; zoom?: number; minZoom?: number; maxZoom?: number; zoomControl?: boolean; mapTypeControl?: boolean; scaleControl?: boolean; logoControl?: boolean; mapDataControl?: boolean }
    ) => NaverMap;
    Marker: new (opts: {
      position: NaverLatLng;
      map?: NaverMap;
      title?: string;
      icon?: { content: string | HTMLElement; anchor?: NaverPoint; size?: NaverPoint };
      zIndex?: number;
      clickable?: boolean;
      visible?: boolean;
    }) => NaverMarker;
    BicycleLayer: new () => NaverBicycleLayer;
    Polyline: new (opts: {
      path: NaverLatLng[];
      map?: NaverMap;
      strokeColor?: string;
      strokeWeight?: number;
      strokeOpacity?: number;
      strokeStyle?: "solid" | "shortdash" | "shortdot" | "shortdashdot" | "shortdashdotdot" | "dot" | "dash" | "longdash" | "dashdot" | "longdashdot" | "longdashdotdot";
      strokeLineCap?: "butt" | "round" | "square";
      strokeLineJoin?: "miter" | "round" | "bevel";
      clickable?: boolean;
      zIndex?: number;
    }) => NaverPolyline;
    Event: {
      addListener(target: object, type: string, handler: (...args: unknown[]) => void): NaverEventListener;
      removeListener(listener: NaverEventListener): void;
    };
  };
}
