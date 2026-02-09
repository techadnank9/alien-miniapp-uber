import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAlien, useLaunchParams, usePayment } from '@alien_org/react';
import { QRCodeCanvas } from 'qrcode.react';
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
import { RiderFlow, type RideOption, type Suggestion } from './components/RiderFlow';
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
  const launchParams = useLaunchParams();
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
  const [pickupLabel, setPickupLabel] = useState<string>('Detecting location…');
  const [locEnabled, setLocEnabled] = useState(false);
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [drivers, setDrivers] = useState<
    { id: string; isAi: boolean; vehicle: string; lat?: number | null; lng?: number | null }[]
  >([]);
  const [openRides, setOpenRides] = useState<
    { id: string; pickupLat: number; pickupLng: number; dropLat: number; dropLng: number; status: string }[]
  >([]);
  const [routeGeoJson, setRouteGeoJson] = useState<RouteLineString | null>(null);
  const [routeSteps, setRouteSteps] = useState<string[]>([]);
  const [routeSummary, setRouteSummary] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [activeRideCoords, setActiveRideCoords] = useState<{
    pickup: { lat: number; lng: number };
    dropoff: { lat: number; lng: number };
  } | null>(null);
  const [driverStage, setDriverStage] = useState<'TO_PICKUP' | 'TO_DROPOFF' | null>(null);
  const [riderStep, setRiderStep] = useState<
    'SEARCH' | 'OPTIONS' | 'CONFIRM' | 'MATCHING' | 'EN_ROUTE' | 'IN_RIDE' | 'COMPLETED'
  >('SEARCH');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>('');
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const matchTimerRef = useRef<number | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const MINIAPP_URL = 'https://alien.app/miniapp/spookyride';
  const [shareUrl, setShareUrl] = useState<string>('');

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
    setShareUrl(MINIAPP_URL);
  }, []);

  useEffect(() => {
    if (!launchParams) return;
    const name =
      (launchParams as any).user?.name ||
      (launchParams as any).user?.username ||
      (launchParams as any).user?.first_name ||
      (launchParams as any).user?.displayName;
    if (name) setUserName(name);
  }, [launchParams]);

  useEffect(() => {
    if (!authToken) return;
    const controller = new AbortController();
    const ssoBaseUrl = 'https://sso.alien-api.com';
    fetch(`${ssoBaseUrl}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const name = data?.name || data?.preferred_username || data?.username;
        if (name) setUserName(name);
      })
      .catch(() => {
        // ignore if userinfo fails
      });
    return () => controller.abort();
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
    if (!locEnabled) return;
    if (!navigator.geolocation) {
      setStatusNote('Geolocation not supported on this device');
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickup(next);
      },
      () => {
        setStatusNote('Location permission denied');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [locEnabled]);

  useEffect(() => {
    if (!isBridgeAvailable || locationRequested || role !== 'RIDER') return;
    requestLocation();
    setLocationRequested(true);
  }, [isBridgeAvailable, locationRequested, role]);

  useEffect(() => {
    if (!pickup) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pickup.lat}&lon=${pickup.lng}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.display_name) {
          setPickupLabel(data.display_name);
          return;
        }
      } catch {
        // ignore
      }
      setPickupLabel(`${pickup.lat.toFixed(5)}, ${pickup.lng.toFixed(5)}`);
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pickup]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setStatusNote('Geolocation not supported on this device');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPickup({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocEnabled(true);
      },
      () => {
        setStatusNote('Location permission denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const canRequest = useMemo(
    () => destination.trim().length > 2 && !!pickup && !!dropoff,
    [destination, pickup, dropoff]
  );

  useEffect(() => {
    const controller = new AbortController();
    async function fetchDirections() {
      let from: { lat: number; lng: number } | null = null;
      let to: { lat: number; lng: number } | null = null;

      if (role === 'DRIVER' && activeRideCoords && pickup) {
        from = pickup;
        to = driverStage === 'TO_DROPOFF' ? activeRideCoords.dropoff : activeRideCoords.pickup;
      } else if (pickup && dropoff) {
        from = pickup;
        to = dropoff;
      }

      if (!from || !to) {
        setRouteGeoJson(null);
        setRouteSteps([]);
        setRouteSummary(null);
        return;
      }

      const baseUrl = import.meta.env.VITE_OSRM_URL || 'https://router.project-osrm.org';
      const url = `${baseUrl}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const route = data.routes?.[0];
        if (!route) return;
        setRouteGeoJson(route.geometry);
        setRouteSummary({
          distanceKm: route.distance / 1000,
          durationMin: Math.max(1, Math.round(route.duration / 60))
        });
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
        setRouteSummary(null);
      }
    }

    fetchDirections();
    return () => controller.abort();
  }, [pickup, dropoff, role, activeRideCoords, driverStage]);

  useEffect(() => {
    if (destination.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          destination
        )}&limit=5`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        const mapped: Suggestion[] = data.map((item: any) => ({
          placeId: item.place_id,
          name: item.display_name,
          lat: Number(item.lat),
          lng: Number(item.lon)
        }));
        setSuggestions(mapped);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [destination]);

  const options: RideOption[] = [
    {
      id: 'standard',
      label: 'Alien Standard',
      subtitle: 'Everyday rides',
      etaMin: routeSummary ? routeSummary.durationMin : 6,
      fareCents: routeSummary
        ? Math.round((1.5 + routeSummary.distanceKm * 0.6 + routeSummary.durationMin * 0.25) * 100)
        : 350
    },
    {
      id: 'xl',
      label: 'Alien XL',
      subtitle: 'More space',
      etaMin: routeSummary ? routeSummary.durationMin + 2 : 8,
      fareCents: routeSummary
        ? Math.round((2.2 + routeSummary.distanceKm * 0.8 + routeSummary.durationMin * 0.35) * 100)
        : 500
    },
    {
      id: 'black',
      label: 'Alien Black',
      subtitle: 'Premium',
      etaMin: routeSummary ? routeSummary.durationMin + 4 : 10,
      fareCents: routeSummary
        ? Math.round((3.2 + routeSummary.distanceKm * 1.2 + routeSummary.durationMin * 0.5) * 100)
        : 800
    }
  ];

  const selectedOption = options.find((o) => o.id === selectedOptionId) ?? null;

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
        pickup: pickupLabel,
        dropoff: destination,
        status: res.ride.status,
        etaMinutes: routeSummary?.durationMin ?? 6,
        fareCents: selectedOption?.fareCents ?? res.ride.fareCents
      });
    } catch {
      setStatusNote('Backend offline — using local ride flow');
      setRide({
        id: 'demo-ride',
        pickup: pickupLabel,
        dropoff: destination,
        status: 'MATCHING',
        etaMinutes: routeSummary?.durationMin ?? 6,
        fareCents: selectedOption?.fareCents ?? 1200
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
      if ('supported' in payment && payment.supported === false) {
        setStatusNote('Alien payment not supported on this host');
        return;
      }
      await payment.pay({
        recipient: invoiceRes.recipient,
        amount: invoiceRes.amount,
        network: 'alien',
        token: 'ALIEN',
        invoice: invoiceRes.invoice,
        title: 'SpookyRide'
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
    if (nextRole === 'RIDER') {
      setRiderStep('SEARCH');
    }
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
    const selected = openRides.find((r) => r.id === rideId);
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
    if (selected) {
      setActiveRideCoords({
        pickup: { lat: selected.pickupLat, lng: selected.pickupLng },
        dropoff: { lat: selected.dropLat, lng: selected.dropLng }
      });
      setDriverStage('TO_PICKUP');
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

  function driverStartTrip() {
    setDriverStage('TO_DROPOFF');
  }

  function driverCompleteTrip() {
    setDriverStage(null);
    setActiveRideCoords(null);
  }

  function handleSelectSuggestion(s: Suggestion) {
    setDropoff({ lat: s.lat, lng: s.lng });
    setDestination(s.name);
    setSuggestions([]);
    setRiderStep('OPTIONS');
  }

  function handleConfirmOptions() {
    setRiderStep('CONFIRM');
  }

  function handleBackToSearch() {
    setRiderStep('SEARCH');
  }

  async function handleRequestRide() {
    setRiderStep('MATCHING');
    await requestRideAction();
    if (matchTimerRef.current) window.clearTimeout(matchTimerRef.current);
    matchTimerRef.current = window.setTimeout(() => {
      assignDriver();
      setRiderStep('EN_ROUTE');
      // Simulate driver arrival and auto-start ride for rider flow
      matchTimerRef.current = window.setTimeout(() => {
        startRideAction();
        setRiderStep('IN_RIDE');
      }, 2500);
    }, 1600);
  }

  async function handleStartRide() {
    await startRideAction();
    setRiderStep('IN_RIDE');
  }

  async function handleCompleteRide() {
    await completeRideAction();
    setRiderStep('COMPLETED');
  }

  return (
    <div className="app">
      <Header userName={userName} authToken={authToken} />
      <main className="layout">
        {!isBridgeAvailable ? (
          <div className="ride-panel">
            <div className="panel-header">Open in Alien App</div>
            <div className="ride-metric">
              This mini app requires the Alien host to access your profile, wallet, and GPS.
            </div>
            {shareUrl && (
              <div className="stack">
                <div className="ride-metric">Scan to open in Alien:</div>
                <div className="qr">
                  <QRCodeCanvas value={shareUrl} size={180} bgColor="#0b121b" fgColor="#f1f5f9" />
                </div>
                <div className="muted">{shareUrl}</div>
              </div>
            )}
          </div>
        ) : !hasEntered ? (
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
              {role === 'DRIVER' && (
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
                    <button className="primary" onClick={registerDriver} disabled={!userId}>
                      Register Driver
                    </button>
                    <button className="ghost" onClick={updateLocation} disabled={!driverId || !pickup}>
                      Sync Driver GPS
                    </button>
                    {statusNote && <div className="ride-metric">{statusNote}</div>}
                  </div>
                </div>
              )}
              {role === 'RIDER' && (
                <RiderFlow
                  step={riderStep}
                  destination={destination}
                  suggestions={suggestions}
                  searching={searching}
                  pickupLabel={pickupLabel}
                  selectedOption={selectedOption}
                  options={options}
                  etaLabel={routeSummary ? `${routeSummary.durationMin} min` : '—'}
                  fareLabel={selectedOption ? `${(selectedOption.fareCents / 100).toFixed(2)} ALIEN` : '--'}
                  onDestinationChange={setDestination}
                  onSelectSuggestion={handleSelectSuggestion}
                  onSelectOption={setSelectedOptionId}
                  onBack={handleBackToSearch}
                  onConfirm={handleConfirmOptions}
                  onRequest={handleRequestRide}
                  onStart={handleStartRide}
                  onComplete={handleCompleteRide}
                />
              )}
              {role === 'RIDER' && !pickup && (
                <button className="ghost" onClick={requestLocation}>
                  Enable Location
                </button>
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
              {role === 'DRIVER' && activeRideCoords && (
                <div className="ride-panel">
                  <div className="panel-header">Active Ride</div>
                  <div className="stack">
                    <div className="ride-metric">
                      {driverStage === 'TO_DROPOFF' ? 'On trip' : 'Heading to pickup'}
                    </div>
                    {driverStage === 'TO_PICKUP' && (
                      <button className="primary" onClick={driverStartTrip}>
                        Start Trip
                      </button>
                    )}
                    {driverStage === 'TO_DROPOFF' && (
                      <button className="primary" onClick={driverCompleteTrip}>
                        Complete Trip
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <StatusBar ride={ride} />
    </div>
  );
}
