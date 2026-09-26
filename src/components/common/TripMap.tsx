import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { TripPoint } from '../../types';
import { Navigation } from 'lucide-react';

// Configuração explícita do web worker para Vite/MapLibre v6
maplibregl.setWorkerUrl(maplibreWorkerUrl);

interface TripMapProps {
  points: TripPoint[];
  height?: string;
  className?: string;
}

export function TripMap({ points = [], height = '350px', className = '' }: TripMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Se já existe uma instância, não recria
    if (mapInstance.current) {
      updateMapData(mapInstance.current, points);
      return;
    }

    // Inicializar mapa MapLibre com tile OpenStreetMap gratuito
    const initialCenter: [number, number] = points.length > 0 
      ? [points[0].longitude, points[0].latitude] 
      : [-46.6333, -23.5505]; // São Paulo default

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: initialCenter,
      zoom: 13
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapInstance.current = map;

    map.on('load', () => {
      updateMapData(map, points);
    });

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Atualizar pontos quando a prop mudar
  useEffect(() => {
    if (mapInstance.current && mapInstance.current.loaded()) {
      updateMapData(mapInstance.current, points);
    }
  }, [points]);

  function updateMapData(map: maplibregl.Map, currentPoints: TripPoint[]) {
    // Remover source/layer prévios se existirem
    if (map.getLayer('route-line')) map.removeLayer('route-line');
    if (map.getSource('route')) map.removeSource('route');

    // Remover marcadores anteriores se guardados (ou limpar via DOM)
    const existingMarkers = document.querySelectorAll('.trip-marker');
    existingMarkers.forEach(m => m.remove());

    if (!currentPoints || currentPoints.length === 0) return;

    // Criar GeoJSON LineString
    const coordinates = currentPoints.map(p => [p.longitude, p.latitude]);

    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });

    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#2563eb', // blue-600
        'line-width': 5,
        'line-opacity': 0.85
      }
    });

    // Marcador Inicial (verde) e Final (vermelho/azul)
    const startPoint = currentPoints[0];
    const endPoint = currentPoints[currentPoints.length - 1];

    // Criar DOM element para Início
    const startEl = document.createElement('div');
    startEl.className = 'trip-marker w-6 h-6 bg-emerald-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-[10px] font-bold';
    startEl.title = `Início: Seq ${startPoint.sequence_number}`;
    startEl.innerHTML = 'I';
    new maplibregl.Marker({ element: startEl })
      .setLngLat([startPoint.longitude, startPoint.latitude])
      .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`<div class="p-2 text-slate-900 text-xs"><strong>Início do Trajeto</strong><br/>Seq: ${startPoint.sequence_number}<br/>Hora: ${new Date(startPoint.captured_at).toLocaleTimeString('pt-BR')}</div>`))
      .addTo(map);

    if (currentPoints.length > 1) {
      const endEl = document.createElement('div');
      endEl.className = 'trip-marker w-6 h-6 bg-blue-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-white text-[10px] font-bold';
      endEl.title = `Fim: Seq ${endPoint.sequence_number}`;
      endEl.innerHTML = 'F';
      new maplibregl.Marker({ element: endEl })
        .setLngLat([endPoint.longitude, endPoint.latitude])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`<div class="p-2 text-slate-900 text-xs"><strong>Fim do Trajeto</strong><br/>Seq: ${endPoint.sequence_number}<br/>Hora: ${new Date(endPoint.captured_at).toLocaleTimeString('pt-BR')}</div>`))
        .addTo(map);
    }

    // Ajustar bounds para abranger todos os pontos
    const bounds = new maplibregl.LngLatBounds();
    currentPoints.forEach(p => bounds.extend([p.longitude, p.latitude]));
    map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 800 });
  }

  if (!points || points.length === 0) {
    return (
      <div 
        style={{ height }} 
        className={`bg-slate-950 border border-slate-800 rounded-2xl flex flex-col items-center justify-center p-6 text-center text-slate-400 ${className}`}
      >
        <div className="p-3 bg-slate-900 rounded-xl text-slate-500 mb-2 border border-slate-800">
          <Navigation className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium text-slate-300">Trajeto GPS ainda não disponível.</p>
        <p className="text-xs text-slate-500 mt-1">Nenhum ponto geográfico foi registrado para esta viagem.</p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-800 ${className}`} style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
