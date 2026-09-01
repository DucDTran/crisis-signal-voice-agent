'use client';

import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

export type LocationId = 'bridge' | 'station' | 'market' | 'university';

type VinhMapProps = {
  status: 'reported' | 'verified';
  selectedLocation: LocationId;
  onSelectLocation: (location: LocationId) => void;
};

const locations = [
  {
    id: 'bridge' as const,
    name: 'Cầu Bến Thủy 1',
    english: 'Ben Thuy Bridge 1',
    coordinates: [105.7082037, 18.6466265] as [number, number],
    kind: 'incident',
  },
  {
    id: 'station' as const,
    name: 'Ga Vinh',
    english: 'Vinh Railway Station',
    coordinates: [105.6644204, 18.6877002] as [number, number],
    kind: 'landmark',
  },
  {
    id: 'market' as const,
    name: 'Chợ Vinh',
    english: 'Vinh Market',
    coordinates: [105.6738416, 18.6630569] as [number, number],
    kind: 'landmark',
  },
  {
    id: 'university' as const,
    name: 'Đại học Vinh',
    english: 'Vinh University',
    coordinates: [105.6952531, 18.6609333] as [number, number],
    kind: 'landmark',
  },
];

export function VinhMap({
  status,
  selectedLocation,
  onSelectLocation,
}: VinhMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Map<LocationId, MapLibreMarker>>(new Map());
  const onSelectRef = useRef(onSelectLocation);
  const selectedRef = useRef(selectedLocation);
  const statusRef = useRef(status);

  useEffect(() => {
    onSelectRef.current = onSelectLocation;
    selectedRef.current = selectedLocation;
    statusRef.current = status;
  }, [onSelectLocation, selectedLocation, status]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    const markers = markerRefs.current;

    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [105.6863, 18.6657],
        zoom: 12.8,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        'top-left',
      );
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        'bottom-right',
      );

      map.on('load', () => {
        map.addSource('exercise-route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: [
                [105.6644204, 18.6877002],
                [105.6738416, 18.6630569],
                [105.6952531, 18.6609333],
                [105.7082037, 18.6466265],
              ],
            },
          },
        });
        map.addLayer({
          id: 'exercise-route-line',
          type: 'line',
          source: 'exercise-route',
          paint: {
            'line-color': '#d79b39',
            'line-width': 3,
            'line-opacity': 0.72,
            'line-dasharray': [1.5, 1.5],
          },
        });
      });

      for (const location of locations) {
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = `map-marker map-marker-${location.kind}`;
        marker.dataset.location = location.id;
        marker.classList.toggle(
          'is-selected',
          location.id === selectedRef.current,
        );
        if (location.id === 'bridge') marker.dataset.status = statusRef.current;
        marker.setAttribute(
          'aria-label',
          `${location.name}, ${location.english}`,
        );
        marker.innerHTML = '<span class="map-marker-core"></span>';
        marker.addEventListener('click', () =>
          onSelectRef.current(location.id),
        );

        const mapMarker = new maplibregl.Marker({ element: marker })
          .setLngLat(location.coordinates)
          .setPopup(
            new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
              `<strong>${location.name}</strong><span>${location.english}</span>`,
            ),
          )
          .addTo(map);

        markers.set(location.id, mapMarker);
      }

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      markers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    for (const [id, marker] of markerRefs.current) {
      const element = marker.getElement();
      element.classList.toggle('is-selected', id === selectedLocation);
      if (id === 'bridge') element.dataset.status = status;
    }

    const target = locations.find((item) => item.id === selectedLocation);
    if (target && mapRef.current) {
      if (mapRef.current.getLayer('exercise-route-line')) {
        mapRef.current.setPaintProperty(
          'exercise-route-line',
          'line-color',
          status === 'verified' ? '#dd644c' : '#d79b39',
        );
        mapRef.current.setPaintProperty(
          'exercise-route-line',
          'line-opacity',
          status === 'verified' ? 0.38 : 0.72,
        );
      }
      mapRef.current.easeTo({
        center: target.coordinates,
        zoom: selectedLocation === 'bridge' ? 14.2 : 13.4,
        duration: 650,
      });
    }
  }, [selectedLocation, status]);

  return (
    <div className="relative h-full min-h-[390px] overflow-hidden bg-[#10171a]">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="Map of Vinh City"
      />
      <div className="map-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-[#11181b]/92 px-3 py-2 shadow-xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d79b39]">
          Simulation map
        </p>
        <p className="mt-0.5 text-xs text-[#d9e1df]">Vinh City, Nghệ An</p>
      </div>
    </div>
  );
}
