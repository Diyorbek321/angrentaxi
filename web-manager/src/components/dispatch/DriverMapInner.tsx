'use client';

import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import { Driver, Order } from '@/lib/api';
import { formatRating, shortId } from '@/lib/format';
import { MAP_TILE_URL } from '@/lib/map-config';

import 'leaflet/dist/leaflet.css';

// Default Angren city center — used when no driver locations are available yet.
const DEFAULT_CENTER: [number, number] = [40.0956, 70.9432];

const MINT = '#1FCA8E';
const BUSY = '#94A3B8';
const DROPOFF = '#EF4444';

/** Mint car pin for free drivers, grey for drivers already on a trip. */
function carIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:26px;height:26px;border-radius:9px;background:${color};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 0 0 3px ${color}33, 0 2px 6px rgba(0,0,0,.35);
    "><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="#04231A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 17h2l-1.5-6.5a2 2 0 0 0-2-1.5h-11a2 2 0 0 0-2 1.5L3 17h2"/>
        <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>
      </svg></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function dotIcon(color: string, ring = true): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:14px;height:14px;border-radius:50%;background:${color};
      border:2px solid #fff;${ring ? `box-shadow:0 0 0 4px ${color}40;` : ''}
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const AVAILABLE_ICON = carIcon(MINT);
const BUSY_ICON = carIcon(BUSY);
const PICKUP_ICON = dotIcon(MINT);
const DROPOFF_ICON = dotIcon(DROPOFF);

/**
 * Recenters the map when the set of known driver locations changes, without
 * fighting the user's own pan/zoom on every single re-render. A selected
 * order takes priority — the operator wants to see that trip.
 */
function FitToPoints({ points, priority }: { points: [number, number][]; priority: [number, number][] }) {
  const map = useMap();
  const target = priority.length > 0 ? priority : points;

  useEffect(() => {
    if (target.length === 0) return;
    if (target.length === 1) {
      map.setView(target[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(target), { padding: [48, 48] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(target)]);

  return null;
}

interface DriverMapInnerProps {
  drivers: Driver[];
  /** When set, its pickup/dropoff and route line are drawn over the drivers. */
  selectedOrder?: Order | null;
}

export default function DriverMapInner({ drivers, selectedOrder = null }: DriverMapInnerProps) {
  const located = drivers.filter(
    (d): d is Driver & { location: NonNullable<Driver['location']> } => !!d.location
  );
  const points: [number, number][] = located.map((d) => [d.location.lat, d.location.lng]);

  // GeoJSON stores [lng, lat]; Leaflet wants [lat, lng].
  const pickup = selectedOrder?.pickupLocation?.coordinates
    ? ([selectedOrder.pickupLocation.coordinates[1], selectedOrder.pickupLocation.coordinates[0]] as [number, number])
    : null;
  const dropoff = selectedOrder?.dropoffLocation?.coordinates
    ? ([selectedOrder.dropoffLocation.coordinates[1], selectedOrder.dropoffLocation.coordinates[0]] as [number, number])
    : null;

  const routePoints = [pickup, dropoff].filter(Boolean) as [number, number][];

  return (
    <MapContainer center={points[0] ?? DEFAULT_CENTER} zoom={13} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url={MAP_TILE_URL}
        tileSize={512}
        zoomOffset={-1}
        minZoom={1}
      />
      <FitToPoints points={points} priority={routePoints} />

      {located.map((driver) => (
        <Marker
          key={driver.id}
          position={[driver.location.lat, driver.location.lng]}
          icon={driver.currentOrderId ? BUSY_ICON : AVAILABLE_ICON}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">{driver.name}</p>
              <p>
                {driver.carModel} · {driver.carNumber}
              </p>
              <p>
                {driver.currentOrderId ? 'Band' : 'Boʻsh'} · ⭐ {formatRating(driver.rating)}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {routePoints.length === 2 && (
        <Polyline positions={routePoints} pathOptions={{ color: MINT, weight: 3, dashArray: '6 8', opacity: 0.9 }} />
      )}

      {pickup && (
        <Marker position={pickup} icon={PICKUP_ICON}>
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">Olib ketish</p>
              <p>{selectedOrder?.pickupAddress ?? '—'}</p>
              <p>{selectedOrder ? shortId(selectedOrder.id) : ''}</p>
            </div>
          </Popup>
        </Marker>
      )}

      {dropoff && (
        <Marker position={dropoff} icon={DROPOFF_ICON}>
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">Tashlab ketish</p>
              <p>{selectedOrder?.dropoffAddress ?? '—'}</p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
