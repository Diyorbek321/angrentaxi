'use client';

import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import { MAP_COLORS } from '@/lib/constants';
import { MAP_TILE_URL } from '@/lib/map-config';
import 'leaflet/dist/leaflet.css';

interface EvidenceMapInnerProps {
  points: Array<[number, number]>;
  sos: Array<[number, number]>;
}

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [24, 24], maxZoom: 16 });
  }, [map, points]);
  return null;
}

/** Safar GPS izi (polyline) + boshi/oxiri + SOS nuqtalari — dalillar bo'limi uchun. */
export default function EvidenceMapInner({ points, sos }: EvidenceMapInnerProps) {
  const all = [...points, ...sos];
  const center = all[0] ?? [40.0956, 70.9432];
  return (
    <MapContainer center={center} zoom={14} className="h-72 w-full rounded-ds-md" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={MAP_TILE_URL}
        tileSize={512}
        zoomOffset={-1}
        minZoom={1}
      />
      <FitBounds points={all} />
      {points.length > 1 && <Polyline positions={points} pathOptions={{ color: MAP_COLORS.route, weight: 4 }} />}
      {points.length > 0 && (
        <CircleMarker center={points[0]} radius={6} pathOptions={{ color: MAP_COLORS.available, fillOpacity: 1 }} />
      )}
      {points.length > 1 && (
        <CircleMarker
          center={points[points.length - 1]}
          radius={6}
          pathOptions={{ color: MAP_COLORS.markerInk, fillOpacity: 1 }}
        />
      )}
      {sos.map((p, i) => (
        <CircleMarker key={`sos-${i}`} center={p} radius={9} pathOptions={{ color: MAP_COLORS.dropoff, fillOpacity: 0.8 }} />
      ))}
    </MapContainer>
  );
}
