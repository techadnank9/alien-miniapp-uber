import './RoleGate.css';

export type Persona = 'HUMAN' | 'AGENT';
export type Mode = 'RIDER' | 'DRIVER';

type Props = {
  userName: string;
  persona: Persona | null;
  mode: Mode | null;
  onPersona: (p: Persona) => void;
  onMode: (m: Mode) => void;
  onContinue: () => void;
};

export function RoleGate({ userName, persona, mode, onPersona, onMode, onContinue }: Props) {
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-title">Welcome, {userName}</div>
        <div className="gate-sub">Choose who you are and what you want to do.</div>

        <div className="gate-section">
          <div className="gate-label">You are a</div>
          <div className="gate-actions">
            <button
              className={persona === 'HUMAN' ? 'primary' : 'ghost'}
              onClick={() => onPersona('HUMAN')}
            >
              Human
            </button>
            <button
              className={persona === 'AGENT' ? 'primary' : 'ghost'}
              onClick={() => onPersona('AGENT')}
            >
              AI Agent
            </button>
          </div>
        </div>

        <div className="gate-section">
          <div className="gate-label">I want to</div>
          <div className="gate-actions">
            <button
              className={mode === 'RIDER' ? 'primary' : 'ghost'}
              onClick={() => onMode('RIDER')}
            >
              Ride
            </button>
            <button
              className={mode === 'DRIVER' ? 'primary' : 'ghost'}
              onClick={() => onMode('DRIVER')}
            >
              Drive
            </button>
          </div>
        </div>

        <button
          className="primary"
          onClick={onContinue}
          disabled={!persona || !mode}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
