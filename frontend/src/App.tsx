import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAlien, useLaunchParams, usePayment } from '@alien_org/react';
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
  const DEMO = true;
  const alien = useAlien();
  const authToken = alien.authToken ?? '';
  const launchParams = useLaunchParams();
  const payment = usePayment();
  const [userName, setUserName] = useState<string>('Rider');
  const [userId, setUserId] = useState<string>('');
  const [role, setRole] = useState<UserRole>('RIDER');
  const [persona, setPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const [driverId, setDriverId] = useState<string | null>('demo-driver');
  const [driverIsAi, setDriverIsAi] = useState<boolean>(false);
  const [vehicle, setVehicle] = useState<string>('Alien EV • 42-AZ');
  const [ride, setRide] = useState<Ride>(initialRide);
  const [walletBalance, setWalletBalance] = useState<number>(1.25);
  const [showPayment, setShowPayment] = useState(false);
  const [pendingAmount, setPendingAmount] = useState(0.05);
  const [pendingLabel, setPendingLabel] = useState('Alien Standard');
  const [destination, setDestination] = useState('');
  const [pickup, setPickup] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupLabel, setPickupLabel] = useState<string>('Frontier Tower, San Francisco');
  const [locEnabled, setLocEnabled] = useState(false);
  const [locStatus, setLocStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [drivers, setDrivers] = useState<
    { id: string; isAi: boolean; vehicle: string; lat?: number | null; lng?: number | null }[]
  >([
    { id: 'd1', isAi: true, vehicle: 'Alien AV • AX-7', lat: 37.7875, lng: -122.4012 },
    { id: 'd2', isAi: false, vehicle: 'Alien EV • 42-AZ', lat: 37.7858, lng: -122.4042 }
  ]);
  const [openRides, setOpenRides] = useState<
    { id: string; pickupLat: number; pickupLng: number; dropLat: number; dropLng: number; status: string }[]
  >([
    {
      id: 'ride-101',
      pickupLat: 37.7897,
      pickupLng: -122.4011,
      dropLat: 37.781,
      dropLng: -122.409,
      status: 'MATCHING'
    }
  ]);
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
  const driverJoinTimerRef = useRef<number | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);
  const FIXED_PICKUP = { lat: 37.7897, lng: -122.4011 };
  const MINIAPP_URL = 'https://alien.app/miniapp/spookyride';
  const ALIEN_RECIPIENT = 'aln1qqqqqqspqqqqqqqqgdpfwvjytv47dcyx';
  const [shareUrl, setShareUrl] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    if (DEMO) {
      setUserName('Adnan K');
      return () => {
        mounted = false;
      };
    }
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
    if (!launchParams || DEMO) return;
    const name =
      (launchParams as any).user?.name ||
      (launchParams as any).user?.username ||
      (launchParams as any).user?.first_name ||
      (launchParams as any).user?.displayName;
    if (name) setUserName(name);
  }, [launchParams]);

  useEffect(() => {
    if (!authToken || DEMO) return;
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
    setPickup(FIXED_PICKUP);
    setLocStatus('granted');
  }, [locEnabled]);

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
    setLocStatus('requesting');
    setPickup(FIXED_PICKUP);
    setLocEnabled(true);
    setLocStatus('granted');
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
      fareCents: 5
    },
    {
      id: 'xl',
      label: 'Alien XL',
      subtitle: 'More space',
      etaMin: routeSummary ? routeSummary.durationMin + 2 : 8,
      fareCents: 8
    },
    {
      id: 'black',
      label: 'Alien Black',
      subtitle: 'Premium',
      etaMin: routeSummary ? routeSummary.durationMin + 4 : 10,
      fareCents: 10
    }
  ];

  const selectedOption = options.find((o) => o.id === selectedOptionId) ?? null;

  async function requestRideAction() {
    if (!canRequest) return;
    if (!pickup || !dropoff) return;
    setRide({
      id: `ride-${Math.floor(Math.random() * 9999)}`,
      pickup: pickupLabel,
      dropoff: destination,
      status: 'MATCHING',
      etaMinutes: routeSummary?.durationMin ?? 6,
      fareCents: selectedOption?.fareCents ?? 5
    });
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
    setRide((r) => ({ ...r, status: 'IN_RIDE', etaMinutes: 12 }));
  }

  async function completeRideAction() {
    if (!ride.id) return;
    setRide((r) => ({ ...r, status: 'COMPLETED', etaMinutes: 0 }));
  }

  async function payWithAlienAction() {
    if (!ride.id) return;
    setWalletBalance((b) => Math.max(0, b - pendingAmount));
    setStatusNote('Payment confirmed');
    setTimeout(() => setStatusNote(''), 1200);
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
    if (nextRole === 'DRIVER') {
      setDriverId('demo-driver');
      setStatusNote('Driver ready');
    }
  }

  async function registerDriver() {
    setStatusNote('Driver registered');
    setTimeout(() => setStatusNote(''), 1200);
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
    if (!pickup) return;
    setStatusNote('Driver location updated');
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
    if (!selectedOption) return;
    setPendingAmount(selectedOption.fareCents / 100);
    setPendingLabel(selectedOption.label);
    setShowPayment(true);
  }

  async function confirmPaymentAndRequest() {
    setShowPayment(false);
    setRiderStep('MATCHING');
    await requestRideAction();
    payWithAlienAction();
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
    if (driverJoinTimerRef.current) window.clearTimeout(driverJoinTimerRef.current);
    driverJoinTimerRef.current = window.setTimeout(() => {
      setDrivers((d) => [
        ...d,
        { id: 'd3', isAi: false, vehicle: 'Alien EV • 88-ZX', lat: 37.7882, lng: -122.4018 }
      ]);
      setOpenRides((r) => [
        ...r,
        {
          id: `ride-${Math.floor(Math.random() * 9999)}`,
          pickupLat: 37.7897,
          pickupLng: -122.4011,
          dropLat: dropoff?.lat ?? 37.781,
          dropLng: dropoff?.lng ?? -122.409,
          status: 'MATCHING'
        }
      ]);
      setStatusNote('Driver joined the network');
      setTimeout(() => setStatusNote(''), 1600);
    }, 30000);
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
                  {locStatus === 'requesting' ? 'Setting pickup…' : 'Set Pickup Location'}
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
      {showPayment && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-title">Confirm Payment</div>
            <div className="modal-sub">SpookyRide • {pendingLabel}</div>
            <div className="modal-amount">{pendingAmount.toFixed(2)} ALIEN</div>
            <div className="modal-balance">Wallet balance: {walletBalance.toFixed(2)} ALIEN</div>
            <div className="row">
              <button className="ghost" onClick={() => setShowPayment(false)}>Deny</button>
              <button className="primary" onClick={confirmPaymentAndRequest}>Confirm</button>
            </div>
          </div>
        </div>
      )}
      <StatusBar ride={ride} />
    </div>
  );
}
