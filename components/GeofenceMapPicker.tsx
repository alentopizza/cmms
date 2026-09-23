"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GeocodeResult = {
  display_name: string;
  lat: number;
  lon: number;
  place_id?: string;
  provider?: "google" | "osm";
};

type GeofenceMapPickerProps = {
  initialAddress?: string | null;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialRadius?: number | null;
  cityHint?: string | null;
  countryHint?: string | null;
  readOnly?: boolean;
  addressRequired?: boolean;
  coordinateRequired?: boolean;
  currentLatitude?: number | null;
  currentLongitude?: number | null;
  currentAccuracy?: number | null;
  className?: string;
};

declare global {
  interface Window {
    google?: any;
  }
}

const TILE_SIZE = 256;
let googleMapsPromise: Promise<any> | null = null;

// ── Google Maps loader / provider boundary ──────────────────────────────────

function loadGoogleMaps(apiKey:string) {
  if (!apiKey) return Promise.reject(new Error("Google Maps no está configurado."));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-desweb-google-maps="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google), { once: true });
      existing.addEventListener("error", () => reject(new Error("No fue posible cargar Google Maps.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.deswebGoogleMaps = "true";
    script.onload = () => window.google ? resolve(window.google) : reject(new Error("Google Maps no respondió."));
    script.onerror = () => reject(new Error("No fue posible cargar Google Maps."));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

// ── OSM fallback math (kept only for graceful provider fallback) ────────────

function clampLatitude(value: number) {
  return Math.max(-85.05112878, Math.min(85.05112878, value));
}

function tilePoint(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const latitude = clampLatitude(lat) * Math.PI / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * n,
  };
}

function pointToLatLng(x: number, y: number, zoom: number) {
  const n = 2 ** zoom;
  const lon = x / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI;
  return { lat, lon };
}

function formatCoordinate(value: number | null) {
  return value === null ? "—" : value.toFixed(6);
}

export default function GeofenceMapPicker({
  initialAddress = "",
  initialLatitude = null,
  initialLongitude = null,
  initialRadius = 250,
  cityHint = "",
  countryHint = "",
  readOnly = false,
  addressRequired = true,
  coordinateRequired = true,
  currentLatitude = null,
  currentLongitude = null,
  currentAccuracy = null,
  className = "",
}: GeofenceMapPickerProps) {
  const [address, setAddress] = useState(initialAddress || "");
  const [latitude, setLatitude] = useState<number | null>(Number.isFinite(initialLatitude) ? Number(initialLatitude) : null);
  const [longitude, setLongitude] = useState<number | null>(Number.isFinite(initialLongitude) ? Number(initialLongitude) : null);
  const [radius, setRadius] = useState(Number.isFinite(initialRadius) ? Math.max(20, Math.min(5000, Number(initialRadius))) : 250);
  const [zoom, setZoom] = useState(16);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [validatedLabel, setValidatedLabel] = useState(initialLatitude !== null && initialLongitude !== null ? initialAddress || "Punto configurado" : "");
  const [googleReady, setGoogleReady] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [googleConfig,setGoogleConfig]=useState<{apiKey:string;mapId:string}|null>(null);
  const [googleConfigLoaded,setGoogleConfigLoaded]=useState(false);

  const googleHostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const siteMarkerRef = useRef<any>(null);
  const currentMarkerRef = useRef<any>(null);
  const geofenceCircleRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);

  const configured = latitude !== null && longitude !== null;
  const center = configured ? { lat: latitude as number, lon: longitude as number } : { lat: 4.711, lon: -74.0721 };
  const useGoogle = Boolean(googleConfig?.apiKey) && !googleFailed;

  // ── Runtime Maps configuration ────────────────────────────────────────────

  useEffect(()=>{
    let cancelled=false;
    fetch("/api/maps-config",{headers:{Accept:"application/json"},cache:"no-store"})
      .then(async response=>{
        if(!response.ok)throw new Error("Maps config unavailable");
        return response.json();
      })
      .then(data=>{
        if(cancelled)return;
        if(data?.enabled&&typeof data.apiKey==="string"){
          setGoogleConfig({apiKey:data.apiKey,mapId:typeof data.mapId==="string"?data.mapId:""});
        }else{
          setGoogleConfig(null);
        }
      })
      .catch(()=>{ if(!cancelled)setGoogleConfig(null); })
      .finally(()=>{ if(!cancelled)setGoogleConfigLoaded(true); });
    return()=>{cancelled=true;};
  },[]);

  // ── Current Google map initialization ─────────────────────────────────────

  useEffect(() => {
    if (!useGoogle || !googleHostRef.current) return;
    let disposed = false;
    const listeners: any[] = [];

    loadGoogleMaps(googleConfig?.apiKey || "").then(async google => {
      if (disposed || !googleHostRef.current) return;
      const { Map } = await google.maps.importLibrary("maps");
      const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");
      if (disposed || !googleHostRef.current) return;

      const map = new Map(googleHostRef.current, {
        center: { lat: center.lat, lng: center.lon },
        zoom,
        mapId: googleConfig?.mapId || "DEMO_MAP_ID",
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: readOnly ? "cooperative" : "greedy",
      });
      mapRef.current = map;

      const sitePin = new PinElement({ background: "#38b2a9", borderColor: "#293644", glyphColor: "#ffffff" });
      siteMarkerRef.current = new AdvancedMarkerElement({
        map: configured ? map : null,
        position: { lat: center.lat, lng: center.lon },
        title: "Centro de geocerca",
        content: sitePin.element,
      });

      const currentPin = new PinElement({ background: "#2563eb", borderColor: "#dbeafe", glyphColor: "#ffffff", scale: 0.82 });
      currentMarkerRef.current = new AdvancedMarkerElement({
        map: Number.isFinite(currentLatitude) && Number.isFinite(currentLongitude) ? map : null,
        position: Number.isFinite(currentLatitude) && Number.isFinite(currentLongitude)
          ? { lat: Number(currentLatitude), lng: Number(currentLongitude) }
          : { lat: center.lat, lng: center.lon },
        title: "Ubicación actual del dispositivo",
        content: currentPin.element,
      });

      geofenceCircleRef.current = new google.maps.Circle({
        map: configured ? map : null,
        center: { lat: center.lat, lng: center.lon },
        radius,
        strokeColor: "#38b2a9",
        strokeOpacity: 0.95,
        strokeWeight: 2,
        fillColor: "#38b2a9",
        fillOpacity: 0.14,
        clickable: false,
      });

      accuracyCircleRef.current = new google.maps.Circle({
        map: Number.isFinite(currentLatitude) && Number.isFinite(currentLongitude) && Number.isFinite(currentAccuracy) ? map : null,
        center: Number.isFinite(currentLatitude) && Number.isFinite(currentLongitude)
          ? { lat: Number(currentLatitude), lng: Number(currentLongitude) }
          : { lat: center.lat, lng: center.lon },
        radius: Number.isFinite(currentAccuracy) ? Math.max(1, Number(currentAccuracy)) : 1,
        strokeColor: "#2563eb",
        strokeOpacity: 0.55,
        strokeWeight: 1,
        fillColor: "#2563eb",
        fillOpacity: 0.08,
        clickable: false,
      });

      if (!readOnly) {
        listeners.push(map.addListener("click", (event:any) => {
          const nextLat = event.latLng?.lat?.();
          const nextLng = event.latLng?.lng?.();
          if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;
          setLatitude(nextLat);
          setLongitude(nextLng);
          setValidatedLabel(address.trim() || "Punto seleccionado manualmente");
          setResults([]);
          setMessage("Punto ajustado manualmente en Google Maps.");
        }));
      }

      setGoogleReady(true);
    }).catch(() => {
      if (!disposed) {
        setGoogleFailed(true);
        setGoogleReady(false);
        setMessage("Google Maps no está disponible. Se activó el mapa de respaldo temporal.");
      }
    });

    return () => {
      disposed = true;
      listeners.forEach(listener => listener?.remove?.());
      if (siteMarkerRef.current) siteMarkerRef.current.map = null;
      if (currentMarkerRef.current) currentMarkerRef.current.map = null;
      geofenceCircleRef.current?.setMap?.(null);
      accuracyCircleRef.current?.setMap?.(null);
      mapRef.current = null;
    };
  }, [useGoogle, readOnly, googleConfig?.apiKey, googleConfig?.mapId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !googleReady) return;
    const nextCenter = { lat: center.lat, lng: center.lon };
    map.setCenter(nextCenter);
    map.setZoom(zoom);

    if (siteMarkerRef.current) {
      siteMarkerRef.current.position = nextCenter;
      siteMarkerRef.current.map = configured ? map : null;
    }
    if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setCenter(nextCenter);
      geofenceCircleRef.current.setRadius(radius);
      geofenceCircleRef.current.setMap(configured ? map : null);
    }

    const hasCurrent = Number.isFinite(currentLatitude) && Number.isFinite(currentLongitude);
    if (currentMarkerRef.current) {
      if (hasCurrent) currentMarkerRef.current.position = { lat: Number(currentLatitude), lng: Number(currentLongitude) };
      currentMarkerRef.current.map = hasCurrent ? map : null;
    }
    if (accuracyCircleRef.current) {
      if (hasCurrent) accuracyCircleRef.current.setCenter({ lat: Number(currentLatitude), lng: Number(currentLongitude) });
      accuracyCircleRef.current.setRadius(Number.isFinite(currentAccuracy) ? Math.max(1, Number(currentAccuracy)) : 1);
      accuracyCircleRef.current.setMap(hasCurrent && Number.isFinite(currentAccuracy) ? map : null);
    }
  }, [googleReady, configured, center.lat, center.lon, zoom, radius, currentLatitude, currentLongitude, currentAccuracy]);

  const tiles = useMemo(() => {
    if (useGoogle) return [];
    const centerPoint = tilePoint(center.lat, center.lon, zoom);
    const baseX = Math.floor(centerPoint.x);
    const baseY = Math.floor(centerPoint.y);
    const values: Array<{ key: string; x: number; y: number; left: string; top: string }> = [];
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const x = baseX + dx;
        const y = baseY + dy;
        values.push({
          key: `${zoom}-${x}-${y}`,
          x,
          y,
          left: `calc(50% + ${(x - centerPoint.x) * TILE_SIZE}px)`,
          top: `calc(50% + ${(y - centerPoint.y) * TILE_SIZE}px)`,
        });
      }
    }
    return values;
  }, [useGoogle, center.lat, center.lon, zoom]);

  const radiusPixels = useMemo(() => {
    if (!configured || useGoogle) return 0;
    const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / (2 ** zoom);
    return Math.max(7, Math.min(220, radius / metersPerPixel));
  }, [configured, useGoogle, center.lat, radius, zoom]);

  const currentMarker = useMemo(() => {
    if (useGoogle || !configured || !Number.isFinite(currentLatitude) || !Number.isFinite(currentLongitude)) return null;
    const centerPoint = tilePoint(center.lat, center.lon, zoom);
    const point = tilePoint(Number(currentLatitude), Number(currentLongitude), zoom);
    const dx = (point.x - centerPoint.x) * TILE_SIZE;
    const dy = (point.y - centerPoint.y) * TILE_SIZE;
    if (Math.abs(dx) > 900 || Math.abs(dy) > 700) return null;
    return { left: `calc(50% + ${dx}px)`, top: `calc(50% + ${dy}px)` };
  }, [useGoogle, configured, currentLatitude, currentLongitude, center.lat, center.lon, zoom]);

  // ── Address validation / device-position acquisition ──────────────────────

  async function searchAddress() {
    const query = [address.trim(), cityHint?.trim(), countryHint?.trim()].filter(Boolean).join(", ");
    if (query.length < 4) {
      setMessage("Escribe una dirección suficientemente completa para validarla.");
      return;
    }
    setSearching(true);
    setMessage("");
    setResults([]);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { headers: { Accept: "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "No fue posible validar la dirección.");
      const items = Array.isArray(data?.results) ? data.results : [];
      setResults(items);
      if (!items.length) setMessage("No encontramos coincidencias. Ajusta la dirección o selecciona el punto manualmente.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "No fue posible validar la dirección.");
    } finally {
      setSearching(false);
    }
  }

  function chooseResult(result: GeocodeResult) {
    setLatitude(result.lat);
    setLongitude(result.lon);
    setAddress(result.display_name);
    setValidatedLabel(result.display_name);
    setResults([]);
    setMessage(`Dirección validada con ${result.provider === "google" ? "Google Maps" : "el proveedor de respaldo"}. Puedes ajustar el punto en el mapa.`);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Este navegador no permite obtener la ubicación del dispositivo.");
      return;
    }
    setMessage("Obteniendo GPS actual del dispositivo…");
    navigator.geolocation.getCurrentPosition(
      position => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setValidatedLabel("Ubicación actual del dispositivo");
        setResults([]);
        setMessage(`GPS obtenido con precisión aproximada de ${Math.round(position.coords.accuracy)} m.`);
      },
      () => setMessage("No fue posible obtener la ubicación. Revisa el permiso de ubicación del navegador."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  function selectFallbackPoint(event: React.MouseEvent<HTMLButtonElement>) {
    if (readOnly || useGoogle) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const centerPoint = tilePoint(center.lat, center.lon, zoom);
    const next = pointToLatLng(centerPoint.x + dx / TILE_SIZE, centerPoint.y + dy / TILE_SIZE, zoom);
    setLatitude(next.lat);
    setLongitude(next.lon);
    setValidatedLabel(address.trim() || "Punto seleccionado manualmente");
    setResults([]);
    setMessage("Punto ajustado manualmente en el mapa de respaldo.");
  }

  // ── Interactive map and serialized geofence values ────────────────────────

  return <div className={`geofence-picker ${readOnly ? "read-only" : ""} ${className}`.trim()}>
    <div className="geofence-picker-fields">
      <div className="field geofence-address-field">
        <label>Dirección {addressRequired ? "*" : ""}</label>
        <div className="geofence-address-control">
          <input
            name="address"
            value={address}
            required={addressRequired}
            readOnly={readOnly}
            onChange={event => { setAddress(event.target.value); setValidatedLabel(""); setMessage(""); }}
            placeholder="Ej. Carrera 15 # 93-47, Bogotá"
          />
          {!readOnly && <button className="button secondary" type="button" onClick={searchAddress} disabled={searching}>
            {searching ? "Validando…" : "Validar"}
          </button>}
        </div>
      </div>

      {!readOnly && <div className="geofence-picker-tools">
        <button type="button" className="button secondary" onClick={useCurrentLocation}>Usar mi GPS</button>
        <span className={configured ? "geofence-state valid" : "geofence-state"}>{configured ? "Punto configurado" : "Falta validar el punto"}</span>
      </div>}
    </div>

    {results.length > 0 && <div className="geofence-search-results" role="listbox" aria-label="Coincidencias de dirección">
      {results.map((result, index) => <button type="button" key={`${result.place_id || ""}-${result.lat}-${result.lon}-${index}`} onClick={() => chooseResult(result)}>
        <span aria-hidden="true">⌖</span><strong>{result.display_name}</strong>
      </button>)}
    </div>}

    {message && <div className="geofence-message" role="status">{message}</div>}

    <div className={"geofence-map-shell "+(useGoogle ? "google-provider" : "osm-provider")}>
      {!googleConfigLoaded ? <div className="geofence-map-empty">Cargando proveedor de mapas…</div> : useGoogle ? <>
        <div ref={googleHostRef} className="geofence-google-map" aria-label="Google Maps de la geocerca configurada" />
        {!googleReady && <div className="geofence-map-empty">Cargando Google Maps…</div>}
      </> : <button type="button" className="geofence-map-canvas" onClick={selectFallbackPoint} aria-label={readOnly ? "Mapa de respaldo de la geocerca configurada" : "Mapa de respaldo. Toca para ajustar el punto central."}>
        <span className="geofence-map-tiles" aria-hidden="true">
          {tiles.map(tile => <img key={tile.key} src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`} alt="" style={{ left: tile.left, top: tile.top }} />)}
        </span>
        {configured && <span className="geofence-radius-circle" aria-hidden="true" style={{ width: radiusPixels * 2, height: radiusPixels * 2 }} />}
        {configured && <span className="geofence-map-marker" aria-hidden="true"><i /></span>}
        {currentMarker && <span className="geofence-current-marker" aria-label={`Tu ubicación actual${Number.isFinite(currentAccuracy) ? `, precisión aproximada ${Math.round(Number(currentAccuracy))} metros` : ""}`} style={currentMarker}><i /></span>}
        {!configured && <span className="geofence-map-empty">Valida la dirección o selecciona el punto en el mapa</span>}
      </button>}

      {!useGoogle && <div className="geofence-map-controls">
        <button type="button" onClick={() => setZoom(value => Math.min(19, value + 1))} aria-label="Acercar mapa">+</button>
        <button type="button" onClick={() => setZoom(value => Math.max(12, value - 1))} aria-label="Alejar mapa">−</button>
      </div>}
      <span className="geofence-map-provider">{useGoogle ? "Google Maps" : "Mapa de respaldo · OpenStreetMap"}</span>
      {!useGoogle && <span className="geofence-map-attribution">© OpenStreetMap contributors</span>}
    </div>

    <div className="geofence-config-row">
      <div className="geofence-coordinate-summary">
        <div><span>Latitud</span><strong>{formatCoordinate(latitude)}</strong></div>
        <div><span>Longitud</span><strong>{formatCoordinate(longitude)}</strong></div>
      </div>
      <div className="field geofence-radius-field">
        <label>Radio permitido</label>
        <div className="geofence-radius-control">
          <input name="geofence_radius_m" type="range" min="20" max="5000" step="10" value={radius} disabled={readOnly} onChange={event => setRadius(Number(event.target.value))} />
          <div><input type="number" min="20" max="5000" step="10" value={radius} disabled={readOnly} onChange={event => setRadius(Math.max(20, Math.min(5000, Number(event.target.value) || 20)))} aria-label="Radio permitido en metros" /><span>m</span></div>
        </div>
        <small>La geocerca visual proviene del mapa; la validación de entrada/salida se recalcula en el servidor con el GPS del dispositivo.</small>
      </div>
    </div>

    {validatedLabel && <div className="geofence-validated-label"><span aria-hidden="true">✓</span><div><strong>Punto validado</strong><small>{validatedLabel}</small></div></div>}

    <input type="hidden" name="latitude" value={latitude ?? ""} required={coordinateRequired} />
    <input type="hidden" name="longitude" value={longitude ?? ""} required={coordinateRequired} />
    {readOnly && <input type="hidden" name="geofence_radius_m" value={radius} />}
  </div>;
}
