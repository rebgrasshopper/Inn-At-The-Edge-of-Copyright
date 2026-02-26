# Mobile Testing with ngrok

This guide explains how to test the MUD game on mobile devices (iPad, phone) using ngrok to tunnel through network restrictions.

## Why ngrok?

When testing on mobile devices on the same WiFi network, you might encounter issues:

- Router AP isolation blocking device-to-device communication
- Firewall rules preventing connections
- Corporate/guest networks with restrictions

ngrok creates a public tunnel to your local server, bypassing these issues.

## Prerequisites

Install ngrok:

```bash
# macOS with Homebrew
brew install ngrok

# Or download from https://ngrok.com/download
```

Sign up for a free ngrok account at https://ngrok.com and authenticate:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

## Setup Steps

### 1. Start the backend server

```bash
npm run dev:server
```

This starts the Express + Socket.io server on port 3000.

### 2. Start ngrok tunnel

In a new terminal:

```bash
ngrok http 3000
```

You'll see output like:

```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
```

Copy the `https://...ngrok-free.app` URL.

### 3. Configure the client

Create `client/.env.local` with your ngrok URL:

```bash
VITE_API_URL=https://abc123.ngrok-free.app/api
VITE_SOCKET_URL=https://abc123.ngrok-free.app
```

### 4. Start the client

```bash
npm run dev:client
```

The client will start and show a local network URL like:

```
Network: http://192.168.1.100:5173
```

### 5. Access from mobile

Open the local network URL on your mobile device. The client will connect to the backend through the ngrok tunnel.

## Alternative: Direct Local Network (if router allows)

If your router doesn't have AP isolation enabled, you can skip ngrok:

1. Find your computer's local IP: `ipconfig getifaddr en0` (macOS)
2. Start both servers: `npm run dev`
3. Access `http://YOUR_IP:5173` from mobile

The Vite config already has `host: true` enabled for local network access.

## Troubleshooting

### "Invalid Host header" error

ngrok's free tier shows an interstitial page. Click through it or use a paid plan.

### Socket connection fails

Make sure both `VITE_API_URL` and `VITE_SOCKET_URL` are set to the ngrok URL.

### Changes not taking effect

Restart the client after modifying `.env.local`.

### ngrok URL changed

Free ngrok URLs change each session. Update `.env.local` with the new URL.
