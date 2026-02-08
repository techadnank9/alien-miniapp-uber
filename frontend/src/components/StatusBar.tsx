import './StatusBar.css';
import type { Ride } from '../App';

export function StatusBar({ ride }: { ride: Ride }) {
  return (
    <footer className="status">
      <div>Status: {ride.status}</div>
      <div>{ride.etaMinutes ? `ETA ${ride.etaMinutes} min` : 'ETA --'}</div>
    </footer>
  );
}
