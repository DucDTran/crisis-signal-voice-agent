'use client';

import type { Map as MapLibreMap, Marker as MapLibreMarker } from 'maplibre-gl';
import { useEffect, useRef } from 'react';

export type LocationId = 'bridge' | 'station' | 'market' | 'university';

type MapStatus = 'idle' | 'reported' | 'verified';

type VinhMapProps = {
  status: MapStatus;
  waterLevelLabel: string | null;
  selectedLocation: LocationId;
};

const locations = [
  {
    id: 'bridge' as const,
    coordinates: [105.7082037, 18.6466265] as [number, number],
    kind: 'incident',
  },
  {
    id: 'station' as const,
    coordinates: [105.6644204, 18.6877002] as [number, number],
    kind: 'landmark',
  },
  {
    id: 'market' as const,
    coordinates: [105.6738416, 18.6630569] as [number, number],
    kind: 'landmark',
  },
  {
    id: 'university' as const,
    coordinates: [105.6952531, 18.6609333] as [number, number],
    kind: 'landmark',
  },
];

const simulatedFloodExtent = {
  type: 'Feature' as const,
  properties: {},
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [105.7047, 18.6515],
        [105.7074, 18.6518],
        [105.7103, 18.6488],
        [105.7101, 18.6458],
        [105.7072, 18.6448],
        [105.7048, 18.6474],
        [105.7047, 18.6515],
      ],
    ],
  },
};

export function VinhMap({
  status,
  waterLevelLabel,
  selectedLocation,
}: VinhMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Map<LocationId, MapLibreMarker>>(new Map());
  const waterLabelRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef(selectedLocation);
  const statusRef = useRef(status);
  const levelRef = useRef(waterLevelLabel);

  useEffect(() => {
    selectedRef.current = selectedLocation;
    statusRef.current = status;
    levelRef.current = waterLevelLabel;
  }, [selectedLocation, status, waterLevelLabel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const markers = markerRefs.current;

    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container,
        style: {
          version: 8,
          sources: {
            openStreetMap: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution:
                'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
            },
          },
          layers: [
            {
              id: 'open-street-map',
              type: 'raster',
              source: 'openStreetMap',
              paint: {
                'raster-saturation': -0.25,
                'raster-brightness-max': 0.78,
                'raster-contrast': 0.08,
              },
            },
          ],
        },
        center: [105.6878, 18.6638],
        zoom: 13,
        minZoom: 10.5,
        maxZoom: 17,
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
        map.addSource('simulated-flood-extent', {
          type: 'geojson',
          data: simulatedFloodExtent,
        });
        map.addLayer({
          id: 'simulated-flood-fill',
          type: 'fill',
          source: 'simulated-flood-extent',
          layout: {
            visibility: statusRef.current === 'idle' ? 'none' : 'visible',
          },
          paint: {
            'fill-color': '#3b91aa',
            'fill-opacity': statusRef.current === 'verified' ? 0.48 : 0.26,
          },
        });
        map.addLayer({
          id: 'simulated-flood-outline',
          type: 'line',
          source: 'simulated-flood-extent',
          layout: {
            visibility: statusRef.current === 'idle' ? 'none' : 'visible',
          },
          paint: {
            'line-color': '#7fc1d2',
            'line-width': 2,
            'line-opacity': 0.86,
            'line-dasharray': [2, 1.5],
          },
        });
      });

      for (const location of locations) {
        const markerElement = document.createElement('div');
        markerElement.className = `map-marker map-marker-${location.kind}`;
        markerElement.dataset.location = location.id;
        markerElement.classList.toggle(
          'is-selected',
          location.id === selectedRef.current,
        );
        if (location.id === 'bridge') {
          markerElement.dataset.status = statusRef.current;
        }
        markerElement.setAttribute('aria-hidden', 'true');
        markerElement.innerHTML = '<span class="map-marker-core"></span>';

        const mapMarker = new maplibregl.Marker({ element: markerElement })
          .setLngLat(location.coordinates)
          .addTo(map);
        markers.set(location.id, mapMarker);
      }

      const waterLabel = document.createElement('div');
      waterLabel.className = 'water-level-label';
      waterLabel.setAttribute('aria-hidden', 'true');
      waterLabel.innerHTML = `<span>Water level</span><strong>${levelRef.current ?? 'Depth unknown'}</strong><small>Simulated</small>`;
      waterLabel.hidden = statusRef.current === 'idle';
      waterLabelRef.current = waterLabel;
      new maplibregl.Marker({ element: waterLabel, anchor: 'bottom-left' })
        .setLngLat([105.7065, 18.6495])
        .addTo(map);

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markers.clear();
      waterLabelRef.current = null;
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

    const label = waterLabelRef.current;
    if (label) {
      label.hidden = status === 'idle';
      const value = label.querySelector('strong');
      if (value) value.textContent = waterLevelLabel ?? 'Depth unknown';
      label.dataset.status = status;
    }

    const map = mapRef.current;
    if (map?.getLayer('simulated-flood-fill')) {
      const visibility = status === 'idle' ? 'none' : 'visible';
      map.setLayoutProperty('simulated-flood-fill', 'visibility', visibility);
      map.setLayoutProperty(
        'simulated-flood-outline',
        'visibility',
        visibility,
      );
      map.setPaintProperty(
        'simulated-flood-fill',
        'fill-opacity',
        status === 'verified' ? 0.48 : 0.26,
      );
    }

    const target = locations.find((item) => item.id === selectedLocation);
    if (target && map) {
      map.easeTo({
        center: target.coordinates,
        zoom: selectedLocation === 'bridge' ? 14.3 : 13.5,
        duration: 600,
      });
    }
  }, [selectedLocation, status, waterLevelLabel]);

  return (
    <div className="relative h-[430px] overflow-hidden bg-[#10171a]">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="Map of Vinh City"
      />
      <div className="map-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-[#11181b]/92 px-3 py-2 shadow-xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d79b39]">
          Flood exercise map
        </p>
        <p className="mt-0.5 text-xs text-[#d9e1df]">Vinh City, Vietnam</p>
      </div>
      <div className="pointer-events-none absolute bottom-7 left-4 rounded-md border border-[#7fc1d2]/20 bg-[#10191c]/90 px-2.5 py-2 text-[10px] text-[#9fb5b2] shadow-lg">
        Blue area shows simulated flood extent
      </div>
    </div>
  );
}
