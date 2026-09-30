'use client';

import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  Popup as MapLibrePopup,
} from 'maplibre-gl';
import { useEffect, useRef } from 'react';

import { hazardLabels, type HazardType } from '@/lib/incidents';

type MapStatus = 'idle' | 'reported' | 'verified';
type Coordinates = [number, number];
type MapLibreModule = typeof import('maplibre-gl');

export type MapIncidentRecord = {
  id: string;
  source: string;
  coordinates: Coordinates | null;
  geocodedName: string | null;
  hazardType: HazardType;
  locationName: string;
  summary: string;
  severity: string;
  confidence: string;
  metricLabel: string;
  metricValue: string;
  access: string;
  trend: string;
  peopleAtRisk: string;
  injuries: string;
};

type VinhMapProps = {
  status: MapStatus;
  hazardType: HazardType;
  metricLabel: string;
  metricValue: string | null;
  incidentCoordinates: Coordinates | null;
  incidentRecords: MapIncidentRecord[];
  evidenceMode: 'simulation' | 'live';
};

type IncidentMarker = {
  marker: MapLibreMarker;
  popup: MapLibrePopup;
  element: HTMLDivElement;
};

const VINH_CENTER: Coordinates = [105.6878, 18.6638];

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

function circleExtent(center: Coordinates, radius = 0.0024) {
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

function incidentExtent(
  hazardType: HazardType,
  coordinates: Coordinates | null,
) {
  const radius = hazardType === 'tropical_storm' ? 0.0032 : 0.0022;
  return circleExtent(coordinates ?? VINH_CENTER, radius);
}

function locationKey(record: MapIncidentRecord) {
  return record.locationName.trim().toLocaleLowerCase('en-US');
}

function groupedGeocodedRecords(records: MapIncidentRecord[]) {
  const grouped = new Map<string, MapIncidentRecord[]>();
  for (const record of records) {
    if (!record.coordinates) continue;
    const key = locationKey(record);
    if (!key) continue;
    const current = grouped.get(key) ?? [];
    current.push(record);
    grouped.set(key, current);
  }
  return grouped;
}

function tooltipContent(records: MapIncidentRecord[]) {
  const root = document.createElement('div');
  root.className = 'incident-map-tooltip';
  if (records.length === 0) return root;

  const heading = document.createElement('strong');
  heading.className = 'incident-map-tooltip-title';
  heading.textContent = records[0].locationName;
  root.appendChild(heading);

  if (records[0].geocodedName) {
    const address = document.createElement('span');
    address.className = 'incident-map-tooltip-address';
    address.textContent = records[0].geocodedName;
    root.appendChild(address);
  }

  for (const record of records) {
    const incident = document.createElement('section');
    incident.className = 'incident-map-tooltip-record';
    const meta = document.createElement('span');
    meta.className = 'incident-map-tooltip-meta';
    meta.textContent = `${hazardLabels[record.hazardType]} · ${record.severity} severity · ${record.confidence} confidence`;
    const summary = document.createElement('p');
    summary.textContent = record.summary;
    const facts = document.createElement('dl');
    for (const [label, value] of [
      [record.metricLabel, record.metricValue],
      ['Access / trend', `${record.access} / ${record.trend}`],
      ['People at risk', record.peopleAtRisk],
      ['Injuries', record.injuries],
      ['Source', record.source],
    ]) {
      const term = document.createElement('dt');
      term.textContent = label;
      const description = document.createElement('dd');
      description.textContent = value;
      facts.appendChild(term);
      facts.appendChild(description);
    }
    incident.appendChild(meta);
    incident.appendChild(summary);
    incident.appendChild(facts);
    root.appendChild(incident);
  }
  return root;
}

function updateMarkerPresentation(
  marker: IncidentMarker,
  records: MapIncidentRecord[],
  selectedCoordinates: Coordinates | null,
) {
  const coordinates = records[0].coordinates;
  if (!coordinates) return;
  marker.marker.setLngLat(coordinates);
  marker.popup.setLngLat(coordinates).setDOMContent(tooltipContent(records));
  marker.element.dataset.status = records.some(
    (record) => record.confidence === 'high',
  )
    ? 'verified'
    : 'reported';
  marker.element.classList.toggle(
    'is-selected',
    Boolean(
      selectedCoordinates &&
      coordinates[0] === selectedCoordinates[0] &&
      coordinates[1] === selectedCoordinates[1],
    ),
  );
  marker.element.setAttribute(
    'aria-label',
    `Show incident details for ${records[0].locationName}`,
  );
}

function createIncidentMarker(
  maplibregl: MapLibreModule,
  map: MapLibreMap,
  records: MapIncidentRecord[],
  selectedCoordinates: Coordinates | null,
) {
  const coordinates = records[0].coordinates;
  if (!coordinates) return null;

  const element = document.createElement('div');
  element.className = 'map-marker map-marker-incident';
  element.tabIndex = 0;
  element.setAttribute('role', 'button');
  const core = document.createElement('span');
  core.className = 'map-marker-core';
  element.appendChild(core);

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 16,
    maxWidth: '390px',
  }).setDOMContent(tooltipContent(records));
  const marker = new maplibregl.Marker({ element })
    .setLngLat(coordinates)
    .addTo(map);
  let pinned = false;
  const openPopup = () => popup.setLngLat(coordinates).addTo(map);
  element.addEventListener('mouseenter', () => {
    if (!popup.isOpen()) openPopup();
  });
  element.addEventListener('mouseleave', () => {
    if (!pinned) popup.remove();
  });
  element.addEventListener('click', () => {
    pinned = !pinned;
    if (pinned) openPopup();
    else popup.remove();
  });
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    element.click();
  });

  const incidentMarker = { marker, popup, element };
  updateMarkerPresentation(incidentMarker, records, selectedCoordinates);
  return incidentMarker;
}

function synchronizeIncidentMarkers(
  maplibregl: MapLibreModule,
  map: MapLibreMap,
  markers: Map<string, IncidentMarker>,
  records: MapIncidentRecord[],
  selectedCoordinates: Coordinates | null,
) {
  const grouped = groupedGeocodedRecords(records);
  for (const [key, marker] of markers) {
    if (grouped.has(key)) continue;
    marker.popup.remove();
    marker.marker.remove();
    markers.delete(key);
  }
  for (const [key, locationRecords] of grouped) {
    const current = markers.get(key);
    if (current) {
      updateMarkerPresentation(current, locationRecords, selectedCoordinates);
      continue;
    }
    const marker = createIncidentMarker(
      maplibregl,
      map,
      locationRecords,
      selectedCoordinates,
    );
    if (marker) markers.set(key, marker);
  }
}

export function VinhMap({
  status,
  hazardType,
  metricLabel,
  metricValue,
  incidentCoordinates,
  incidentRecords,
  evidenceMode,
}: VinhMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const markerRefs = useRef<Map<string, IncidentMarker>>(new Map());
  const incidentLabelRef = useRef<HTMLDivElement | null>(null);
  const incidentLabelMarkerRef = useRef<MapLibreMarker | null>(null);
  const statusRef = useRef(status);
  const hazardRef = useRef(hazardType);
  const incidentCoordinatesRef = useRef(incidentCoordinates);
  const metricLabelRef = useRef(metricLabel);
  const metricValueRef = useRef(metricValue);
  const evidenceModeRef = useRef(evidenceMode);
  const incidentRecordsRef = useRef(incidentRecords);

  useEffect(() => {
    statusRef.current = status;
    hazardRef.current = hazardType;
    incidentCoordinatesRef.current = incidentCoordinates;
    metricLabelRef.current = metricLabel;
    metricValueRef.current = metricValue;
    evidenceModeRef.current = evidenceMode;
    incidentRecordsRef.current = incidentRecords;
  }, [
    evidenceMode,
    hazardType,
    incidentCoordinates,
    incidentRecords,
    metricLabel,
    metricValue,
    status,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const markers = markerRefs.current;

    void import('maplibre-gl').then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
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
        center: incidentCoordinatesRef.current ?? VINH_CENTER,
        zoom: incidentCoordinatesRef.current ? 14.3 : 13,
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
          data: incidentExtent(
            hazardRef.current,
            incidentCoordinatesRef.current,
          ),
        });
        const visibility =
          statusRef.current === 'idle' || !incidentCoordinatesRef.current
            ? 'none'
            : 'visible';
        map.addLayer({
          id: 'incident-extent-fill',
          type: 'fill',
          source: 'incident-extent',
          layout: { visibility },
          paint: {
            'fill-color': hazardColors[hazardRef.current],
            'fill-opacity': statusRef.current === 'verified' ? 0.46 : 0.25,
          },
        });
        map.addLayer({
          id: 'incident-extent-outline',
          type: 'line',
          source: 'incident-extent',
          layout: { visibility },
          paint: {
            'line-color': hazardColors[hazardRef.current],
            'line-width': 2.5,
            'line-opacity': 0.9,
            'line-dasharray': [2, 1.5],
          },
        });
      });

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
      incidentLabel.hidden =
        statusRef.current === 'idle' || !incidentCoordinatesRef.current;
      incidentLabelRef.current = incidentLabel;
      incidentLabelMarkerRef.current = new maplibregl.Marker({
        element: incidentLabel,
        anchor: 'bottom-left',
      })
        .setLngLat(incidentCoordinatesRef.current ?? VINH_CENTER)
        .addTo(map);

      mapRef.current = map;
      maplibreRef.current = maplibregl;
      synchronizeIncidentMarkers(
        maplibregl,
        map,
        markers,
        incidentRecordsRef.current,
        incidentCoordinatesRef.current,
      );
      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      for (const marker of markers.values()) {
        marker.popup.remove();
        marker.marker.remove();
      }
      markers.clear();
      incidentLabelRef.current = null;
      incidentLabelMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = maplibreRef.current;
    if (!map || !maplibregl) return;
    synchronizeIncidentMarkers(
      maplibregl,
      map,
      markerRefs.current,
      incidentRecords,
      incidentCoordinates,
    );

    const label = incidentLabelRef.current;
    if (label) {
      label.hidden = status === 'idle' || !incidentCoordinates;
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
    if (incidentCoordinates) {
      incidentLabelMarkerRef.current?.setLngLat(incidentCoordinates);
    }

    const source = map.getSource('incident-extent') as
      | GeoJSONSource
      | undefined;
    void source?.setData(incidentExtent(hazardType, incidentCoordinates));
    if (map.getLayer('incident-extent-fill')) {
      const visibility =
        status === 'idle' || !incidentCoordinates ? 'none' : 'visible';
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
    if (incidentCoordinates) {
      map.easeTo({ center: incidentCoordinates, zoom: 14.3, duration: 600 });
    }
  }, [
    evidenceMode,
    hazardType,
    incidentCoordinates,
    incidentRecords,
    metricLabel,
    metricValue,
    status,
  ]);

  return (
    <div className="relative h-full min-h-[430px] overflow-hidden bg-[#10171a]">
      <div
        ref={containerRef}
        className="absolute inset-0"
        aria-label="Map of Vinh City"
      />
      <div className="map-vignette pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-[#11181b]/92 px-3 py-2 shadow-xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d79b39]">
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
