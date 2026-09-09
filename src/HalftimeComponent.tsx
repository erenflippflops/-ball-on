import React, { useState } from 'react';
import type { Player, Team } from './types';
import { translations, type Language } from './translations';

interface HalftimeProps {
  me: Team;
  opponents: Team[];
  language: Language;
  halftimeTimer: number;
  onSellPlayer: (playerId: string, price: number) => void;
  onMakeOffer: (targetTeamId: string, givePlayerId: string, wantPlayerId: string) => void;
  onRespondOffer: (offerId: number, accept: boolean) => void;
  onFinish: () => void;
  incomingOffers: Array<{ id: number; from: string; fromTeam: string; give: Player; want: Player }>;
}

export function HalftimeComponent(props: HalftimeProps) {
  const t = translations[props.language];
  const [selectedPlayerToSell, setSelectedPlayerToSell] = useState<string>('');
  const [sellPrice, setSellPrice] = useState<number>(5);
  const [selectedGive, setSelectedGive] = useState<string>('');
  const [selectedOpponent, setSelectedOpponent] = useState<string>('');
  const [selectedWant, setSelectedWant] = useState<string>('');

  const handleSell = () => {
    if (selectedPlayerToSell && sellPrice > 0) {
      props.onSellPlayer(selectedPlayerToSell, sellPrice);
      setSelectedPlayerToSell('');
      setSellPrice(5);
    }
  };

  const handleMakeOffer = () => {
    if (selectedGive && selectedOpponent && selectedWant) {
      props.onMakeOffer(selectedOpponent, selectedGive, selectedWant);
      setSelectedGive('');
      setSelectedOpponent('');
      setSelectedWant('');
    }
  };

  const selectedOpponentTeam = props.opponents.find(t => t.id === selectedOpponent);

  return (
    <div className="halftime-window">
      <div className="halftime-header">
        <div>
          <span className="kicker">{t.halftimeKicker}</span>
          <h1>{t.halftimeTitle}</h1>
          <p>{t.halftimeSubtitle}</p>
        </div>
        <div className="halftime-timer-box">
          <small>{t.halftimeTimer}</small>
          <div className="halftime-timer-value">
            {Math.floor(props.halftimeTimer / 60)}:{String(props.halftimeTimer % 60).padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="halftime-grid">
        {/* Sell Player Section */}
        <div className="halftime-section">
          <h3>{t.sellPlayer}</h3>
          <select
            value={selectedPlayerToSell}
            onChange={(e) => setSelectedPlayerToSell(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', background: 'rgba(10, 26, 28, 0.6)', border: '1px solid rgba(132, 204, 22, 0.3)', borderRadius: '6px', color: '#f1f5f9' }}
          >
            <option value="">{t.selectPlayer}</option>
            {props.me.roster.map(player => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.primaryPosition} - {player.baseOverall})
              </option>
            ))}
          </select>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>
              {t.sellPrice}
            </label>
            <input
              type="number"
              min="1"
              value={sellPrice}
              onChange={(e) => setSellPrice(Number(e.target.value))}
              style={{ width: '100%', padding: '10px', background: 'rgba(10, 26, 28, 0.6)', border: '1px solid rgba(132, 204, 22, 0.3)', borderRadius: '6px', color: '#f1f5f9' }}
            />
          </div>

          <button
            className="primary"
            onClick={handleSell}
            disabled={!selectedPlayerToSell}
            style={{ width: '100%' }}
          >
            {t.sellButton}
          </button>
        </div>

        {/* Make Offer Section */}
        <div className="halftime-section">
          <h3>{t.makeOffer}</h3>

          <select
            value={selectedGive}
            onChange={(e) => setSelectedGive(e.target.value)}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', background: 'rgba(10, 26, 28, 0.6)', border: '1px solid rgba(132, 204, 22, 0.3)', borderRadius: '6px', color: '#f1f5f9' }}
          >
            <option value="">{t.selectPlayer} ({props.language === 'tr' ? 'Senin' : 'Your'})</option>
            {props.me.roster.map(player => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.primaryPosition} - {player.baseOverall})
              </option>
            ))}
          </select>

          <select
            value={selectedOpponent}
            onChange={(e) => {
              setSelectedOpponent(e.target.value);
              setSelectedWant('');
            }}
            style={{ width: '100%', padding: '10px', marginBottom: '10px', background: 'rgba(10, 26, 28, 0.6)', border: '1px solid rgba(132, 204, 22, 0.3)', borderRadius: '6px', color: '#f1f5f9' }}
          >
            <option value="">{props.language === 'tr' ? 'Rakip Seç' : 'Select Opponent'}</option>
            {props.opponents.map(team => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>

          {selectedOpponentTeam && (
            <select
              value={selectedWant}
              onChange={(e) => setSelectedWant(e.target.value)}
              style={{ width: '100%', padding: '10px', marginBottom: '10px', background: 'rgba(10, 26, 28, 0.6)', border: '1px solid rgba(132, 204, 22, 0.3)', borderRadius: '6px', color: '#f1f5f9' }}
            >
              <option value="">{t.wantPlayer}</option>
              {selectedOpponentTeam.roster.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name} ({player.primaryPosition} - {player.baseOverall})
                </option>
              ))}
            </select>
          )}

          <button
            className="primary"
            onClick={handleMakeOffer}
            disabled={!selectedGive || !selectedOpponent || !selectedWant}
            style={{ width: '100%' }}
          >
            {t.sendOffer}
          </button>
        </div>

        {/* Incoming Offers Section */}
        <div className="halftime-section">
          <h3>{t.incomingOffers}</h3>
          {props.incomingOffers.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>{t.noOffers}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {props.incomingOffers.map(offer => (
                <div key={offer.id} style={{ padding: '15px', background: 'rgba(10, 26, 28, 0.6)', borderRadius: '8px', border: '1px solid rgba(132, 204, 22, 0.2)' }}>
                  <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                    {props.language === 'tr' ? 'Gönderen' : 'From'}: {offer.fromTeam}
                  </small>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
                    <div>
                      <strong>{offer.give.name}</strong>
                      <small style={{ display: 'block', color: '#94a3b8' }}>{offer.give.primaryPosition} - {offer.give.baseOverall}</small>
                    </div>
                    <div style={{ fontSize: '20px', color: '#84cc16' }}>⇄</div>
                    <div>
                      <strong>{offer.want.name}</strong>
                      <small style={{ display: 'block', color: '#94a3b8' }}>{offer.want.primaryPosition} - {offer.want.baseOverall}</small>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="primary"
                      onClick={() => props.onRespondOffer(offer.id, true)}
                      style={{ flex: 1, padding: '8px', fontSize: '14px' }}
                    >
                      {t.accept}
                    </button>
                    <button
                      className="ghost"
                      onClick={() => props.onRespondOffer(offer.id, false)}
                      style={{ flex: 1, padding: '8px', fontSize: '14px' }}
                    >
                      {t.reject}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        className="primary"
        onClick={props.onFinish}
        style={{ width: '100%', marginTop: '20px', fontSize: '18px', padding: '15px' }}
      >
        {t.finishHalftime}
      </button>
    </div>
  );
}
