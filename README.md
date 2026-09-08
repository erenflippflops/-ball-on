# BALL ON! - Draft Eleven Manager

Gerçek zamanlı futbol kadro kurma oyunu. Oyuncular gizli havuzdan futbolcu transfer eder, rakipten oyuncu çalar ve taktik kurarak maç kazanır.

## 🎮 Özellikler

- **Gerçek zamanlı multiplayer**: Socket.io ile canlı oyun deneyimi (2 oyuncu veya bot)
- **100+ gerçek futbolcu**: Detaylı istatistikler ve arketipler
- **Dinamik pazar mekaniği**: Transfer dedikoduları ve piyasa dalgalanmaları
- **Akıllı bot AI**: Stratejik karar alan yapay zeka
- **Pozisyon limitleri**: Dengeli kadro kurma (GK:2, DEF:5, MID:5, ATT:4)
- **Scout sistemi**: Sonraki oyuncular hakkında bilgi topla
- **Gelişmiş simülasyon**: Seed-based maç motoru
- **Türkçe arayüz**: Tam Türkçe lokalizasyon

## 🚀 Kurulum

### 1. Dependencies'i yükle
```bash
npm install
```

### 2. Environment dosyalarını ayarla

Backend için `.env` oluştur:
```bash
cp .env.example .env
```

Frontend için `.env` oluştur (opsiyonel):
```bash
# VITE_SERVER_URL=http://127.0.0.1:3001
```

### 3. Geliştirme modunda çalıştır
```bash
npm run dev:all
```

Bu komut hem backend server'ı (port 3001) hem frontend'i başlatır.

### Ayrı ayrı çalıştırma
```bash
# Sadece backend
npm run server

# Sadece frontend
npm run dev
```

## 🌐 Online Deployment

### Backend (Node.js server)

1. **Render, Railway, veya Heroku'ya deploy et:**

```bash
# Build server
npm run build:server

# Start
npm run start:server
```

Environment variables:
```
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com
```

### Frontend (Static site)

1. **Vercel, Netlify, veya Cloudflare Pages'e deploy et:**

```bash
# Build
npm run build

# Preview
npm run preview
```

Environment variable:
```
VITE_SERVER_URL=https://your-backend-domain.com
```

### Örnek Deployment Platformları

**Backend:**
- [Render](https://render.com) - Ücretsiz tier mevcut
- [Railway](https://railway.app) - Kolay deployment
- [Fly.io](https://fly.io) - Edge deployment

**Frontend:**
- [Vercel](https://vercel.com) - Ücretsiz, otomatik deployment
- [Netlify](https://netlify.com) - Drag & drop deployment
- [Cloudflare Pages](https://pages.cloudflare.com) - Hızlı CDN

## 📁 Proje Yapısı

```
BALL-ON/
├── src/
│   ├── main.tsx           # React frontend
│   ├── types.ts           # TypeScript tipleri
│   ├── playerPool.ts      # 100+ oyuncu havuzu
│   ├── socketService.ts   # Socket.io client
│   └── style.css          # UI stilleri
├── server/
│   ├── index.ts           # Express + Socket.io server
│   ├── matchSimulator.ts  # Maç simülasyon motoru
│   ├── botAI.ts           # Bot yapay zeka
│   └── positionLimits.ts  # Kadro limitleri
├── package.json
└── tsconfig.json
```

## 🎯 Oyun Akışı

1. **Lobby**: Oda oluştur veya katıl (oda kodu paylaş)
2. **Açık Artırma**: 14 oyuncuyu sırayla satın al
   - Pazar durumu: 📈 Canli, 📉 Durgun, 💼 Normal
   - Transfer dedikoduları: Hangi yıldızlar havuzda
   - Scout joker: Sonraki oyuncu hakkında bilgi al
3. **Oyuncu Çalma**: Rakipten oyuncu çal (gizli seçim)
4. **Takas**: Oyuncu takası kabul/reddet
5. **İlk 11**: Diziliş ve formasyon seç (otomatik en iyi 11)
6. **Taktik**: Oyun tarzını belirle
7. **Maç**: Seed-based simülasyon
8. **Sonuç**: İstatistikler ve kazanan

## 🆕 Yeni Özellikler

### Dinamik Pazar Mekaniği
- **Piyasa dalgalanmaları**: Her 4 turda bir pazar durumu değişebilir
- **Transfer dedikoduları**: Oyun başında 3-5 yıldız oyuncu sızdırılır
- **Gerçek zamanlı bildirimler**: Pazar değişiklikleri anında gösterilir

### Pozisyon Limitleri
- **GK**: Maksimum 2 kaleci
- **DEF**: Maksimum 5 defans (CB, LB, RB, LWB, RWB)
- **MID**: Maksimum 5 orta saha (DM, CM, AM, LM, RM)
- **ATT**: Maksimum 4 hücum (LW, RW, ST)

### Scout Sistemi
- 3 scout hakkı başlangıçta
- Sonraki oyuncunun ismini, pozisyonunu, overall'ını ve tier'ını gösterir
- Rakip sadece scout kullandığını görür, detayları görmez

## 🛠️ Teknolojiler

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Express, Socket.io
- **Real-time**: WebSocket + Polling fallback
- **Styling**: Custom CSS (yeşil-siyah tema, animasyonlar)
- **Type Safety**: TypeScript her yerde

## 📊 Oyuncu Verileri

Oyuncular şu özelliklere sahip:
- **Pozisyonlar**: GK, CB, LB, RB, LWB, RWB, DM, CM, AM, LM, RM, LW, RW, ST
- **Kalite**: star (⭐), high, medium, low
- **Arketipler**: Regista, Box-to-box, İçe kat eden kanat, Target man, vs.
- **Attributeler**: pace, shooting, passing, dribbling, defending, physical, aerial, vision, stamina, composure

## 🤖 Bot AI

Bot şu stratejileri kullanır:
- Pozisyon ihtiyacına göre teklif verir
- Bütçe yönetimi yapar (rezerv tutar)
- En iyi oyuncuları çalmaya çalışır
- Korumak için en değerli oyuncuyu seçer
- Forma ve taktik seçer

## 🎨 UI/UX

- Modern, yeşil-siyah tema
- Smooth animasyonlar ve transitions
- Responsive tasarım (mobil uyumlu)
- Türkçe terminoloji
- Pozisyon bazlı renklendirme
- Gerçek zamanlı piyasa göstergeleri

## 📝 Notlar

- Server port: 3001 (değiştirilebilir)
- Frontend: Vite dynamic port
- Online multiplayer destekli (1v1 veya vs bot)
- Oda kodları 6 karakterli (örn: A3F9X2)
- Scout joker sonraki oyuncu için (mevcut değil)
- Pazar durumu her 8 turda değişebilir

## 🔧 Geliştirme

### Yeni oyuncu ekleme
`src/playerPool.ts` dosyasındaki `playerPool` array'ine ekle.

### Bot AI değiştirme
`server/botAI.ts` dosyasındaki `BotAI` class'ını düzenle.

### Maç simülasyonu
`server/matchSimulator.ts` dosyasında simülasyon mantığı.

### Pazar mekaniği
`server/index.ts` içinde `place_bid` ve `start_game` event'lerinde.

## 🐛 Sorun Giderme

**Port zaten kullanılıyor:**
```bash
# Windows
netstat -ano | findstr :3001
taskkill /F /PID <PID>

# Linux/Mac
lsof -ti:3001 | xargs kill -9
```

**Socket bağlantı hatası:**
- `.env` dosyasında `VITE_SERVER_URL` doğru olmalı
- CORS ayarları backend'de doğru olmalı
- Firewall backend portunu engelliyor olabilir

## 📄 Lisans

Private project - Eğitim amaçlı.
