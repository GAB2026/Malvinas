import React, { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MapPin, RefreshCw, Share2, Upload, Navigation } from 'lucide-react';

const queryClient = new QueryClient();

const PUERTO_ARGENTINO_LAT = -51.6938;
const PUERTO_ARGENTINO_LON = -57.8483;

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

async function generateStoryImage(
  backgroundImg: HTMLImageElement | null,
  distanceKm: number,
  userLat: number,
  userLon: number
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d')!;
  
  // 1. Background: draw image or fallback gradient
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
    // Gradient fallback
    const grad = ctx.createLinearGradient(0, 0, 0, 1920);
    grad.addColorStop(0, '#74ACDF');
    grad.addColorStop(1, '#1a3d6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);
  }
  
  // 2. Dark overlay
  ctx.fillStyle = 'rgba(0, 20, 60, 0.55)';
  ctx.fillRect(0, 0, 1080, 1920);
  
  // 3. Top: "LAS MALVINAS SON ARGENTINAS"
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 88px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('LAS MALVINAS', 540, 200);
  ctx.fillText('SON', 540, 310);
  ctx.fillText('ARGENTINAS', 540, 420);
  
  // 4. Decorative horizontal line
  ctx.strokeStyle = '#74ACDF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(160, 560);
  ctx.lineTo(920, 560);
  ctx.stroke();
  
  // 5. Distance
  const formattedDist = distanceKm >= 1000
    ? Math.round(distanceKm).toLocaleString('es-AR')
    : Math.round(distanceKm).toString();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 180px Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedDist + ' km', 540, 900);
  
  // 6. "de Puerto Argentino"
  ctx.font = '60px Arial, sans-serif';
  ctx.fillStyle = '#74ACDF';
  ctx.fillText('de Puerto Argentino', 540, 1050);
  
  // 7. Decorative line
  ctx.strokeStyle = '#74ACDF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(160, 1150);
  ctx.lineTo(920, 1150);
  ctx.stroke();
  
  // 8. User coordinates
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '44px Arial, sans-serif';
  const latLabel = userLat >= 0 ? `${userLat.toFixed(4)}° N` : `${Math.abs(userLat).toFixed(4)}° S`;
  const lonLabel = userLon >= 0 ? `${userLon.toFixed(4)}° E` : `${Math.abs(userLon).toFixed(4)}° O`;
  ctx.fillText(`${latLabel}  |  ${lonLabel}`, 540, 1250);
  
  // 9. Bottom: app attribution
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '36px Arial, sans-serif';
  ctx.fillText('Distancia a Las Malvinas', 540, 1800);
  
  return new Promise((resolve) => canvas.toBlob(resolve!, 'image/jpeg', 0.92));
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
    } catch (err) {
      // User cancelled, no action needed
    }
  } else {
    // Fallback: download
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

function MainScreen() {
  const [location, setLocation] = useState<{lat: number, lon: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [backgroundImg, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchLocation = () => {
    setLoading(true);
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada por el navegador.');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
        setLoading(false);
      },
      (err) => {
        setError('No se pudo obtener la ubicación. Verificá los permisos de GPS.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
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

  const distanceKm = location ? haversineDistance(location.lat, location.lon, PUERTO_ARGENTINO_LAT, PUERTO_ARGENTINO_LON) : null;
  const formattedDistance = distanceKm !== null 
    ? (distanceKm >= 1000 ? Math.round(distanceKm).toLocaleString('es-AR') : Math.round(distanceKm).toString()) 
    : '--';

  const onShare = async () => {
    if (!location || distanceKm === null) return;
    setGeneratingStory(true);
    try {
      const blob = await generateStoryImage(backgroundImg, distanceKm, location.lat, location.lon);
      await shareStoryImage(blob, distanceKm);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingStory(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setBackgroundUrl(dataUrl);
      localStorage.setItem('malvinas-bg', dataUrl);
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
          <MalvinasSilhouette className="w-[120%] text-[#4A8FCE] opacity-30 mix-blend-overlay" />
        </div>
      )}

      {/* Dark Overlay for Readability */}
      <div className="absolute inset-0 z-10 bg-[#00143c]/50 backdrop-blur-[2px]" />

      {/* Main UI */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-md px-6 py-10 min-h-[100dvh] justify-between">
        
        {/* Header */}
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-top-8 duration-700 mt-4">
          <SolDeMayo className="w-12 h-12 mb-3 drop-shadow-md" />
          <h1 className="text-white text-2xl font-bold font-serif tracking-widest drop-shadow-lg text-center uppercase">
            Islas Malvinas
          </h1>
        </div>

        {/* Hero Data */}
        <div className="flex flex-col items-center justify-center w-full flex-1 my-8">
          {loading && !location ? (
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500" data-testid="status-location">
              <RefreshCw className="w-8 h-8 text-[#74ACDF] animate-spin" />
              <p className="text-white/80 font-medium">Obteniendo ubicación...</p>
            </div>
          ) : error && !location ? (
            <div className="flex flex-col items-center gap-4 text-center bg-red-500/20 p-6 rounded-2xl border border-red-500/30 backdrop-blur-md animate-in zoom-in-95 duration-500" data-testid="status-location">
              <MapPin className="w-8 h-8 text-red-400" />
              <p className="text-white font-medium">{error}</p>
              <button 
                onClick={fetchLocation} 
                className="mt-2 text-sm text-white/90 bg-red-500/40 px-5 py-2.5 rounded-lg font-medium hover:bg-red-500/60 transition-colors"
              >
                Reintentar
              </button>
            </div>
          ) : location ? (
            <div className="flex flex-col items-center text-center animate-in zoom-in-95 fade-in duration-700">
              <div className="flex items-center gap-2 text-[#74ACDF] mb-3 opacity-90">
                <Navigation className="w-4 h-4 -mt-0.5" />
                <span className="text-sm md:text-base font-semibold tracking-[0.2em] uppercase font-sans">
                  Distancia
                </span>
              </div>
              
              <div className="relative">
                <span className="text-7xl md:text-8xl font-black text-white tracking-tighter font-sans drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]" data-testid="text-distance">
                  {formattedDistance}
                </span>
                <span className="absolute -right-10 bottom-3 text-2xl font-bold text-[#74ACDF] drop-shadow-md">
                  km
                </span>
              </div>
              
              <p className="text-xl md:text-2xl text-white mt-4 font-serif italic font-medium drop-shadow-md">
                de Puerto Argentino
              </p>
              
              <div className="w-16 h-[3px] bg-[#74ACDF]/60 my-8 rounded-full" />
              
              <div className="flex flex-col items-center gap-1 bg-black/25 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md shadow-lg">
                <div className="text-white/80 text-xs md:text-sm font-medium flex gap-4 font-mono">
                  <span data-testid="text-latitude">
                    Lat: {location.lat >= 0 ? `${location.lat.toFixed(4)}° N` : `${Math.abs(location.lat).toFixed(4)}° S`}
                  </span>
                  <span className="text-white/30">|</span>
                  <span data-testid="text-longitude">
                    Lon: {location.lon >= 0 ? `${location.lon.toFixed(4)}° E` : `${Math.abs(location.lon).toFixed(4)}° O`}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
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
            {loading ? 'Actualizando...' : 'Actualizar ubicación'}
          </button>
          
          <button
            onClick={onShare}
            disabled={!location || loading || generatingStory}
            data-testid="button-share"
            className="w-full relative overflow-hidden group bg-[#74ACDF] hover:bg-[#5a93c7] active:bg-[#4a82b3] text-[#00143c] px-6 py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 transition-all duration-300 shadow-[0_4px_20px_rgba(116,172,223,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingStory ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Share2 className="w-5 h-5 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            )}
            {generatingStory ? 'Generando...' : 'Compartir historia'}
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
