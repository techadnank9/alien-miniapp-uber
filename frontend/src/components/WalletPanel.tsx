import './WalletPanel.css';

export function WalletPanel({
  balance,
  currency,
  onTopup
}: {
  balance: number;
  currency: string;
  onTopup: () => void;
}) {
  return (
    <div className="wallet">
      <div className="panel-header">Alien Coins</div>
      <div className="balance">{balance} {currency}</div>
      <button className="ghost" onClick={onTopup}>
        Add 500 {currency}
      </button>
    </div>
  );
}
