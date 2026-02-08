import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAlien, usePayment } from '@alien_org/react';
import {
  acceptRide,
  authAlien,
  completeRide,
  createAlienInvoice,
  createDriver,
  listDrivers,
  listOpenRides,
  requestRide,
  startRide,
  updateDriverLocation,
  type UserRole
} from './api';
import { Header } from './components/Header';
import { OSMMapView } from './components/OSMMapView';
import { DriverPanel } from './components/DriverPanel';
import { RoleGate, type Persona, type Mode } from './components/RoleGate';
import { RidePanel } from './components/RidePanel';
import { StatusBar } from './components/StatusBar';
import type { RouteLineString } from './types';
import './styles/app.css';

export type RideStatus =
  | 'IDLE'
  | 'REQUESTING'
  | 'MATCHING'
  | 'DRIVER_ASSIGNED'
  | 'EN_ROUTE'
  | 'IN_RIDE'
  | 'COMPLETED'
  | 'CANCELLED';

export type Ride = {
  id: string;
  pickup: string;
  dropoff: string;
  status: RideStatus;
  etaMinutes?: number;
  driverName?: string;
  vehicle?: string;
  fareCents?: number;
};

const initialRide: Ride = {
  id: 'local-ride',
  pickup: 'Current Location',
  dropoff: 'Select destination',
  status: 'IDLE'
};

export default function App() {
  const alien = useAlien();
  const authToken = alien.authToken ?? '';
  const isBridgeAvailable = alien.isBridgeAvailable ?? false;
  const payment = usePayment();
  const [userName, setUserName] = useState<string>('Rider');
  const [userId, setUserId] = useState<string>('');
  const [role, setRole] = useState<UserRole>('RIDER');
  const [persona, setPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverIsAi, setDriverIsAi] = useState<boolean>(false);
  const [vehicle, setVehicle] = useState<string>('Alien EV • 42-AZ');
  const [ride, setRide] = useState<Ride>(initialRide);
  const [destination, setDestination] = useState('');
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [drivers, setDrivers] = useState<
    { id: string; isAi: boolean; vehicle: string; lat?: number | null; lng?: number | null }[]
  >([]);
  const [openRides, setOpenRides] = useState<
    { id: string; pickupLat: number; pickupLng: number; dropLat: number; dropLng: number; status: string }[]
  >([]);
  const [routeGeoJson, setRouteGeoJson] = useState<RouteLineString | null>(null);
  const [routeSteps, setRouteSteps] = useState<string[]>([]);
  const [statusNote, setStatusNote] = useState<string>('');
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!authToken) {
      setStatusNote('Open in Alien Mini App to authenticate');
      return () => {
        mounted = false;
      };
    }
    authAlien({ token: authToken, role })
      .then((res) => {
        if (!mounted) return;
        setUserId(res.user.id);
        setUserName(res.user.name ?? 'Rider');
        setDriverId(res.user.driver?.id ?? null);
      })
      .catch(() => {
        setStatusNote('Backend offline — running in demo mode');
      });
    return () => {
      mounted = false;
    };
  }, [authToken]);

  useEffect(() => {
    if (!pickup) return;
    listDrivers(pickup.lat, pickup.lng)
      .then((res) => setDrivers(res.drivers))
      .catch(() => setDrivers([]));
  }, [pickup]);

  useEffect(() => {
    if (role !== 'DRIVER') return;
    const interval = setInterval(() => {
      listOpenRides()
        .then((res) => setOpenRides(res.rides))
        .catch(() => setOpenRides([]));
    }, 5000);
    return () => clearInterval(interval);
  }, [role]);

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000');
    }
    const socket = socketRef.current;
    socket.on('ride:update', (payload: Ride) => {
      if (payload.id === ride.id) {
        setRide((r) => ({ ...r, ...payload }));
      }
    });
    return () => {
      socket.off('ride:update');
    };
  }, [ride.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setPickup({ lat: 37.7749, lng: -122.4194 });
      }
    );
  }, []);

  const canRequest = useMemo(
    () => destination.trim().length > 2 && !!pickup && !!dropoff,
    [destination, pickup, dropoff]
  );

  useEffect(() => {
    const controller = new AbortController();
    async function fetchDirections() {
      if (!pickup || !dropoff) {
        setRouteGeoJson(null);
        setRouteSteps([]);
        return;
      }
      const baseUrl = import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org';
      const url = `${baseUrl}/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson&steps=true`;
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const route = data.routes?.[0];
        if (!route) return;
        setRouteGeoJson(route.geometry);
        const steps =
          route.legs?.[0]?.steps?.map((step: { name: string; maneuver: { type: string; modifier?: string } }) => {
            const mod = step.maneuver.modifier ? ` ${step.maneuver.modifier}` : '';
            const name = step.name ? ` onto ${step.name}` : '';
            return `${step.maneuver.type}${mod}${name}`;
          }) ?? [];
        setRouteSteps(steps);
      } catch {
        setRouteGeoJson(null);
        setRouteSteps([]);
      }
    }

    fetchDirections();
    return () => controller.abort();
  }, [pickup, dropoff]);

  async function requestRideAction() {
    if (!canRequest) return;
    if (!pickup || !dropoff || !userId) return;
    try {
      const res = await requestRide({
        riderId: userId,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropLat: dropoff.lat,
        dropLng: dropoff.lng,
        fareCents: 1200
      });
      setRide({
        id: res.ride.id,
        pickup: 'Current Location',
        dropoff: destination,
        status: res.ride.status,
        etaMinutes: 6,
        fareCents: res.ride.fareCents
      });
    } catch {
      setStatusNote('Backend offline — using local ride flow');
      setRide({
        id: 'demo-ride',
        pickup: 'Current Location',
        dropoff: destination,
        status: 'MATCHING',
        etaMinutes: 6,
        fareCents: 1200
      });
    }
  }

  function assignDriver() {
    setRide((r) => ({
      ...r,
      status: 'DRIVER_ASSIGNED',
      driverName: 'Ari Nova',
      vehicle: 'Alien EV • 42-AZ',
      etaMinutes: 4
    }));
  }

  async function startRideAction() {
    if (!ride.id) return;
    try {
      const res = await startRide(ride.id);
      setRide((r) => ({ ...r, status: res.ride.status, etaMinutes: 12 }));
    } catch {
      setStatusNote('Backend offline — local ride started');
      setRide((r) => ({ ...r, status: 'IN_RIDE', etaMinutes: 12 }));
    }
  }

  async function completeRideAction() {
    if (!ride.id) return;
    try {
      const res = await completeRide(ride.id);
      setRide((r) => ({ ...r, status: res.ride.status, etaMinutes: 0 }));
    } catch {
      setStatusNote('Backend offline — local ride completed');
      setRide((r) => ({ ...r, status: 'COMPLETED', etaMinutes: 0 }));
    }
  }

  async function payWithAlienAction() {
    if (!authToken || !ride.id) return;
    try {
      const invoiceRes = await createAlienInvoice({
        token: authToken,
        amount: '1200',
        rideId: ride.id
      });
      await payment.pay({
        recipient: invoiceRes.recipient,
        amount: invoiceRes.amount,
        network: 'alien',
        token: 'ALIEN',
        invoice: invoiceRes.invoice
      });
      setStatusNote('Payment successful');
    } catch {
      setStatusNote('Payment failed or cancelled');
    }
    setTimeout(() => setStatusNote(''), 2000);
  }

  function resetRide() {
    setRide(initialRide);
    setDestination('');
  }

  async function toggleRole(next: UserRole) {
    setRole(next);
    if (!authToken) return;
    try {
      const res = await authAlien({ token: authToken, role: next });
      setUserId(res.user.id);
      setDriverId(res.user.driver?.id ?? null);
    } catch {
      setStatusNote('Backend offline — role set locally');
    }
  }

  async function continueFromGate() {
    if (!persona || !mode) return;
    setHasEntered(true);
    const nextRole = mode === 'DRIVER' ? 'DRIVER' : 'RIDER';
    await toggleRole(nextRole);
    setDriverIsAi(persona === 'AGENT');
  }

  async function registerDriver() {
    if (!userId) return;
    try {
      const res = await createDriver({ userId, vehicle, isAi: driverIsAi });
      setDriverId(res.driver.id);
    } catch {
      setStatusNote('Backend offline — driver registered locally');
      setDriverId('demo-driver');
    }
  }

  async function acceptRideAction(rideId: string) {
    if (!driverId) return;
    try {
      const res = await acceptRide(rideId, driverId);
      setRide({
        id: res.ride.id,
        pickup: 'Driver pickup',
        dropoff: 'Driver dropoff',
        status: res.ride.status
      });
    } catch {
      setRide({
        id: rideId,
        pickup: 'Driver pickup',
        dropoff: 'Driver dropoff',
        status: 'DRIVER_ASSIGNED'
      });
    }
  }

  async function updateLocation() {
    if (!pickup || !driverId) return;
    try {
      await updateDriverLocation({ driverId, lat: pickup.lat, lng: pickup.lng });
      setStatusNote('Driver location updated');
    } catch {
      setStatusNote('Backend offline — GPS cached locally');
    }
    setTimeout(() => setStatusNote(''), 2000);
  }

  return (
    <div className="app">
      <Header userName={userName} authToken={authToken} />
      <main className="layout">
        {!hasEntered ? (
          <RoleGate
            userName={userName}
            persona={persona}
            mode={mode}
            onPersona={setPersona}
            onMode={setMode}
            onContinue={continueFromGate}
          />
        ) : (
          <>
            <OSMMapView
              pickup={pickup}
              dropoff={dropoff}
              drivers={drivers}
              routeGeoJson={routeGeoJson}
              onMapClick={(lat, lng) => {
                setDropoff({ lat, lng });
                setDestination(`Dropoff ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
              }}
            />
            <section className="panel">
              {!isBridgeAvailable && (
                <div className="ride-panel">
                  <div className="panel-header">Alien Mini App Required</div>
                  <div className="ride-metric">
                    Open this inside the Alien Mini App to authenticate and pay with Alien Coins.
                  </div>
                </div>
              )}
              <div className="ride-panel">
                <div className="panel-header">Driver Profile</div>
                <div className="stack">
                  <div className="ride-metric">
                    {persona === 'AGENT' ? 'AI Agent Driver' : 'Human Driver'}
                  </div>
                  <label className="field">
                    Vehicle
                    <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
                  </label>
                  <button className="primary" onClick={registerDriver} disabled={!userId || role !== 'DRIVER'}>
                    Register Driver
                  </button>
                  <button className="ghost" onClick={updateLocation} disabled={!driverId || !pickup || role !== 'DRIVER'}>
                    Sync Driver GPS
                  </button>
                  {statusNote && <div className="ride-metric">{statusNote}</div>}
                </div>
              </div>
              {role === 'RIDER' && (
                <RidePanel
                  ride={ride}
                  destination={destination}
                  onDestinationChange={setDestination}
                  onRequest={requestRideAction}
                  canRequest={canRequest}
                  onAssignDriver={assignDriver}
                  onStart={startRideAction}
                  onComplete={completeRideAction}
                  onReset={resetRide}
                />
              )}
          {ride.status === 'COMPLETED' && role === 'RIDER' && (
            <button className="primary" onClick={payWithAlienAction} disabled={!authToken}>
              Pay with Alien
            </button>
          )}
              {role === 'DRIVER' && driverId && (
                <DriverPanel
                  isAi={driverIsAi}
                  vehicle={vehicle}
                  openRides={openRides}
                  onAccept={acceptRideAction}
                  directions={routeSteps}
                />
              )}
            </section>
          </>
        )}
      </main>
      <StatusBar ride={ride} />
    </div>
  );
}
