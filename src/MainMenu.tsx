import React from 'react';

interface MainMenuProps {
  onSelectGame: (game: 'ball-on' | 'amo-arena') => void;
}

export default function MainMenu({ onSelectGame }: MainMenuProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #1a2f4a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        maxWidth: '900px',
        width: '100%',
        textAlign: 'center'
      }}>
        <h1 style={{
          fontSize: '3.5rem',
          fontWeight: 'bold',
          color: '#ffffff',
          marginBottom: '1rem',
          textShadow: '0 4px 20px rgba(255, 107, 53, 0.3)'
        }}>
          BALL-ON
        </h1>

        <p style={{
          fontSize: '1.2rem',
          color: '#94a3b8',
          marginBottom: '3rem',
          maxWidth: '600px',
          margin: '0 auto 3rem'
        }}>
          Futbol oyunları platformu - İki efsanevi mod arasından seçim yap
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginTop: '3rem'
        }}>
          {/* Ball-On Card */}
          <button
            onClick={() => onSelectGame('ball-on')}
            style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
              border: '2px solid #3b82f6',
              borderRadius: '16px',
              padding: '2.5rem 2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              color: '#ffffff',
              textAlign: 'left',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 15px 50px rgba(59, 130, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(59, 130, 246, 0.3)';
            }}
          >
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>⚽</div>
            <h2 style={{
              fontSize: '1.8rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: '#60a5fa'
            }}>
              Draft Manager
            </h2>
            <p style={{
              fontSize: '1rem',
              color: '#94a3b8',
              lineHeight: '1.6'
            }}>
              Gerçek zamanlı açık artırma ile takım kur, formasyon seç ve rakiplerini yen
            </p>
            <div style={{
              marginTop: '1.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {['Açık Artırma', '11 Oyuncu', 'Formasyon', 'Drag & Drop'].map(tag => (
                <span key={tag} style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '20px',
                  color: '#93c5fd'
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </button>

          {/* Amo Arena Card */}
          <button
            onClick={() => onSelectGame('amo-arena')}
            style={{
              background: 'linear-gradient(135deg, #5f1e3a 0%, #8e2d5a 100%)',
              border: '2px solid #ff6b35',
              borderRadius: '16px',
              padding: '2.5rem 2rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              color: '#ffffff',
              textAlign: 'left',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(255, 107, 53, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 15px 50px rgba(255, 107, 53, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 10px 40px rgba(255, 107, 53, 0.3)';
            }}
          >
            <div style={{
              fontSize: '3rem',
              marginBottom: '1rem'
            }}>🧠</div>
            <h2 style={{
              fontSize: '1.8rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem',
              color: '#ff6b35'
            }}>
              Amo Arena
            </h2>
            <p style={{
              fontSize: '1rem',
              color: '#94a3b8',
              lineHeight: '1.6'
            }}>
              2-6 kişilik Türkçe futbol bilgi yarışması - 10 tur, 7 farklı soru tipi
            </p>
            <div style={{
              marginTop: '1.5rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {['Quiz', 'Multiplayer', '7 Soru Tipi', 'Takım Modu'].map(tag => (
                <span key={tag} style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(255, 107, 53, 0.2)',
                  border: '1px solid rgba(255, 107, 53, 0.4)',
                  borderRadius: '20px',
                  color: '#ffa07a'
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </button>
        </div>

        <div style={{
          marginTop: '3rem',
          fontSize: '0.875rem',
          color: '#64748b'
        }}>
          Her iki oyun da arkadaşlarınla gerçek zamanlı oynamak için tasarlandı 🎮
        </div>
      </div>
    </div>
  );
}
