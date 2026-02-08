import './Header.css';

export function Header({ userName, authToken }: { userName: string; authToken: string }) {
  return (
    <header className="header">
      <div>
        <div className="brand">Alien Ride</div>
        <div className="tagline">Mini App • Real-time rides</div>
      </div>
      <div className="user">
        <div className="user-name">{userName || 'Connecting...'}</div>
        <div className="user-token">{authToken ? 'Alien auth verified' : 'Awaiting auth'}</div>
      </div>
    </header>
  );
}
