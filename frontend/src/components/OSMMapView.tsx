import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { RouteLineString } from '../types';

const defaultCenter: LngLatLike = [-122.4194, 37.7749];

type DriverMarker = { id: string; lat?: number | null; lng?: number | null; isAi: boolean };

type Props = {
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  drivers: DriverMarker[];
  routeGeoJson: RouteLineString | null;
  onMapClick: (lat: number, lng: number) => void;
};

export function OSMMapView({ pickup, dropoff, drivers, routeGeoJson, onMapClick }: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm'
          }
        ]
      },
      center: defaultCenter,
      zoom: 12
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    map.on('click', (e) => {
      onMapClick(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('load', () => {
      if (!map.getSource('route')) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          paint: {
            'line-color': '#f59e0b',
            'line-width': 4
          }
        });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onMapClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const center = pickup ? ([pickup.lng, pickup.lat] as [number, number]) : defaultCenter;
    map.easeTo({ center, duration: 800 });
  }, [pickup]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (pickup) {
      const el = document.createElement('div');
      el.className = 'marker pickup';
      el.textContent = 'P';
      const point: [number, number] = [pickup.lng, pickup.lat];
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(point).addTo(map));
    }

    if (dropoff) {
      const el = document.createElement('div');
      el.className = 'marker dropoff';
      el.textContent = 'D';
      const point: [number, number] = [dropoff.lng, dropoff.lat];
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(point).addTo(map));
    }

    drivers.forEach((d) => {
      if (d.lat == null || d.lng == null) return;
      const el = document.createElement('div');
      el.className = `marker driver ${d.isAi ? 'ai' : 'human'}`;
      el.textContent = d.isAi ? 'AI' : 'DR';
      const point: [number, number] = [d.lng, d.lat];
      markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat(point).addTo(map));
    });
  }, [pickup, dropoff, drivers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('route') as GeoJSONSource | undefined;
    if (!source) return;

    source.setData({
      type: 'FeatureCollection',
      features: routeGeoJson
        ? [
            {
              type: 'Feature',
              geometry: routeGeoJson,
              properties: {}
            }
          ]
        : []
    });
  }, [routeGeoJson]);

  return <div className="map" ref={mapContainerRef} />;
}
