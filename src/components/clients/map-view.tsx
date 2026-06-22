'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// إصلاح مشكلة أيقونات Leaflet الافتراضية مع Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  position: [number, number];
  setPosition: (pos: [number, number]) => void;
}

// مكون داخلي لتحريك الكاميرا عند تغيير الموقع
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center && map) {
      map.setView(center, 15, { animate: true });
    }
  }, [center, map]);
  return null;
}

// مكون داخلي لالتقاط النقرات على الخريطة
function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapView({ position, setPosition }: MapViewProps) {
  return (
    <MapContainer 
      center={position} 
      zoom={15} 
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <ChangeView center={position} />
      <MapEvents onMapClick={(lat, lng) => setPosition([lat, lng])} />
      <Marker position={position} />
    </MapContainer>
  );
}
