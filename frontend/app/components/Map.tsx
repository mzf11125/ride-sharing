"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type SelectionMode = "pickup" | "destination" | null;

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

interface MapProps {
  center?: [number, number];
  zoom?: number;
  pickup?: Location;
  destination?: Location;
  height?: string;
  selectionMode?: SelectionMode;
  onLocationSelect?: (latitude: number, longitude: number) => void;
}

// Custom icons for pickup and destination
const createIcon = (color: string) =>
  new L.Icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${color}'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    shadowSize: [32, 32],
    shadowAnchor: [16, 32],
  });

const pickupIcon = createIcon("%2322c55e"); // green-500
const destinationIcon = createIcon("%23ef4444"); // red-500

function MapClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapController({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom ?? 13);
    }
  }, [center, zoom, map]);

  return null;
}

export default function Map({
  center = [51.505, -0.09], // Default: London
  zoom = 13,
  pickup,
  destination,
  height = "400px",
  selectionMode,
  onLocationSelect,
}: MapProps) {
  const pickupPosition: [number, number] | null = pickup
    ? [pickup.latitude, pickup.longitude]
    : null;
  const destinationPosition: [number, number] | null = destination
    ? [destination.latitude, destination.longitude]
    : null;

  return (
    <div style={{ height, width: "100%" }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
      >
        <MapController center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {selectionMode && onLocationSelect && (
          <MapClickHandler onClick={onLocationSelect} />
        )}
        {pickupPosition && pickup && (
          <Marker position={pickupPosition} icon={pickupIcon}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-green-600">Pickup Location</div>
                <div>{pickup.address || `${pickup.latitude.toFixed(4)}, ${pickup.longitude.toFixed(4)}`}</div>
              </div>
            </Popup>
          </Marker>
        )}
        {destinationPosition && destination && (
          <Marker position={destinationPosition} icon={destinationIcon}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-red-600">Destination</div>
                <div>{destination.address || `${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}`}</div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
