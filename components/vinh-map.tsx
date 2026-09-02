'use client';

import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import {
  hazardLabels,
  type HazardType,
  type LocationId,
} from '@/lib/incidents';

export type { LocationId } from '@/lib/incidents';

type KnownLocationId = Exclude<LocationId, 'unknown'>;
type MapStatus = 'idle' | 'reported' | 'verified';

type VinhMapProps = {
  status: MapStatus;
  hazardType: HazardType;
  metricLabel: string;
  metricValue: string | null;
  selectedLocation: KnownLocationId;
  incidentLocation: LocationId;
  activeIncidentLocations: LocationId[];
  evidenceMode: 'simulation' | 'live';
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
  {
    id: 'mountain' as const,
    coordinates: [105.6993583, 18.6467128] as [number, number],
    kind: 'landmark',
  },
];

const hazardColors: Record<HazardType, string> = {
  flood: '#3b91aa',
  tropical_storm: '#8062a9',
  landslide: '#bd773d',
  earthquake: '#c45f4c',
  wildfire: '#d1703f',
  building_collapse: '#b36f55',
  other: '#718e91',
  unknown: '#718e91',
};

function findLocation(id: LocationId) {
  return locations.find((location) => location.id === id);
}

function circleExtent(center: [number, number], radius = 0.0024) {
  const coordinates = Array.from({ length: 25 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 24;
    return [
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius * 0.82,
    ];
  });
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
  };
}

function incidentExtent(hazardType: HazardType, locationId: LocationId) {
  if (hazardType === 'flood' && locationId === 'bridge') {
    return {
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
  }

  const location = findLocation(locationId) ?? locations[0];
  return circleExtent(
    location.coordinates,
    hazardType === 'tropical_storm' ? 0.0032 : 0.0022,
  );
}

export function VinhMap({
  status,
  hazardType,
  metricLabel,
  metricValue,
  selectedLocation,
  incidentLocation,
  activeIncidentLocations,
  evidenceMode,
}: VinhMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Map<KnownLocationId, MapLibreMarker>>(new Map());
  const incidentLabelRef = useRef<HTMLDivElement | null>(null);
  const incidentLabelMarkerRef = useRef<MapLibreMarker | null>(null);
  const selectedRef = useRef(selectedLocation);
  const statusRef = useRef(status);
  const hazardRef = useRef(hazardType);
  const incidentLocationRef = useRef(incidentLocation);
  const metricLabelRef = useRef(metricLabel);
  const metricValueRef = useRef(metricValue);
  const evidenceModeRef = useRef(evidenceMode);
  const activeIncidentLocationsRef = useRef(activeIncidentLocations);

  useEffect(() => {
    selectedRef.current = selectedLocation;
    statusRef.current = status;
    hazardRef.current = hazardType;
    incidentLocationRef.current = incidentLocation;
    metricLabelRef.current = metricLabel;
    metricValueRef.current = metricValue;
    evidenceModeRef.current = evidenceMode;
    activeIncidentLocationsRef.current = activeIncidentLocations;
  }, [
    evidenceMode,
    hazardType,
    incidentLocation,
    metricLabel,
    metricValue,
    selectedLocation,
    status,
    activeIncidentLocations,
  ]);

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
        map.addSource('incident-extent', {
          type: 'geojson',
          data: incidentExtent(hazardRef.current, incidentLocationRef.current),
        });
        map.addLayer({
          id: 'incident-extent-fill',
          type: 'fill',
          source: 'incident-extent',
          layout: {
            visibility: statusRef.current === 'idle' ? 'none' : 'visible',
          },
          paint: {
            'fill-color': hazardColors[hazardRef.current],
            'fill-opacity': statusRef.current === 'verified' ? 0.46 : 0.25,
          },
        });
        map.addLayer({
          id: 'incident-extent-outline',
          type: 'line',
          source: 'incident-extent',
          layout: {
            visibility: statusRef.current === 'idle' ? 'none' : 'visible',
          },
          paint: {
            'line-color': hazardColors[hazardRef.current],
            'line-width': 2.5,
            'line-opacity': 0.9,
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
        if (activeIncidentLocationsRef.current.includes(location.id)) {
          markerElement.dataset.status = statusRef.current;
        }
        markerElement.setAttribute('aria-hidden', 'true');
        const core = document.createElement('span');
        core.className = 'map-marker-core';
        markerElement.appendChild(core);

        const mapMarker = new maplibregl.Marker({ element: markerElement })
          .setLngLat(location.coordinates)
          .addTo(map);
        markers.set(location.id, mapMarker);
      }

      const incidentLabel = document.createElement('div');
      incidentLabel.className = 'water-level-label';
      incidentLabel.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = metricLabelRef.current;
      const value = document.createElement('strong');
      value.textContent = metricValueRef.current ?? 'Awaiting measurement';
      const source = document.createElement('small');
      source.textContent =
        evidenceModeRef.current === 'live' ? 'AI extracted' : 'Simulated';
      incidentLabel.appendChild(label);
      incidentLabel.appendChild(value);
      incidentLabel.appendChild(source);
      incidentLabel.hidden = statusRef.current === 'idle';
      incidentLabelRef.current = incidentLabel;

      const labelLocation =
        findLocation(incidentLocationRef.current) ?? locations[0];
      incidentLabelMarkerRef.current = new maplibregl.Marker({
        element: incidentLabel,
        anchor: 'bottom-left',
      })
        .setLngLat(labelLocation.coordinates)
        .addTo(map);

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      markers.clear();
      incidentLabelRef.current = null;
      incidentLabelMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    for (const [id, marker] of markerRefs.current) {
      const element = marker.getElement();
      element.classList.toggle('is-selected', id === selectedLocation);
      if (activeIncidentLocations.includes(id)) element.dataset.status = status;
      else delete element.dataset.status;
    }

    const label = incidentLabelRef.current;
    if (label) {
      label.hidden = status === 'idle';
      const name = label.querySelector('span');
      const value = label.querySelector('strong');
      const source = label.querySelector('small');
      if (name) name.textContent = metricLabel;
      if (value) value.textContent = metricValue ?? 'Awaiting measurement';
      if (source) {
        source.textContent =
          evidenceMode === 'live' ? 'AI extracted' : 'Simulated';
      }
      label.dataset.status = status;
    }

    const incidentTarget = findLocation(incidentLocation);
    if (incidentTarget) {
      incidentLabelMarkerRef.current?.setLngLat(incidentTarget.coordinates);
    }

    const map = mapRef.current;
    const source = map?.getSource('incident-extent') as
      | GeoJSONSource
      | undefined;
    void source?.setData(incidentExtent(hazardType, incidentLocation));
    if (map?.getLayer('incident-extent-fill')) {
      const visibility = status === 'idle' ? 'none' : 'visible';
      map.setLayoutProperty('incident-extent-fill', 'visibility', visibility);
      map.setLayoutProperty(
        'incident-extent-outline',
        'visibility',
        visibility,
      );
      map.setPaintProperty(
        'incident-extent-fill',
        'fill-color',
        hazardColors[hazardType],
      );
      map.setPaintProperty(
        'incident-extent-outline',
        'line-color',
        hazardColors[hazardType],
      );
      map.setPaintProperty(
        'incident-extent-fill',
        'fill-opacity',
        status === 'verified' ? 0.46 : 0.25,
      );
    }

    const selectedTarget = findLocation(selectedLocation);
    if (selectedTarget && map) {
      map.easeTo({
        center: selectedTarget.coordinates,
        zoom: selectedLocation === 'bridge' ? 14.3 : 14,
        duration: 600,
      });
    }
  }, [
    evidenceMode,
    activeIncidentLocations,
    hazardType,
    incidentLocation,
    metricLabel,
    metricValue,
    selectedLocation,
    status,
  ]);

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
          Multi-hazard exercise map
        </p>
        <p className="mt-0.5 text-xs text-[#d9e1df]">
          {hazardLabels[hazardType]} · Vinh City, Vietnam
        </p>
      </div>
      <div className="pointer-events-none absolute bottom-7 left-4 rounded-md border border-[#7fc1d2]/20 bg-[#10191c]/90 px-2.5 py-2 text-[10px] text-[#9fb5b2] shadow-lg">
        Colored area is an illustrative impact zone
      </div>
    </div>
  );
}
