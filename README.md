# QuickTransfer ⚡
### _Scan. Send. Done._

Transfer files between your phone and PC instantly — no login, no WhatsApp, no cloud storage.
Just scan a QR code and transfer directly peer-to-peer via WebRTC.

---

## Architecture

```
Browser (PC)          Signaling Server          Browser (Mobile)
    │                      │                          │
    │─── create-session ──►│                          │
    │◄── session-created ──│                          │
    │    (token, shortCode)│                          │
    │                      │◄─── join-session ────────│
    │◄─── peer-joined ─────│                          │
    │                      │◄── join-success ─────────│
    │─── offer (SDP) ─────►│──────────────────────────►│
    │◄── answer (SDP) ─────│◄─────────────────────────│
    │─── ICE candidates ───►│──────────────────────────►│
    │◄── ICE candidates ───│◄─────────────────────────│
    │                      │                          │
    │════════════ WebRTC DataChannel (P2P) ═══════════│
    │           File chunks transferred directly       │
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Clone and setup

```bash
cd "d:\project aug"

# Setup environment variables
cp .env.example server/.env
cp .env.example client/.env
```

### 2. Install dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Start development servers

**Terminal 1 — Signaling Server:**
```bash
cd server
npm run dev
```

**Terminal 2 — React Client:**
```bash
cd client
npm run dev
```

### 4. Open in browser

- **PC**: http://localhost:5173/pc
- **Phone**: http://localhost:5173/mobile (must be on same network, or use ngrok)

---

## Testing

### Mobile on same network as PC

1. Find your PC's local IP:
   - Windows: `ipconfig` → find "IPv4 Address" (e.g., `192.168.1.100`)
2. Open `http://192.168.1.100:5173/pc` on PC
3. Open `http://192.168.1.100:5173/mobile` on phone
4. Scan QR → Connected → Transfer files

> ⚠️ **Note:** Camera access (QR scanning) requires HTTPS or localhost. On a local IP, you'll need to use the manual code entry instead, or set up HTTPS with ngrok (see below).

### Mobile on different network (college scenario)

Use [ngrok](https://ngrok.com/) to expose both ports:

```bash
# Expose the server (signaling)
ngrok http 3001

# Update client/.env:
# VITE_SERVER_URL=https://xxxx.ngrok.io

# Then expose client
ngrok http 5173
```

Open the ngrok HTTPS URL on your phone — camera will work over HTTPS.

---

## Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Frontend origin for CORS |
| `NODE_ENV` | `development` | Environment mode |

### Client (`client/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | (empty = same origin) | Server URL (production only) |
| `VITE_TURN_URL` | (empty) | TURN server URL |
| `VITE_TURN_USERNAME` | (empty) | TURN username |
| `VITE_TURN_CREDENTIAL` | (empty) | TURN password |

---

## STUN / TURN Configuration

### STUN (included by default)
The app uses Google's public STUN servers out of the box:
- `stun:stun.l.google.com:19302`
- `stun:stun.cloudflare.com:3478`

These work for **most home/office networks** where both devices can reach the internet.

### TURN (required for restrictive networks)

College/corporate networks often use **symmetric NAT** or block direct UDP.
In these cases, STUN alone won't work, and you need a TURN server to relay traffic.

**Free TURN servers:**

1. **Open Relay** (Metered): https://www.metered.ca/tools/openrelay/
2. **Xirsys** (free tier): https://xirsys.com/

Add your TURN credentials to `client/.env`:
```env
VITE_TURN_URL=turn:relay.example.com:3478
VITE_TURN_USERNAME=your-username
VITE_TURN_CREDENTIAL=your-password
```

The server also provides a **WebSocket relay fallback** — if WebRTC fails completely, file chunks
are relayed through the signaling server. This always works but is slower and uses server bandwidth.

---

## Production Deployment

### Option 1: Single server (recommended)

Build the client, serve it from the Express server:

```bash
# Build client
cd client
npm run build

# Build server
cd ../server
npm run build

# Set environment variables
export NODE_ENV=production
export PORT=443
export CLIENT_ORIGIN=https://yourdomain.com

# Start
npm start
```

The Express server serves the React app from `client/dist` and handles Socket.IO on the same port.

### Option 2: Separate deployment

Deploy client to Vercel/Netlify, server to Railway/Render/Fly.io:

1. Deploy server → get URL (e.g., `https://api.yourdomain.com`)
2. Set `client/.env`: `VITE_SERVER_URL=https://api.yourdomain.com`
3. Build and deploy client

### HTTPS Requirement

- Camera API (`getUserMedia`) requires HTTPS in production
- WebSocket (WSS) works better over HTTPS
- Use Let's Encrypt (free) with nginx reverse proxy

**Nginx config example:**
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Security

- **No accounts**: The session token IS the identity. Anyone with the token can join (until it's taken).
- **Temporary sessions**: Sessions expire after 10 minutes of inactivity or 30 minutes max.
- **No permanent storage**: Files are transferred directly P2P. The server never sees file content in WebRTC mode.
- **WS relay fallback**: Chunks relay through server RAM only — never written to disk.
- **One peer per session**: Once a mobile joins, no other device can join the same session.
- **Cryptographic tokens**: 24-byte random tokens (192 bits), base64url encoded.
- **HTTPS required in production**: Prevents session token interception.

---

## Browser Compatibility

| Browser | PC | Mobile | Notes |
|---|---|---|---|
| Chrome 90+ | ✅ | ✅ | Full support |
| Edge 90+ | ✅ | ✅ | Full support |
| Firefox 90+ | ✅ | ✅ | Full support |
| Safari 14+ | ✅ | ✅ | Camera requires HTTPS |
| iOS Safari 14+ | — | ✅ | playsinline required (handled) |
| Android Chrome | — | ✅ | Full support |

---

## Troubleshooting

**QR code not scanning on iOS Safari**
→ Safari requires HTTPS for camera access. Use ngrok or deploy with HTTPS.

**"Connection failed" after scanning**
→ College network may block WebRTC. The app will fall back to server relay automatically.

**Transfer speed is slow**
→ If using WS relay fallback (WebRTC failed), add a TURN server for P2P routing.

**Mobile shows "Session not found"**
→ QR code is more than 10 minutes old. Click "New Session" on the PC.

**Can't connect when phone is on mobile data**
→ STUN may not work through symmetric NAT. Configure a TURN server.

**Socket.IO proxy errors in dev**
→ Make sure the server is running on port 3001 before starting the client.

---

## Project Structure

```
project/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── hooks/             # React hooks (signaling, WebRTC, file transfer, QR)
│   │   ├── lib/               # Core libraries (socket, webrtc, fileChunker)
│   │   ├── pages/             # Route pages
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Helpers (formatters, device detection)
│   └── ...
├── server/                    # Node.js signaling server
│   ├── src/
│   │   ├── services/          # Session manager
│   │   ├── signaling/         # Socket.IO event handlers
│   │   └── utils/             # Crypto helpers
│   └── ...
├── .env.example               # Environment variable template
└── README.md
```
