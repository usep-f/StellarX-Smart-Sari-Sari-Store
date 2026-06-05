'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix for default Leaflet icon path issues in Next.js
const fixLeafletIcon = () => {
  // @ts-expect-error - Leaflet internal types
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

interface Store {
  owner: string;
  name: string;
  lat: number;
  lng: number;
}

interface MapProps {
  stores: Store[];
  userLocation?: [number, number] | null;
  onMapClick?: (lat: number, lng: number) => void;
  selectedLocation?: [number, number] | null;
}

export default function Map({
  stores,
  userLocation,
  onMapClick,
  selectedLocation,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    fixLeafletIcon();

    // Default center to Quezon City/Manila area
    const defaultCenter: [number, number] = [14.6507, 121.0506];
    const initialCenter = userLocation || defaultCenter;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 13,
      zoomControl: false,
    });

    // Add zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Premium Dark Mode Map Tiles (CartoDB Dark Matter)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Handle clicks on map for location selection
    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    // Force Leaflet to recalculate container size after rendering
    // This solves the single-tile display bug caused by Next.js dynamic/lazy loading.
    const resizeTimer = setTimeout(() => {
      if (map) {
        map.invalidateSize();
      }
    }, 250);

    return () => {
      clearTimeout(resizeTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [onMapClick, userLocation]);

  // Update center when user location is loaded
  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.setView(userLocation, 14);
      // Recalculate layout once view changes to ensure all tiles are fetched
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [userLocation]);

  // Render Stores and Geolocation Markers
  useEffect(() => {
    const map = mapRef.current;
    const markerGroup = markersRef.current;
    if (!map || !markerGroup) return;

    // Clear old store markers
    markerGroup.clearLayers();

    // Define store custom icon (Sunset Orange Glow)
    const storeIcon = L.divIcon({
      html: `
        <div class="w-8 h-8 rounded-full bg-[#ff7a00] border-2 border-white shadow-lg flex items-center justify-center text-white custom-marker">
          🏪
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Populate stores
    stores.forEach((store) => {
      const popupContent = `
        <div class="text-[#0b0f14] p-1">
          <h4 class="font-bold text-sm mb-1">${store.name}</h4>
          <p class="text-xs text-gray-500 font-mono mb-2">${store.owner.slice(0, 6)}...${store.owner.slice(-6)}</p>
          <a href="/customer?to=${store.owner}" class="inline-block bg-[#ff7a00] hover:bg-[#e06b00] text-white text-xs font-semibold px-2 py-1 rounded transition">
            Pay Store
          </a>
        </div>
      `;

      L.marker([store.lat, store.lng], { icon: storeIcon })
        .bindPopup(popupContent)
        .addTo(markerGroup);
    });

    // User Location Marker (Leaf Green Glow)
    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(userLocation);
      } else {
        const userIcon = L.divIcon({
          html: `
            <div class="w-6 h-6 rounded-full bg-[#00c853] border-2 border-white shadow-lg flex items-center justify-center text-white" style="box-shadow: 0 0 10px #00c853;">
              📍
            </div>
          `,
          className: 'user-location-icon',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        userMarkerRef.current = L.marker(userLocation, { icon: userIcon })
          .bindPopup('<div class="text-black font-semibold text-xs">Your Current Location</div>')
          .addTo(map);
      }
    }

    // Selected Pin Marker (Mango Yellow Glow)
    if (selectedLocation) {
      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.setLatLng(selectedLocation);
      } else {
        const pinIcon = L.divIcon({
          html: `
            <div class="w-8 h-8 rounded-full bg-[#ffc700] border-2 border-white shadow-lg flex items-center justify-center text-white" style="box-shadow: 0 0 10px #ffc700;">
              ✨
            </div>
          `,
          className: 'selected-pin-icon',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        selectedMarkerRef.current = L.marker(selectedLocation, { icon: pinIcon })
          .bindPopup('<div class="text-black font-semibold text-xs">Selected Registration Spot</div>')
          .addTo(map);
      }
    } else {
      if (selectedMarkerRef.current && map) {
        selectedMarkerRef.current.remove();
        selectedMarkerRef.current = null;
      }
    }
  }, [stores, userLocation, selectedLocation]);

  return (
    <div className="relative w-full h-full min-h-[350px] rounded-2xl overflow-hidden border border-card-border shadow-xl">
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px]" />
    </div>
  );
}
