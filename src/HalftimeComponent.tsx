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
  marketplace: Array<{ player: Player; sellerId: string; sellerName: string; price: number }>;
  onBuyFromMarketplace: (playerId: string) => void;
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
          >
            <option value="">{t.selectPlayer}</option>
            {props.me.roster.map(player => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.primaryPosition} - {player.baseOverall})
              </option>
            ))}
          </select>

          <label>
            {t.sellPrice}
          </label>
          <input
            type="number"
            min="1"
            value={sellPrice}
            onChange={(e) => setSellPrice(Number(e.target.value))}
          />

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

        {/* Marketplace Section */}
        <div className="halftime-section">
          <h3>{props.language === 'tr' ? '🛒 Pazar' : '🛒 Marketplace'}</h3>
          {props.marketplace.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>
              {props.language === 'tr' ? 'Henüz satılık oyuncu yok' : 'No players for sale yet'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '400px', overflowY: 'auto' }}>
              {props.marketplace.map((listing, idx) => (
                <div key={idx} className="marketplace-item">
                  <div className="marketplace-item-info">
                    <div className="marketplace-item-name">{listing.player.name}</div>
                    <div className="marketplace-item-details">
                      <span style={{ color: '#84cc16', fontWeight: 600, marginRight: '8px' }}>
                        {listing.player.primaryPosition}
                      </span>
                      <span style={{ color: '#94a3b8' }}>OVR {listing.player.baseOverall}</span>
                    </div>
                    <small style={{ color: '#94a3b8', fontSize: '0.625rem' }}>{listing.sellerName}</small>
                  </div>
                  <div className="marketplace-item-price">
                    <strong>{listing.price} <small>CR</small></strong>
                    {listing.sellerId !== props.me.id && (
                      <button
                        className="primary"
                        onClick={() => props.onBuyFromMarketplace(listing.player.id)}
                        disabled={props.me.budget < listing.price || props.me.roster.length >= 11}
                        style={{ padding: '6px 12px', fontSize: '0.75rem', marginTop: '8px' }}
                      >
                        {props.me.budget < listing.price
                          ? (props.language === 'tr' ? 'Yetersiz Bütçe' : 'Insufficient Budget')
                          : props.me.roster.length >= 11
                          ? (props.language === 'tr' ? 'Kadro Dolu' : 'Squad Full')
                          : (props.language === 'tr' ? '💰 Satın Al' : '💰 Buy Now')
                        }
                      </button>
                    )}
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
