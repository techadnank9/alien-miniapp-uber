import './RidePanel.css';
import type { Ride } from '../App';

type Props = {
  ride: Ride;
  destination: string;
  onDestinationChange: (value: string) => void;
  onRequest: () => void;
  canRequest: boolean;
  onAssignDriver: () => void;
  onStart: () => void;
  onComplete: () => void;
  onReset: () => void;
};

export function RidePanel({
  ride,
  destination,
  onDestinationChange,
  onRequest,
  canRequest,
  onAssignDriver,
  onStart,
  onComplete,
  onReset
}: Props) {
  const isIdle = ride.status === 'IDLE';
  const isMatching = ride.status === 'MATCHING';
  const isAssigned = ride.status === 'DRIVER_ASSIGNED';
  const isInRide = ride.status === 'IN_RIDE';
  const isCompleted = ride.status === 'COMPLETED';

  return (
    <div className="ride-panel">
      <div className="panel-header">Request a ride</div>
      <label className="field">
        Destination
        <input
          type="text"
          placeholder="Enter destination"
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          disabled={!isIdle}
        />
      </label>
      {!canRequest && isIdle && (
        <div className="ride-metric">Tip: click the map to set dropoff pin.</div>
      )}

      {isIdle && (
        <button className="primary" onClick={onRequest} disabled={!canRequest}>
          Request Ride
        </button>
      )}

      {isMatching && (
        <button className="primary" onClick={onAssignDriver}>
          Simulate Driver Match
        </button>
      )}

      {isAssigned && (
        <div className="stack">
          <div className="driver-card">
            <div className="driver-name">{ride.driverName}</div>
            <div className="driver-car">{ride.vehicle}</div>
            <div className="driver-eta">ETA {ride.etaMinutes} min</div>
          </div>
          <button className="primary" onClick={onStart}>
            Start Ride
          </button>
        </div>
      )}

      {isInRide && (
        <div className="stack">
          <div className="ride-metric">Remaining: {ride.etaMinutes} min</div>
          <button className="primary" onClick={onComplete}>
            Complete Ride
          </button>
        </div>
      )}

      {isCompleted && (
        <div className="stack">
          <div className="ride-metric">Trip complete. Thanks for riding.</div>
          <button className="ghost" onClick={onReset}>
            Request Another Ride
          </button>
        </div>
      )}
    </div>
  );
}
