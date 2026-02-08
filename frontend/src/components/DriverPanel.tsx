import './DriverPanel.css';

type OpenRide = {
  id: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  status: string;
};

export function DriverPanel({
  isAi,
  vehicle,
  openRides,
  onAccept,
  directions
}: {
  isAi: boolean;
  vehicle: string;
  openRides: OpenRide[];
  onAccept: (rideId: string) => void;
  directions: string[];
}) {
  return (
    <div className="driver-panel">
      <div className="panel-header">Driver Ops</div>
      <div className="driver-meta">
        <div>{isAi ? 'AI Agent Driver' : 'Human Driver'}</div>
        <div className="muted">{vehicle}</div>
      </div>
      <div className="panel-sub">Open requests</div>
      {openRides.length === 0 && <div className="muted">No open rides.</div>}
      <div className="ride-list">
        {openRides.map((ride) => (
          <div key={ride.id} className="ride-card">
            <div>Ride {ride.id.slice(0, 6)}</div>
            <div className="muted">Pickup {ride.pickupLat.toFixed(3)}, {ride.pickupLng.toFixed(3)}</div>
            <button className="primary" onClick={() => onAccept(ride.id)}>
              Accept
            </button>
          </div>
        ))}
      </div>
      {directions.length > 0 && (
        <>
          <div className="panel-sub">Turn-by-turn</div>
          <div className="directions">
            {directions.slice(0, 6).map((step, index) => (
              <div key={`${step}-${index}`} className="direction-step">
                {index + 1}. {step}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
