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
  onStoreSelect?: (store: Store) => void;
}

export default function Map({
  stores,
  userLocation,
  onMapClick,
  selectedLocation,
  onStoreSelect,
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
      markersRef.current = null;
      userMarkerRef.current = null;
      selectedMarkerRef.current = null;
    };
  }, [onMapClick, userLocation]);

  // Update center when user location is loaded
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mapRef.current && userLocation) {
      mapRef.current.setView(userLocation, 14);
      // Recalculate layout once view changes to ensure all tiles are fetched
      timer = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (mapRef.current && (mapRef.current as any)._container) {
          mapRef.current.invalidateSize();
        }
      }, 100);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
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
        <div class="text-[#080a11] p-1">
          <h4 class="font-bold text-sm mb-1 text-white">${store.name}</h4>
          <p class="text-xs text-gray-400 font-mono mb-2">${store.owner.slice(0, 6)}...${store.owner.slice(-6)}</p>
          <a href="/customer?to=${store.owner}" class="inline-block bg-[#ff7a00] hover:bg-[#e06b00] text-white text-xs font-semibold px-2 py-1 rounded transition">
            Pay Store
          </a>
        </div>
      `;

      const marker = L.marker([store.lat, store.lng], { icon: storeIcon });
      
      if (onStoreSelect) {
        marker.on('click', () => {
          onStoreSelect(store);
        });
      } else {
        marker.bindPopup(popupContent);
      }
      
      marker.addTo(markerGroup);
    });

    // User Location Marker (Leaf Green Glow)
    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng(userLocation);
      } else {
        const userIcon = L.divIcon({
          html: `
            <div class="w-6 h-6 rounded-full bg-[#00f0ff] border-2 border-white shadow-lg flex items-center justify-center text-white user-location-marker">
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
  }, [stores, userLocation, selectedLocation, onStoreSelect]);

  return (
    <div className="relative w-full h-full min-h-[350px] rounded-2xl overflow-hidden border border-card-border shadow-xl">
      <div ref={mapContainerRef} className="w-full h-full min-h-[350px]" />
    </div>
  );
}
