const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export type UserRole = 'RIDER' | 'DRIVER';

export type AuthResponse = {
  user: {
    id: string;
    alienUserId: string;
    name: string;
    role: UserRole;
    wallet?: { balance: number; currency: string } | null;
    driver?: { id: string; isAi: boolean; vehicle: string } | null;
  };
};

export async function authAlien(payload: { token: string; role?: UserRole }): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/alien`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payload.token}` },
    body: JSON.stringify({ role: payload.role })
  });
  if (!res.ok) throw new Error('Auth failed');
  return res.json();
}

export async function createDriver(payload: { userId: string; vehicle: string; isAi?: boolean }) {
  const res = await fetch(`${API_BASE}/drivers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Create driver failed');
  return res.json();
}

export async function updateDriverLocation(payload: { driverId: string; lat: number; lng: number }) {
  const res = await fetch(`${API_BASE}/drivers/${payload.driverId}/location`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat: payload.lat, lng: payload.lng })
  });
  if (!res.ok) throw new Error('Update location failed');
  return res.json();
}

export async function listDrivers(lat: number, lng: number) {
  const res = await fetch(`${API_BASE}/drivers/nearby?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error('Drivers fetch failed');
  return res.json();
}

export async function requestRide(payload: {
  riderId: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  fareCents?: number;
}) {
  const res = await fetch(`${API_BASE}/rides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Ride request failed');
  return res.json();
}

export async function acceptRide(rideId: string, driverId: string) {
  const res = await fetch(`${API_BASE}/rides/${rideId}/accept`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverId })
  });
  if (!res.ok) throw new Error('Accept ride failed');
  return res.json();
}

export async function startRide(rideId: string) {
  const res = await fetch(`${API_BASE}/rides/${rideId}/start`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Start ride failed');
  return res.json();
}

export async function completeRide(rideId: string) {
  const res = await fetch(`${API_BASE}/rides/${rideId}/complete`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Complete ride failed');
  return res.json();
}

export async function listOpenRides() {
  const res = await fetch(`${API_BASE}/rides/open`);
  if (!res.ok) throw new Error('Open rides fetch failed');
  return res.json();
}

export async function getWallet(userId: string) {
  const res = await fetch(`${API_BASE}/wallet/${userId}`);
  if (!res.ok) throw new Error('Wallet fetch failed');
  return res.json();
}

export async function topupWallet(userId: string, amount: number) {
  const res = await fetch(`${API_BASE}/wallet/topup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount })
  });
  if (!res.ok) throw new Error('Topup failed');
  return res.json();
}

export async function payWallet(userId: string, amount: number, reason: string, rideId?: string) {
  const res = await fetch(`${API_BASE}/wallet/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount, reason, rideId })
  });
  if (!res.ok) throw new Error('Pay failed');
  return res.json();
}

export async function createAlienInvoice(payload: {
  token: string;
  amount: string;
  rideId: string;
}) {
  const res = await fetch(`${API_BASE}/payments/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${payload.token}` },
    body: JSON.stringify({ amount: payload.amount, rideId: payload.rideId })
  });
  if (!res.ok) throw new Error('Invoice failed');
  return res.json();
}
