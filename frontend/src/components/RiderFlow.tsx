import './RiderFlow.css';

export type Suggestion = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
};

export type RideOption = {
  id: string;
  label: string;
  etaMin: number;
  fareCents: number;
  subtitle: string;
};

type Props = {
  step: 'SEARCH' | 'OPTIONS' | 'CONFIRM' | 'MATCHING' | 'EN_ROUTE' | 'IN_RIDE' | 'COMPLETED';
  destination: string;
  suggestions: Suggestion[];
  searching: boolean;
  pickupLabel: string;
  selectedOption: RideOption | null;
  options: RideOption[];
  etaLabel: string;
  fareLabel: string;
  onDestinationChange: (value: string) => void;
  onSelectSuggestion: (s: Suggestion) => void;
  onSelectOption: (id: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onRequest: () => void;
  onStart: () => void;
  onComplete: () => void;
};

export function RiderFlow({
  step,
  destination,
  suggestions,
  searching,
  pickupLabel,
  selectedOption,
  options,
  etaLabel,
  fareLabel,
  onDestinationChange,
  onSelectSuggestion,
  onSelectOption,
  onBack,
  onConfirm,
  onRequest,
  onStart,
  onComplete
}: Props) {
  return (
    <div className="rider">
      <div className="panel-header">Request a ride</div>

      {step === 'SEARCH' && (
        <div className="stack">
          <div className="field">
            Pickup
            <div className="pill">{pickupLabel}</div>
          </div>
          <label className="field">
            Destination
            <input
              type="text"
              placeholder="Where to?"
              value={destination}
              onChange={(e) => onDestinationChange(e.target.value)}
            />
          </label>
          {searching && <div className="muted">Searching…</div>}
          {suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map((s) => (
                <button key={s.placeId} className="suggestion" onClick={() => onSelectSuggestion(s)}>
                  <div className="suggestion-name">{s.name}</div>
                  <div className="muted">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'OPTIONS' && (
        <div className="stack">
          <div className="field">
            Pickup
            <div className="pill">{pickupLabel}</div>
          </div>
          <div className="field">
            Destination
            <div className={`pill ${destination ? '' : 'placeholder'}`}>
              {destination || 'Choose destination'}
            </div>
          </div>
          <div className="option-list">
            {options.map((opt) => (
              <button
                key={opt.id}
                className={`option ${selectedOption?.id === opt.id ? 'selected' : ''}`}
                onClick={() => onSelectOption(opt.id)}
              >
                <div>
                  <div className="option-title">{opt.label}</div>
                  <div className="muted">{opt.subtitle}</div>
                </div>
                <div className="option-meta">
                  <div>{opt.etaMin} min</div>
                  <div>{(opt.fareCents / 100).toFixed(2)} ALIEN</div>
                </div>
              </button>
            ))}
          </div>
          <div className="row">
            <button className="ghost" onClick={onBack}>Back</button>
            <button className="primary" onClick={onConfirm} disabled={!selectedOption}>Confirm</button>
          </div>
        </div>
      )}

      {step === 'CONFIRM' && selectedOption && (
        <div className="stack">
          <div className="summary">
            <div>
              <div className="summary-title">{selectedOption.label}</div>
              <div className="muted">ETA {etaLabel}</div>
            </div>
            <div className="summary-fare">{fareLabel}</div>
          </div>
          <div className="field">
            Pickup
            <div className="pill">{pickupLabel}</div>
          </div>
          <div className="field">
            Destination
            <div className={`pill ${destination ? '' : 'placeholder'}`}>
              {destination || 'Choose destination'}
            </div>
          </div>
          <div className="row">
            <button className="ghost" onClick={onBack}>Edit</button>
            <button className="primary" onClick={onRequest}>Request</button>
          </div>
        </div>
      )}

      {step === 'MATCHING' && (
        <div className="stack">
          <div className="match">Finding your driver…</div>
          <div className="muted">Best match in your area</div>
        </div>
      )}

      {step === 'EN_ROUTE' && (
        <div className="stack">
          <div className="match">Driver en route</div>
          <div className="muted">ETA {etaLabel}</div>
        </div>
      )}

      {step === 'IN_RIDE' && (
        <div className="stack">
          <div className="match">On trip</div>
          <div className="muted">{etaLabel} remaining</div>
          <button className="primary" onClick={onComplete}>Complete Ride</button>
        </div>
      )}

      {step === 'COMPLETED' && (
        <div className="stack">
          <div className="match">Trip complete</div>
          <div className="muted">Thanks for riding</div>
        </div>
      )}
    </div>
  );
}
