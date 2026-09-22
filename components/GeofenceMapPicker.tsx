"use client";

import { useMemo, useState } from "react";

type GeocodeResult = {
  display_name: string;
  lat: number;
  lon: number;
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

const TILE_SIZE = 256;

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
  const [latitude, setLatitude] = useState<number | null>(
    Number.isFinite(initialLatitude) ? Number(initialLatitude) : null,
  );
  const [longitude, setLongitude] = useState<number | null>(
    Number.isFinite(initialLongitude) ? Number(initialLongitude) : null,
  );
  const [radius, setRadius] = useState(
    Number.isFinite(initialRadius) ? Math.max(20, Math.min(5000, Number(initialRadius))) : 250,
  );
  const [zoom, setZoom] = useState(16);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [validatedLabel, setValidatedLabel] = useState(initialLatitude !== null && initialLongitude !== null ? initialAddress || "Punto configurado" : "");

  const configured = latitude !== null && longitude !== null;
  const center = configured ? { lat: latitude as number, lon: longitude as number } : { lat: 4.711, lon: -74.0721 };

  const tiles = useMemo(() => {
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
  }, [center.lat, center.lon, zoom]);

  const radiusPixels = useMemo(() => {
    if (!configured) return 0;
    const metersPerPixel = 156543.03392 * Math.cos(center.lat * Math.PI / 180) / (2 ** zoom);
    return Math.max(7, Math.min(220, radius / metersPerPixel));
  }, [configured, center.lat, radius, zoom]);

  const currentMarker = useMemo(() => {
    if (!configured || !Number.isFinite(currentLatitude) || !Number.isFinite(currentLongitude)) return null;
    const centerPoint = tilePoint(center.lat, center.lon, zoom);
    const point = tilePoint(Number(currentLatitude), Number(currentLongitude), zoom);
    const dx = (point.x - centerPoint.x) * TILE_SIZE;
    const dy = (point.y - centerPoint.y) * TILE_SIZE;
    if (Math.abs(dx) > 900 || Math.abs(dy) > 700) return null;
    return {
      left: `calc(50% + ${dx}px)`,
      top: `calc(50% + ${dy}px)`,
    };
  }, [configured, currentLatitude, currentLongitude, center.lat, center.lon, zoom]);

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
    setMessage("Dirección validada. Puedes ajustar el punto tocando el mapa.");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage("Este navegador no permite obtener la ubicación del dispositivo.");
      return;
    }
    setMessage("Obteniendo ubicación actual…");
    navigator.geolocation.getCurrentPosition(
      position => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setValidatedLabel("Ubicación actual del dispositivo");
        setResults([]);
        setMessage(`Ubicación obtenida con precisión aproximada de ${Math.round(position.coords.accuracy)} m.`);
      },
      () => setMessage("No fue posible obtener la ubicación. Revisa el permiso de ubicación del navegador."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  function selectPoint(event: React.MouseEvent<HTMLButtonElement>) {
    if (readOnly) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const centerPoint = tilePoint(center.lat, center.lon, zoom);
    const next = pointToLatLng(centerPoint.x + dx / TILE_SIZE, centerPoint.y + dy / TILE_SIZE, zoom);
    setLatitude(next.lat);
    setLongitude(next.lon);
    setValidatedLabel(address.trim() || "Punto seleccionado manualmente");
    setResults([]);
    setMessage("Punto ajustado manualmente en el mapa.");
  }

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
            onChange={event => {
              setAddress(event.target.value);
              setValidatedLabel("");
              setMessage("");
            }}
            placeholder="Ej. Carrera 15 # 93-47, Bogotá"
          />
          {!readOnly && <button className="button secondary" type="button" onClick={searchAddress} disabled={searching}>
            {searching ? "Validando…" : "Validar"}
          </button>}
        </div>
      </div>

      {!readOnly && <div className="geofence-picker-tools">
        <button type="button" className="button secondary" onClick={useCurrentLocation}>Usar mi ubicación</button>
        <span className={configured ? "geofence-state valid" : "geofence-state"}>{configured ? "Punto configurado" : "Falta validar el punto"}</span>
      </div>}
    </div>

    {results.length > 0 && <div className="geofence-search-results" role="listbox" aria-label="Coincidencias de dirección">
      {results.map((result, index) => <button type="button" key={`${result.lat}-${result.lon}-${index}`} onClick={() => chooseResult(result)}>
        <span aria-hidden="true">⌖</span><strong>{result.display_name}</strong>
      </button>)}
    </div>}

    {message && <div className="geofence-message" role="status">{message}</div>}

    <div className="geofence-map-shell">
      <button
        type="button"
        className="geofence-map-canvas"
        onClick={selectPoint}
        aria-label={readOnly ? "Mapa de la geocerca configurada" : "Mapa. Toca para ajustar el punto central de la geocerca."}
      >
        <span className="geofence-map-tiles" aria-hidden="true">
          {tiles.map(tile => <img
            key={tile.key}
            src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
            alt=""
            style={{ left: tile.left, top: tile.top }}
          />)}
        </span>
        {configured && <span
          className="geofence-radius-circle"
          aria-hidden="true"
          style={{ width: radiusPixels * 2, height: radiusPixels * 2 }}
        />}
        {configured && <span className="geofence-map-marker" aria-hidden="true"><i /></span>}
        {currentMarker && <span
          className="geofence-current-marker"
          aria-label={`Tu ubicación actual${Number.isFinite(currentAccuracy) ? `, precisión aproximada ${Math.round(Number(currentAccuracy))} metros` : ""}`}
          style={currentMarker}
        ><i /></span>}
        {!configured && <span className="geofence-map-empty">Valida la dirección o selecciona el punto en el mapa</span>}
      </button>

      <div className="geofence-map-controls">
        <button type="button" onClick={() => setZoom(value => Math.min(19, value + 1))} aria-label="Acercar mapa">+</button>
        <button type="button" onClick={() => setZoom(value => Math.max(12, value - 1))} aria-label="Alejar mapa">−</button>
      </div>
      <span className="geofence-map-attribution">© OpenStreetMap contributors</span>
    </div>

    <div className="geofence-config-row">
      <div className="geofence-coordinate-summary">
        <div><span>Latitud</span><strong>{formatCoordinate(latitude)}</strong></div>
        <div><span>Longitud</span><strong>{formatCoordinate(longitude)}</strong></div>
      </div>
      <div className="field geofence-radius-field">
        <label>Radio permitido</label>
        <div className="geofence-radius-control">
          <input
            name="geofence_radius_m"
            type="range"
            min="20"
            max="5000"
            step="10"
            value={radius}
            disabled={readOnly}
            onChange={event => setRadius(Number(event.target.value))}
          />
          <div><input
            type="number"
            min="20"
            max="5000"
            step="10"
            value={radius}
            disabled={readOnly}
            onChange={event => setRadius(Math.max(20, Math.min(5000, Number(event.target.value) || 20)))}
            aria-label="Radio permitido en metros"
          /><span>m</span></div>
        </div>
        <small>El inicio y cierre de actividades biométricas se permitirá dentro de este radio.</small>
      </div>
    </div>

    {validatedLabel && <div className="geofence-validated-label"><span aria-hidden="true">✓</span><div><strong>Punto validado</strong><small>{validatedLabel}</small></div></div>}

    <input type="hidden" name="latitude" value={latitude ?? ""} required={coordinateRequired} />
    <input type="hidden" name="longitude" value={longitude ?? ""} required={coordinateRequired} />
    {readOnly && <input type="hidden" name="geofence_radius_m" value={radius} />}
  </div>;
}
