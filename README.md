# Picologs

A desktop log viewer for Star Citizen. Track your gameplay sessions, monitor events, and share logs with friends.

## Features

- **Real-time log monitoring** - Watch your Star Citizen logs update live as you play
- **Event detection** - Automatically detects missions, deaths, quantum travel, and other game events
- **Session sharing** - Share your gameplay sessions with friends
- **Cross-platform** - Windows support (macOS coming soon)

## Installation

Download the latest installer from the [Releases](https://github.com/Picologs/pico/releases) page.

---

## Self-Hosting Guide

This guide covers running your own Pico instance for local development or production deployment.

### Architecture Overview

Pico consists of three components:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Desktop App    │────▶│  WebSocket      │◀────│    Website      │
│  (Tauri)        │     │  Server (Bun)   │     │  (SvelteKit)    │
│                 │     │                 │     │                 │
│  - Log parsing  │     │  - Real-time    │     │  - OAuth bridge │
│  - File watch   │     │  - Friends/     │     │  - Web UI       │
│  - Local UI     │     │    Groups       │     │  - Profile mgmt │
└─────────────────┘     └────────┬────────┘     └────────┬────────┘
                                 │                       │
                        ┌────────▼───────────────────────▼────────┐
                        │              PostgreSQL                  │
                        │         (Neon or self-hosted)           │
                        └─────────────────────────────────────────┘
```

**Why the website bridge?** Discord OAuth only accepts `http://` or `https://` redirect URIs, not custom protocols like `picologs://`. The website acts as an intermediary for the desktop app's authentication flow.

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9.12+
- [Bun](https://bun.sh/) 1.0+ (for server and website)
- [Rust](https://rustup.rs/) (for desktop app only)
- A Discord application (see Discord OAuth Setup below)
- PostgreSQL database (Neon recommended, or local)
- S3-compatible storage (Tigris, MinIO, or AWS S3)

---

## Discord OAuth Setup

Pico uses Discord for authentication. You need to create a Discord application:

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Name it (e.g., "Picologs Dev")
4. Click **Create**

### 2. Configure OAuth2

1. In the left sidebar, click **OAuth2**
2. Copy the **Client ID** - you'll need this for `DISCORD_CLIENT_ID`
3. Click **Reset Secret** and copy it - this is your `DISCORD_CLIENT_SECRET`

### 3. Add Redirect URIs

In **OAuth2 > Redirects**, add these URIs:

**For local development:**
```
http://localhost:5173/auth/callback
http://localhost:5173/auth/desktop/callback
```

**For production** (replace with your domain):
```
https://your-domain.com/auth/callback
https://your-domain.com/auth/desktop/callback
```

### 4. Configure Scopes

The app uses these OAuth scopes:
- `identify` - Access user's Discord username and avatar
- `email` - Access user's email (optional)

---

## Database Setup

### Option A: Neon (Recommended for Cloud)

[Neon](https://neon.tech) is a serverless PostgreSQL that scales to zero.

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. Set `DATABASE_URL` in your environment

### Option B: Local PostgreSQL

For local development, you can use Docker:

```bash
docker run -d \
  --name picologs-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=picologs \
  -p 5432:5432 \
  postgres:16-alpine
```

Connection string: `postgresql://postgres:postgres@localhost:5432/picologs`

### Running Migrations

Migrations run automatically on first connection. To manually run them:

```bash
cd apps/server
bun run db:push
```

---

## File Storage Setup

Pico uses S3-compatible storage for avatar uploads.

### Option A: MinIO (Local Development)

MinIO is an S3-compatible object storage perfect for local dev:

```bash
docker run -d \
  --name picologs-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

Create a bucket:
```bash
# Install MinIO client
brew install minio/stable/mc

# Configure and create bucket
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/picologs-uploads
mc anonymous set public local/picologs-uploads
```

Environment variables:
```bash
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_ENDPOINT_URL_S3=http://localhost:9000
BUCKET_NAME=picologs-uploads
R2_PUBLIC_DOMAIN=http://localhost:9000/picologs-uploads
```

### Option B: Tigris (Fly.io Production)

If deploying to Fly.io, Tigris provides S3-compatible storage:

```bash
flyctl storage create -n picologs-uploads
```

Fly.io automatically sets the environment variables.

### Option C: AWS S3

Use standard AWS S3 credentials and endpoint.

---

## Local Development (Quick Start)

### 1. Clone and Install

```bash
git clone https://github.com/Picologs/pico.git
cd pico
pnpm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your values:
- `JWT_SECRET` - Generate with `openssl rand -base64 32`
- `DISCORD_CLIENT_ID` - From Discord Developer Portal
- `DISCORD_CLIENT_SECRET` - From Discord Developer Portal
- `DATABASE_URL` - Your PostgreSQL connection string

### 3. Start Development Servers

**Option A: Docker Compose (easiest)**

```bash
docker compose up -d
```

This starts PostgreSQL, MinIO, server, and website. Open http://localhost:5173

**Option B: Manual (for active development)**

Start each service in separate terminals:

```bash
# Terminal 1: Server
cd apps/server
cp ../../.env .env
bun run dev

# Terminal 2: Website
cd apps/website
cp ../../.env .env
bun run dev

# Terminal 3: Desktop (optional)
cd apps/desktop
pnpm tauri dev
```

### 4. Ports Used

| Service | Port | URL |
|---------|------|-----|
| Website | 5173 | http://localhost:5173 |
| Server (WebSocket) | 8080 | ws://localhost:8080/ws |
| Desktop (Vite) | 1420 | http://localhost:1420 |
| MinIO S3 | 9000 | http://localhost:9000 |
| MinIO Console | 9001 | http://localhost:9001 |
| PostgreSQL | 5432 | localhost:5432 |

---

## Docker Compose Setup

The included `docker-compose.yml` runs all services locally:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop all services
docker compose down

# Reset data (removes volumes)
docker compose down -v
```

**Note:** The desktop app runs natively (Tauri can't be containerized). Run it separately:

```bash
cd apps/desktop
pnpm tauri dev
```

---

## Production Deployment (Fly.io)

Pico is designed for [Fly.io](https://fly.io) deployment. Both server and website have Dockerfiles and `fly.toml` configs.

### 1. Install Fly CLI

```bash
brew install flyctl
flyctl auth login
```

### 2. Deploy Server

```bash
cd apps/server

# Create app (first time only)
flyctl launch --no-deploy

# Set secrets
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="$(openssl rand -base64 32)" \
  DISCORD_CLIENT_ID="your-client-id" \
  DISCORD_CLIENT_SECRET="your-secret" \
  BROADCAST_API_KEY="$(openssl rand -base64 32)"

# Deploy
flyctl deploy
```

### 3. Deploy Website

```bash
cd apps/website

# Create app (first time only)
flyctl launch --no-deploy

# Set secrets
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="same-as-server" \
  DISCORD_CLIENT_ID="your-client-id" \
  DISCORD_CLIENT_SECRET="your-secret" \
  DISCORD_REDIRECT_URI="https://your-domain.com/auth/callback" \
  WEBSOCKET_SERVER_URL="https://your-server.fly.dev" \
  PUBLIC_WS_URL="wss://your-server.fly.dev/ws"

# Deploy
flyctl deploy
```

### 4. Create Storage Bucket

```bash
flyctl storage create -n picologs-uploads
```

### 5. Custom Domain (Optional)

```bash
# Add custom domain
flyctl certs add your-domain.com

# Update DNS with provided values
```

---

## Environment Variables Reference

### Required (All Services)

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `openssl rand -base64 32` |
| `DISCORD_CLIENT_ID` | Discord OAuth Client ID | `1234567890123456789` |
| `DISCORD_CLIENT_SECRET` | Discord OAuth Secret | `abcdef123456...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |

### Server Only

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `8080` |
| `HOST` | Server hostname | `0.0.0.0` |
| `BROADCAST_API_KEY` | API key for /broadcast endpoint | Required |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | Required |
| `NODE_ENV` | Environment mode | `development` |

### Website Only

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_REDIRECT_URI` | OAuth callback URL | Required |
| `WEBSOCKET_SERVER_URL` | Server URL (server-to-server) | Required |
| `PUBLIC_WS_URL` | WebSocket URL (client-side) | Required |
| `PUBLIC_URL` | Website public URL | Required |
| `ORIGIN` | SvelteKit origin | Same as PUBLIC_URL |

### File Storage

| Variable | Description | Example |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | S3 access key | `minioadmin` |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key | `minioadmin` |
| `AWS_ENDPOINT_URL_S3` | S3 endpoint | `http://localhost:9000` |
| `AWS_REGION` | S3 region | `auto` |
| `BUCKET_NAME` | S3 bucket name | `picologs-uploads` |
| `R2_PUBLIC_DOMAIN` | Public URL for files | `http://localhost:9000/picologs-uploads` |

---

## Troubleshooting

### CORS Errors

**Symptom:** Browser console shows CORS policy errors

**Solution:** Ensure `ALLOWED_ORIGINS` on the server includes your website URL:
```bash
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:1420
```

### Port Already in Use

**Symptom:** `EADDRINUSE` error on startup

**Solution:** Kill the process using the port:
```bash
# Find process
lsof -i :8080

# Kill it
kill -9 <PID>
```

### Discord OAuth Fails

**Symptom:** "Invalid redirect_uri" or OAuth doesn't complete

**Solutions:**
1. Check redirect URIs in Discord Developer Portal match exactly
2. Ensure `DISCORD_REDIRECT_URI` matches the Discord app settings
3. For local dev, use `http://localhost:5173/auth/callback` (not 127.0.0.1)

### Database Connection Fails

**Symptom:** "Connection refused" or timeout errors

**Solutions:**
1. Verify `DATABASE_URL` is correct
2. For Docker, use `postgres` as hostname (not `localhost`)
3. Check PostgreSQL is running: `docker compose ps`

### WebSocket Won't Connect

**Symptom:** Real-time features don't work

**Solutions:**
1. Check `PUBLIC_WS_URL` uses correct protocol (`ws://` for dev, `wss://` for production)
2. Verify server is running and healthy: `curl http://localhost:8080/health`
3. Check browser console for connection errors

### Avatar Upload Fails

**Symptom:** Can't upload profile pictures

**Solutions:**
1. Verify MinIO/S3 is running and accessible
2. Check bucket exists and has public read policy
3. Verify all AWS_* environment variables are set
4. Check `R2_PUBLIC_DOMAIN` points to correct URL

### JWT Errors

**Symptom:** "Invalid token" or authentication issues

**Solutions:**
1. Ensure `JWT_SECRET` is identical on server AND website
2. Generate a new secret: `openssl rand -base64 32`
3. Clear browser cookies and re-authenticate

---

## Tech Stack

- [Tauri](https://tauri.app/) - Desktop framework
- [SvelteKit](https://kit.svelte.dev/) - Frontend framework
- [Bun](https://bun.sh/) - JavaScript runtime
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Turborepo](https://turbo.build/) - Monorepo tooling
- [PostgreSQL](https://www.postgresql.org/) - Database
- [Drizzle ORM](https://orm.drizzle.team/) - Type-safe database queries

## Project Structure

```
apps/
  desktop/     # Tauri + SvelteKit desktop application
  server/      # Bun WebSocket server
  website/     # SvelteKit web application
packages/
  shared/      # Shared UI components and utilities
  types/       # Shared TypeScript types
```

## License

[MIT](LICENSE)
