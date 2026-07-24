import React, { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MapPin, RefreshCw, Share2, Upload, Navigation, Wifi, Edit3, Search, X, Download } from 'lucide-react';

const queryClient = new QueryClient();

const PUERTO_ARGENTINO_LAT = -51.6938;
const PUERTO_ARGENTINO_LON = -57.8483;

type LocationSource = 'gps' | 'ip' | 'manual' | null;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function formatDegrees(value: number, posLabel: string, negLabel: string): string {
  return value >= 0
    ? `${value.toFixed(4)}° ${posLabel}`
    : `${Math.abs(value).toFixed(4)}° ${negLabel}`;
}

/** Try GPS geolocation. Resolves with coordinates or rejects on failure. */
function fetchByGPS(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('no-geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/** Try IP-based geolocation using ipapi.co (free, HTTPS, no key required). */
async function fetchByIP(): Promise<{ lat: number; lon: number; city: string; country: string }> {
  const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('ip-api-failed');
  const data = await res.json();
  if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
    throw new Error('ip-api-no-coords');
  }
  return {
    lat: data.latitude,
    lon: data.longitude,
    city: data.city ?? '',
    country: data.country_name ?? '',
  };
}

/** Reverse geocode coordinates to a locality name using Nominatim. */
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MalvinasApp/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    return a.city || a.town || a.village || a.suburb || a.county || a.state || null;
  } catch {
    return null;
  }
}

/** Geocode a city name using OpenStreetMap Nominatim (free, no key). */
async function geocodeCity(query: string): Promise<{ lat: number; lon: number; displayName: string }> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'es', 'User-Agent': 'MalvinasApp/1.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('geocode-failed');
  const data = await res.json();
  if (!data.length) throw new Error('not-found');
  return {
    lat: parseFloat(data[0].lat),
    lon: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

async function generateStoryImage(
  backgroundImg: HTMLImageElement | null,
  distanceKm: number,
  locationLabel: string
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d')!;

  if (backgroundImg) {
    const imgAspect = backgroundImg.naturalWidth / backgroundImg.naturalHeight;
    const canvasAspect = 1080 / 1920;
    let sx, sy, sw, sh;
    if (imgAspect > canvasAspect) {
      sh = backgroundImg.naturalHeight;
      sw = sh * canvasAspect;
      sx = (backgroundImg.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      sw = backgroundImg.naturalWidth;
      sh = sw / canvasAspect;
      sx = 0;
      sy = (backgroundImg.naturalHeight - sh) / 2;
    }
    ctx.drawImage(backgroundImg, sx, sy, sw, sh, 0, 0, 1080, 1920);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, '#74ACDF');
    grad.addColorStop(1, '#1a3d6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);
  }

  ctx.fillStyle = 'rgba(0, 20, 60, 0.55)';
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 88px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('ESTOY A', 540, 310);

  ctx.strokeStyle = '#74ACDF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(160, 560);
  ctx.lineTo(920, 560);
  ctx.stroke();

  const formattedDist = distanceKm >= 1000
    ? Math.round(distanceKm).toLocaleString('es-AR')
    : Math.round(distanceKm).toString();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 180px Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedDist + ' km', 540, 900);

  ctx.font = '60px Arial, sans-serif';
  ctx.fillStyle = '#74ACDF';
  ctx.fillText('de nuestras Islas Malvinas', 540, 1050);

  const now = new Date();
  const dateStr = now.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '44px Arial, sans-serif';
  ctx.fillText(locationLabel, 540, 1780);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '38px Arial, sans-serif';
  ctx.fillText(`${dateStr}  ·  ${timeStr}`, 540, 1860);

  return new Promise((resolve) => canvas.toBlob(resolve!, 'image/png'));
}

async function shareStoryImage(blob: Blob, distanceKm: number) {
  const file = new File([blob], 'malvinas-historia.jpg', { type: 'image/jpeg' });
  const distText = distanceKm >= 1000
    ? Math.round(distanceKm).toLocaleString('es-AR')
    : Math.round(distanceKm).toString();

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Las Malvinas son Argentinas',
        text: `Estoy a ${distText} km de Puerto Argentino. Las Malvinas son Argentinas.`,
      });
    } catch {
      // User cancelled — no action needed
    }
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'malvinas-historia.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

const SolDeMayo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className}>
    <circle cx="50" cy="50" r="16" fill="#FDB813" />
    <g fill="#FDB813">
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (i * 360) / 16;
        const transform = `rotate(${angle} 50 50)`;
        const isWavy = i % 2 !== 0;
        if (isWavy) {
          return <path key={i} d="M48 20 C48 15 52 10 50 5 C48 10 52 15 52 20 Z" transform={transform} />;
        }
        return <path key={i} d="M48.5 20 L50 5 L51.5 20 Z" transform={transform} />;
      })}
    </g>
  </svg>
);

const MalvinasSilhouette = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 326 215" className={className} fill="currentColor">
    <path d="M129.2,32.7c-5.2-4.1-13.8-3.7-18.4,1.8c-2.3,2.8-3.5,6.2-3.5,9.6c0,8.3,1.8,11.1-2.8,17.5c-4.6,6.5-12.9,9.2-20.3,13.8c-7.4,4.6-9.2,8.3-9.2,13.8c0,4.6-2.8,7.4-4.6,12.9c-2.8,7.4-3.7,11.1-5.5,16.6c-2.8,8.3-8.3,11.1-12.9,16.6c-4.6,5.5-11.1,10.1-18.4,12.9c-8.3,3.7-12.9,7.4-12.9,14.8c0,6.5,4.6,11.1,9.2,14.8c5.5,4.6,11.1,8.3,18.4,9.2c8.3,0.9,14.8,2.8,20.3-1.8c6.5-5.5,12.9-10.1,19.4-14.8c6.5-4.6,12.9-10.1,20.3-11.1c8.3-0.9,14.8,0.9,22.1,1.8c8.3,0.9,15.7,2.8,22.1-1.8c6.5-5.5,11.1-11.1,16.6-18.4c4.6-6.5,9.2-12.9,11.1-20.3c1.8-8.3,1.8-15.7,0-23.1c-1.8-8.3-5.5-15.7-11.1-21.2c-6.5-6.5-12.9-10.1-21.2-12.9c-8.3-2.8-15.7-4.6-23.1-4.6C138.4,43.7,133.8,36.4,129.2,32.7z"/>
    <path d="M228.8,32.7c-1.8-6.5-8.3-11.1-14.8-12.9c-7.4-1.8-14.8-2.8-22.1,0c-8.3,2.8-15.7,7.4-21.2,13.8c-6.5,6.5-11.1,14.8-13.8,23.1c-2.8,8.3-3.7,17.5-1.8,25.8c1.8,8.3,5.5,15.7,11.1,22.1c6.5,6.5,13.8,11.1,22.1,14.8c8.3,3.7,16.6,5.5,25.8,5.5c8.3,0,16.6-1.8,24-6.5c7.4-4.6,13.8-10.1,19.4-17.5c4.6-6.5,8.3-14.8,9.2-23.1c0.9-8.3,0-16.6-2.8-24.9c-2.8-8.3-7.4-15.7-13.8-21.2C243.6,37.3,236.2,34.5,228.8,32.7z"/>
  </svg>
);

/** Badge showing how the location was obtained */
function SourceBadge({ source, city }: { source: LocationSource; city: string | null }) {
  if (!source) return null;
  const configs = {
    gps: {
      icon: <Navigation className="w-3 h-3" />,
      label: 'GPS preciso',
      cls: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
    },
    ip: {
      icon: <Wifi className="w-3 h-3" />,
      label: city ? `Aprox. por IP — ${city}` : 'Ubicacion aproximada por IP',
      cls: 'bg-amber-500/20 border-amber-400/30 text-amber-300',
    },
    manual: {
      icon: <Edit3 className="w-3 h-3" />,
      label: 'Ubicacion ingresada manualmente',
      cls: 'bg-sky-500/20 border-sky-400/30 text-sky-300',
    },
  };
  const cfg = configs[source];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

/** Manual entry form — city search or raw lat/lon */
function ManualForm({ onConfirm }: { onConfirm: (lat: number, lon: number, label: string) => void }) {
  const [mode, setMode] = useState<'city' | 'coords'>('city');
  const [cityInput, setCityInput] = useState('');
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCitySearch = async () => {
    const q = cityInput.trim();
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      const result = await geocodeCity(q);
      onConfirm(result.lat, result.lon, q);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg === 'not-found'
        ? 'No se encontró esa ciudad. Intentá con un nombre más específico.'
        : 'Error al buscar. Verificá tu conexion e intentá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const handleCoordsConfirm = () => {
    const lat = parseFloat(latInput.replace(',', '.'));
    const lon = parseFloat(lonInput.replace(',', '.'));
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      setError('Coordenadas inválidas. Latitud: -90 a 90. Longitud: -180 a 180.');
      return;
    }
    onConfirm(lat, lon, `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  };

  return (
    <div
      className="w-full bg-black/30 border border-white/15 rounded-2xl p-5 backdrop-blur-md animate-in zoom-in-95 fade-in duration-400"
      data-testid="manual-form"
    >
      <div className="flex items-center gap-2 mb-4">
        <Edit3 className="w-4 h-4 text-[#74ACDF]" />
        <p className="text-white font-semibold text-sm">Ingresar ubicación manualmente</p>
      </div>

      {/* Mode tabs */}
      <div className="flex bg-white/10 rounded-lg p-1 mb-4">
        <button
          onClick={() => { setMode('city'); setError(null); }}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-200 ${
            mode === 'city' ? 'bg-[#74ACDF] text-[#00143c]' : 'text-white/60 hover:text-white'
          }`}
        >
          Ciudad
        </button>
        <button
          onClick={() => { setMode('coords'); setError(null); }}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-all duration-200 ${
            mode === 'coords' ? 'bg-[#74ACDF] text-[#00143c]' : 'text-white/60 hover:text-white'
          }`}
        >
          Coordenadas
        </button>
      </div>

      {mode === 'city' ? (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ej: Buenos Aires, Argentina"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCitySearch()}
            data-testid="input-manual-city"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[#74ACDF]/60 focus:bg-white/15 transition-all"
          />
          <button
            onClick={handleCitySearch}
            disabled={busy || !cityInput.trim()}
            data-testid="button-search-city"
            className="bg-[#74ACDF] hover:bg-[#5a93c7] active:bg-[#4a82b3] disabled:opacity-50 text-[#00143c] px-3 py-2.5 rounded-lg font-bold transition-colors flex items-center gap-1.5"
          >
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Latitud (-90 a 90)"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            data-testid="input-manual-lat"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[#74ACDF]/60 focus:bg-white/15 transition-all"
          />
          <input
            type="text"
            inputMode="decimal"
            placeholder="Longitud (-180 a 180)"
            value={lonInput}
            onChange={(e) => setLonInput(e.target.value)}
            data-testid="input-manual-lon"
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-[#74ACDF]/60 focus:bg-white/15 transition-all"
          />
          <button
            onClick={handleCoordsConfirm}
            disabled={!latInput.trim() || !lonInput.trim()}
            data-testid="button-confirm-coords"
            className="bg-[#74ACDF] hover:bg-[#5a93c7] active:bg-[#4a82b3] disabled:opacity-50 text-[#00143c] px-3 py-2.5 rounded-lg font-bold transition-colors"
          >
            OK
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 text-red-300 text-xs leading-snug" data-testid="manual-form-error">
          {error}
        </p>
      )}
    </div>
  );
}

function MainScreen() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>(null);
  const [locationCity, setLocationCity] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Obteniendo ubicacion GPS...');
  const [loading, setLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundImg, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [storyBlob, setStoryBlob] = useState<Blob | null>(null);
  const [storyPreviewUrl, setStoryPreviewUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Fetch location with three-tier fallback:
   * 1. Browser GPS
   * 2. IP-based geolocation (ipapi.co)
   * 3. Manual form (shown to the user)
   */
  const fetchLocation = async () => {
    setLoading(true);
    setShowManualForm(false);
    setStatusMessage('Obteniendo ubicacion GPS...');

    // --- Tier 1: GPS ---
    try {
      const coords = await fetchByGPS();
      setLocation(coords);
      setLocationSource('gps');
      setLocationCity(null);
      setStatusMessage('');
      setLoading(false);
      // Reverse geocode in background — updates city label when ready
      reverseGeocode(coords.lat, coords.lon).then((city) => {
        if (city) setLocationCity(city);
      });
      return;
    } catch {
      // GPS failed — try IP next
      setStatusMessage('GPS no disponible. Buscando por IP...');
    }

    // --- Tier 2: IP geolocation ---
    try {
      const ipData = await fetchByIP();
      setLocation({ lat: ipData.lat, lon: ipData.lon });
      setLocationSource('ip');
      setLocationCity(ipData.city || ipData.country || null);
      setStatusMessage('');
      setLoading(false);
      return;
    } catch {
      // IP also failed — show manual form
      setStatusMessage('');
    }

    // --- Tier 3: Manual form ---
    setLoading(false);
    setShowManualForm(true);
  };

  const handleManualConfirm = (lat: number, lon: number, label: string) => {
    setLocation({ lat, lon });
    setLocationSource('manual');
    setLocationCity(label);
    setShowManualForm(false);
  };

  useEffect(() => {
    const savedBg = localStorage.getItem('malvinas-bg');
    if (savedBg) {
      setBackgroundUrl(savedBg);
      const img = new Image();
      img.src = savedBg;
      img.onload = () => setBackgroundImage(img);
    }
    fetchLocation();
  }, []);

  const distanceKm = location
    ? haversineDistance(location.lat, location.lon, PUERTO_ARGENTINO_LAT, PUERTO_ARGENTINO_LON)
    : null;
  const formattedDistance = distanceKm !== null
    ? (distanceKm >= 1000 ? Math.round(distanceKm).toLocaleString('es-AR') : Math.round(distanceKm).toString())
    : '--';

  const onCreate = async () => {
    if (!location || distanceKm === null) return;
    setGeneratingStory(true);
    try {
      const label = locationCity
        ? locationCity
        : `${formatDegrees(location.lat, 'N', 'S')}  |  ${formatDegrees(location.lon, 'E', 'O')}`;
      const blob = await generateStoryImage(backgroundImg, distanceKm, label);
      const url = URL.createObjectURL(blob);
      setStoryBlob(blob);
      setStoryPreviewUrl(url);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingStory(false);
    }
  };

  const onClosePreview = () => {
    if (storyPreviewUrl) URL.revokeObjectURL(storyPreviewUrl);
    setStoryPreviewUrl(null);
    setStoryBlob(null);
  };

  const onShareFromModal = async () => {
    if (!storyBlob || distanceKm === null) return;
    const file = new File([storyBlob], 'malvinas-historia.png', { type: 'image/png' });
    const distText = distanceKm >= 1000
      ? Math.round(distanceKm).toLocaleString('es-AR')
      : Math.round(distanceKm).toString();
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Las Malvinas son Argentinas',
          text: `Estoy a ${distText} km de Puerto Argentino. Las Malvinas son Argentinas.`,
        });
      } catch { /* usuario canceló */ }
    } else {
      const url = URL.createObjectURL(storyBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'malvinas-historia.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBackgroundUrl(dataUrl);
      try { localStorage.setItem('malvinas-bg', dataUrl); } catch { /* quota exceeded — skip persistence */ }
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => setBackgroundImage(img);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden font-sans bg-[#0D1B2A]">
      {/* Background Layer */}
      {backgroundUrl ? (
        <img src={backgroundUrl} alt="Fondo" className="absolute inset-0 w-full h-full object-cover z-0" />
      ) : (
        <div className="absolute inset-0 w-full h-full z-0 bg-gradient-to-b from-[#74ACDF] to-[#1a3d6e] flex items-center justify-center">
          <MalvinasSilhouette className="w-[55%] text-[#4A8FCE] opacity-30 mix-blend-overlay" />
        </div>
      )}

      {/* Dark Overlay */}
      <div className="absolute inset-0 z-10 bg-[#00143c]/50 backdrop-blur-[2px]" />

      {/* Main UI */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-md px-6 py-10 min-h-[100dvh] justify-between">

        {/* Header — sol e título removidos */}
        <div />

        {/* Hero Data */}
        <div className="flex flex-col items-center justify-center w-full flex-1 my-8 gap-4">

          {/* Status / loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 animate-in fade-in duration-400" data-testid="status-location">
              <RefreshCw className="w-7 h-7 text-[#74ACDF] animate-spin" />
              <p className="text-white/80 font-medium text-sm">{statusMessage}</p>
            </div>
          )}

          {/* Distance display — shown when we have a location */}
          {!loading && location && (
            <div className="flex flex-col items-center text-center animate-in zoom-in-95 fade-in duration-700">
              <div className="flex items-center gap-2 text-[#74ACDF] mb-3 opacity-90">
                <Navigation className="w-4 h-4 -mt-0.5" />
                <span className="text-2xl md:text-3xl font-semibold tracking-[0.2em] uppercase font-sans">
                  Estas a
                </span>
              </div>

              <div className="relative">
                <span
                  className="text-7xl md:text-8xl font-black text-white tracking-tighter font-sans drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                  data-testid="text-distance"
                >
                  {formattedDistance}
                </span>
                <span className="absolute -right-10 bottom-3 text-2xl font-bold text-[#74ACDF] drop-shadow-md">
                  km
                </span>
              </div>

              <p className="text-xl md:text-2xl text-white mt-4 font-serif italic font-medium drop-shadow-md">
                de Islas Malvinas
              </p>

              <div className="w-16 h-[3px] bg-[#74ACDF]/60 my-5 rounded-full" />

              <div className="flex flex-col items-center gap-3">
                <SourceBadge source={locationSource} city={locationCity} />
                {/* lat/lon hidden — kept in DOM for data-testid consumers */}
                <span data-testid="text-latitude" className="hidden">{formatDegrees(location.lat, 'N', 'S')}</span>
                <span data-testid="text-longitude" className="hidden">{formatDegrees(location.lon, 'E', 'O')}</span>
              </div>
            </div>
          )}

          {/* Manual form — shown when both GPS and IP fail */}
          {!loading && showManualForm && (
            <div className="w-full flex flex-col items-center gap-4 animate-in fade-in duration-500">
              <div className="flex flex-col items-center gap-2 text-center" data-testid="status-location">
                <MapPin className="w-7 h-7 text-amber-400" />
                <p className="text-white font-semibold text-sm">No se pudo detectar tu ubicacion</p>
                <p className="text-white/60 text-xs">Ingresala manualmente para continuar</p>
              </div>
              <ManualForm onConfirm={handleManualConfirm} />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3 animate-in slide-in-from-bottom-8 fade-in duration-700 delay-300 fill-mode-both pb-4">
          <button
            onClick={fetchLocation}
            disabled={loading}
            data-testid="button-refresh"
            className="w-full relative overflow-hidden group bg-white/10 hover:bg-white/20 active:bg-white/15 text-white border border-white/20 px-6 py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-md"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-[#74ACDF]' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            {loading ? 'Actualizando...' : 'Actualizar ubicacion'}
          </button>

          <button
            onClick={onCreate}
            disabled={!location || loading || generatingStory}
            data-testid="button-share"
            className="w-full relative overflow-hidden group bg-[#74ACDF] hover:bg-[#5a93c7] active:bg-[#4a82b3] text-[#00143c] px-6 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_4px_20px_rgba(116,172,223,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingStory ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Share2 className="w-5 h-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            )}
            {generatingStory ? 'Generando...' : 'Crear historia'}
          </button>

          <div className="flex justify-center mt-3">
            <input
              type="file"
              accept="image/png, image/jpeg"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
              data-testid="input-image-upload"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-change-image"
              className="flex items-center gap-2 text-white/60 hover:text-white/100 text-sm font-medium transition-colors py-2 px-4 rounded-lg hover:bg-white/5"
            >
              <Upload className="w-4 h-4" />
              Cambiar imagen de fondo
            </button>
          </div>
        </div>
      </div>

      {/* Story Preview Modal */}
      {storyPreviewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/92 backdrop-blur-sm animate-in fade-in duration-300 p-6">
          <div className="relative flex flex-col items-center gap-5 w-full max-w-xs">

            {/* Close */}
            <button
              onClick={onClosePreview}
              className="absolute -top-1 -right-1 text-white/60 hover:text-white transition-colors bg-white/10 hover:bg-white/20 rounded-full p-1.5"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Preview image */}
            <img
              src={storyPreviewUrl}
              alt="Vista previa de la historia"
              className="w-full rounded-2xl shadow-2xl border border-white/10"
              style={{ aspectRatio: '9/16', objectFit: 'cover' }}
            />

            {/* Buttons row */}
            <div className="w-full flex gap-3">
              <button
                onClick={onShareFromModal}
                className="flex-1 bg-[#74ACDF] hover:bg-[#5a93c7] active:bg-[#4a82b3] text-[#00143c] px-4 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_4px_20px_rgba(116,172,223,0.3)]"
              >
                <Share2 className="w-5 h-5" />
                Compartir
              </button>
              <button
                onClick={() => {
                  if (!storyBlob) return;
                  const url = URL.createObjectURL(storyBlob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'malvinas-historia.png';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 5000);
                }}
                className="flex-1 bg-white/15 hover:bg-white/25 active:bg-white/20 text-white border border-white/20 px-4 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all duration-300"
              >
                <Download className="w-5 h-5" />
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <MainScreen />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
