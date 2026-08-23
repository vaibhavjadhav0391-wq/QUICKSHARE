# QuickTransfer ⚡
### *Scan. Send. Done.*

**QuickTransfer** is a high-performance, privacy-focused WebRTC file-transfer web application designed to move files between devices (mobile phone and PC/laptop) instantly — with **no account creation**, **no WhatsApp/Telegram workarounds**, **no cloud uploads**, and **zero persistent file storage**.

Just scan a QR code or enter a 6-digit connection code to transfer files directly peer-to-peer over WebRTC.

---

## 🚀 Key Features

- **Direct P2P & TURN Relay**: Transfers files directly between browser WebRTC DataChannels. Automatically falls back to TURN relay or WebSocket relay when restrictive firewall/NAT networks (e.g. college/corporate WiFi) block direct UDP.
- **Fast QR Code & Camera Controls**: Ultra-responsive camera scanner built with `@zxing/browser` featuring camera selection, custom viewport alignment, and instant auto-stop upon scanning.
- **One-Time Temporary Transfers (Zero History)**: Behaves strictly like a one-time file transfer utility. Transfers are never saved in `localStorage`, `sessionStorage`, IndexedDB, or server disks. When a new transfer starts, all previous transfer states are completely cleared.
- **End-to-End Receiver ACK Protocol**: The sender browser will only show `"Transfer Complete ✓"` after the receiver confirms complete file size assembly via a `file-received` acknowledgement message.
- **Instant Receiver State Sync**: Mobile receiver immediately leaves the `"Waiting for sender..."` screen upon detecting incoming file metadata (`file-start`).
- **DataChannel Backpressure Management**: Enforces a 128 KB buffer watermark to prevent browser memory overflows during multi-gigabyte file streaming.
- **Clean Session Cancellation & Disconnect Hygiene**: Explicit `transfer-cancelled` and `peer-disconnected` signal propagation with a session generation guard to eliminate stale waiting screen traps.
- **5-Minute Inactive Session Lifetime**: Temporary signaling sessions automatically expire after 5 minutes of inactivity.
- **Floating Star Wars (BB-8) Theme Toggle**: Sleek, compact light/dark mode switch fixed in the bottom-right corner.
- **Interactive Flow Visualizer**: Includes a dedicated `/how-it-works` page detailing every phase of the transfer lifecycle.

---

## 🏗️ Architecture & Protocol

```text
Browser (Sender/PC)          Signaling Server (Socket.IO)          Browser (Receiver/Mobile)
       │                                  │                                  │
       │─────── create-session ──────────►│                                  │
       │◄────── session-created ──────────│                                  │
       │       (token, shortCode)         │                                  │
       │                                  │◄─────── join-session / code ─────│
       │◄────── peer-joined ──────────────│                                  │
       │                                  │──────── join-success ───────────►│
       │─────── offer (SDP) ─────────────►│─────────────────────────────────►│
       │◄────── answer (SDP) ─────────────│◄─────────────────────────────────│
       │─────── ICE candidates ──────────►│─────────────────────────────────►│
       │◄────── ICE candidates ───────────│◄─────────────────────────────────│
       │                                  │                                  │
       │══════════════════ WebRTC DataChannel (Direct P2P / TURN) ══════════════════│
       │                                                                            │
       │─────── file-start (metadata) ─────────────────────────────────────────────►│
       │       [Receiver transitions state out of "Waiting for sender..."]          │
       │─────── chunk-meta + binary ArrayBuffer chunks ──────────────────────────►│
       │─────── file-end ──────────────────────────────────────────────────────────►│
       │       [Receiver validates byte size & assembles Blob]                      │
       │◄────── file-received ACK ──────────────────────────────────────────────────│
       │       [Sender transitions to "Transfer Complete ✓"]                        │
```

---

## ⚡ Quick Start

### Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher

### 1. Setup Environment Files

```bash
# In project root
cp .env.example server/.env
cp .env.example client/.env
```

### 2. Install Dependencies

```bash
# Server dependencies
cd server
npm install

# Client dependencies
cd ../client
npm install
```

### 3. Run Development Servers

**Terminal 1 — Signaling Server (Port 3001):**
```bash
cd server
npm run dev
```

**Terminal 2 — React Client (Port 5173):**
```bash
cd client
npm run dev
```

### 4. Open Application

- **Desktop/Laptop**: Open `http://localhost:5173`
- **Mobile Device**: Open `http://<your-local-ip>:5173` (or scan QR code from laptop display)

---

## 🧪 Testing Scenarios

### Scenario A: Same Local WiFi Network
1. Find your PC's local IPv4 address using `ipconfig` (Windows) or `ifconfig` (Mac/Linux). Example: `192.168.1.100`.
2. Open `http://192.168.1.100:5173` on your laptop.
3. Click **Send Files** → select a file.
4. Scan the QR code using your phone's camera (or open the URL on mobile).
5. File transfers peer-to-peer! Both devices display `P2P` in the header badge.

### Scenario B: Mobile Data vs WiFi (College / Restricted NAT Networks)
1. Turn off WiFi on your phone so it runs on Mobile Data (4G/5G).
2. Scan the QR code or enter the 6-character connection code.
3. The WebRTC stack detects direct candidate traversal failure and seamlessly switches to **TURN Relay** (header badge shows `TURN Relay`).
4. File transfer completes cleanly with full receiver size validation!

---

## ⚙️ Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Signaling server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `NODE_ENV` | `development` | Environment mode (`development` / `production`) |

### Client (`client/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_SERVER_URL` | *(empty = same origin)* | Socket.IO signaling server URL |
| `VITE_TURN_URL` | *(OpenRelay fallback)* | Custom TURN server URL (`turn:domain:3478?transport=udp`) |
| `VITE_TURN_USERNAME` | *(OpenRelay fallback)* | TURN username |
| `VITE_TURN_CREDENTIAL` | *(OpenRelay fallback)* | TURN credential / password |

---

## 🔒 Security & Privacy Guarantees

1. **No Registration / No Accounts**: Identity is transient and scoped strictly to a 192-bit cryptographic session token.
2. **Zero Persistent Storage**: Files flow directly through memory streams and ArrayBuffers into Blob downloads. Files are never stored on server disks, database tables, or browser `localStorage`.
3. **No Stale Sessions**: Sessions automatically expire after 5 minutes of inactivity. Page reloads (`F5`) or closes immediately clean up WebRTC peer connections and DataChannels.
4. **End-to-End Session Isolation**: Only two devices (Sender and Receiver) are allowed in a single session room.

---

## 🛠️ Project Structure

```text
d:\project aug/
├── client/                     # React 18 + Vite + TailwindCSS Frontend
│   ├── src/
│   │   ├── components/         # UI components & BB-8 theme toggle
│   │   ├── context/            # ThemeContext & system preferences
│   │   ├── hooks/              # useWebRTC, useSignaling, useFileTransfer, useQRScanner
│   │   ├── lib/                # fileChunker, WebRTCPeer, socket client
│   │   ├── pages/              # UnifiedApp, HowItWorks visual flow page
│   │   ├── types/              # TypeScript protocol interfaces
│   │   └── utils/              # Formatters & device detection helpers
│   ├── vercel.json             # Vercel single-page rewrite config
│   └── package.json
├── server/                     # Node.js + Express + Socket.IO Signaling Backend
│   ├── src/
│   │   ├── services/           # SessionManager (5-min inactivity TTL)
│   │   ├── signaling/          # Socket.IO relay & event handlers
│   │   └── index.ts            # Server entrypoint
│   └── package.json
└── README.md
```

---

## 📜 Commands Reference

- **Run Client Typecheck**: `cd client && npx tsc --noEmit`
- **Run Server Typecheck**: `cd server && npx tsc --noEmit`
- **Build Client**: `cd client && npm run build`
- **Build Server**: `cd server && npm run build`

---

### *Made with ⚡ for instant, secure, zero-hassle file sharing.*
