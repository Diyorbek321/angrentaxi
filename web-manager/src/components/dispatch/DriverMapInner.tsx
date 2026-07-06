'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import { Driver } from '@/lib/api';

import 'leaflet/dist/leaflet.css';

// Default Angren city center — used when no driver locations are available yet.
const DEFAULT_CENTER: [number, number] = [40.0956, 70.9432];

function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 16px; height: 16px; border-radius: 50%;
      background: ${color}; border: 2px solid #0B1220;
      box-shadow: 0 0 0 2px ${color}55;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const AVAILABLE_ICON = pinIcon('#10B981');
const BUSY_ICON = pinIcon('#F59E0B');

// Recenters the map when the set of known driver locations changes, without
// fighting the user's own pan/zoom on every single re-render.
function FitToDrivers({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  return null;
}

interface DriverMapInnerProps {
  drivers: Driver[];
}

export default function DriverMapInner({ drivers }: DriverMapInnerProps) {
  const located = drivers.filter((d): d is Driver & { location: NonNullable<Driver['location']> } => !!d.location);
  const points: [number, number][] = located.map((d) => [d.location.lat, d.location.lng]);

  return (
    <MapContainer
      center={points[0] ?? DEFAULT_CENTER}
      zoom={13}
      className="h-full w-full"
      style={{ background: '#0B1220' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToDrivers points={points} />
      {located.map((driver) => (
        <Marker
          key={driver.id}
          position={[driver.location.lat, driver.location.lng]}
          icon={driver.currentOrderId ? BUSY_ICON : AVAILABLE_ICON}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">{driver.name}</p>
              <p>{driver.carModel} · {driver.carNumber}</p>
              <p>{driver.currentOrderId ? 'On trip' : 'Available'} · ⭐ {driver.rating.toFixed(1)}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
