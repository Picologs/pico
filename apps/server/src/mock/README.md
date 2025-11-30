# Mock Log Service

Realistic Star Citizen log simulator for **Picologs** with dual purposes:

1. **Public demo**: Homepage live preview showing real-time log activity
2. **Development/testing**: Connect desktop/website to mock data without running Star Citizen

## Overview

The mock service simulates a real player streaming gameplay logs via WebSocket. It:

- Authenticates as a real user (`mock-player-demo`)
- Connects to the WebSocket server like any client
- Streams realistic parsed Log objects continuously
- Broadcasts to friends/groups (configurable)
- Runs scenarios with proper timing and event sequences

## Features

### Realistic Data

- **30+ real ships**: Gladius, Hornet, Cutlass, Constellation, Hammerhead, etc.
- **52 event types**: All Picologs log events with proper metadata
- **Varied scenarios**: Bounty hunting, mining, cargo runs, combat, death/respawn
- **Proper timing**: Randomized delays matching real gameplay (1-15s for quantum travel, 0.5-3s for combat)
- **Logical flows**: Can't quantum without ship, proper mission sequences

### Dual Purpose

#### 1. Public Demo (Website Homepage)

- Live log feed showing Picologs capabilities
- No authentication required for viewers
- Real-time updates using actual WebSocket
- Engages visitors with authentic activity

#### 2. Development/Testing

- Test UI without running Star Citizen
- Consistent, reproducible test data
- Stress testing with high-frequency logs
- WebSocket reliability testing

## Quick Start

### 1. Setup Environment

Create `.env.local` (or add to existing):

```bash
# Mock Service Configuration
MOCK_SERVICE_ENABLED=true
MOCK_PLAYER_DISCORD_ID=mock-player-demo
MOCK_PLAYER_NAME=DemoPlayer
MOCK_WS_URL=ws://localhost:8080
MOCK_JWT_TOKEN=<generate-jwt-token-for-mock-user>

# Optional
MOCK_AUTO_START=false
MOCK_BROADCAST_TO=public  # or 'friends', 'group'
```

**Generate JWT Token:**

```bash
# Create mock user in database first
# Then generate JWT with:
bun run get-discord-id mock-player-demo
```

### 2. Start Server

```bash
cd picologs-server
bun run dev
```

### 3. Control Mock Service

**Via CLI:**

```bash
bun run mock:start     # Start mock player
bun run mock:status    # Check status
bun run mock:stop      # Stop mock player
```

**Via HTTP API:**

```bash
curl -X POST http://localhost:8080/api/mock/start
curl http://localhost:8080/api/mock/status
curl -X POST http://localhost:8080/api/mock/stop
```

**Local Simulation (no WebSocket):**

```bash
bun run mock:simulate-local
```

## Architecture

### File Structure

```
src/mock/
├── data.ts           # Ships, weapons, locations, NPCs
├── generators.ts     # Event-specific Log creators
├── scenarios.ts      # Gameplay session orchestrators
├── mock-service.ts   # Core service class
├── index.ts          # Public exports
└── README.md         # This file

src/routes/
└── mock.ts           # HTTP control API

src/scripts/
├── mock-start.ts     # CLI start command
├── mock-stop.ts      # CLI stop command
├── mock-status.ts    # CLI status check
└── mock-simulate-local.ts  # Local testing
```

### Data Flow

```
Mock Service → WebSocket → Server → Broadcast → Clients
                                                     ↓
                                         Desktop + Website Demo
```

### Scenarios

Each scenario represents a complete gameplay session:

| Scenario            | Duration | Events                                                                | Weight |
| ------------------- | -------- | --------------------------------------------------------------------- | ------ |
| **Bounty Hunting**  | 3-5 min  | Connection → Claim ship → Quantum → Combat (2-5 NPCs) → Return → Land | 3      |
| **Mining**          | 4-6 min  | Claim Prospector → Quantum to asteroids → Mining → Return             | 2      |
| **Death & Respawn** | 2-3 min  | Combat → Death → Hospital respawn → Reclaim ship                      | 1      |
| **Patrol**          | 5-8 min  | Multi-location quantum travel → Random encounters → Return            | 2      |
| **Quick Combat**    | 1-2 min  | Enter ship → Quantum → Combat (2-4 kills)                             | 3      |
| **Cargo Run**       | 3-4 min  | Accept mission → Load cargo → Quantum → Deliver → Complete            | 2      |

**Scenario Selection:** Weighted random selection. Higher weight = more frequent.

### Event Generators

All generators return fully-formed `Log` objects with:

- Deterministic IDs (SHA-256 hash of timestamp + line)
- Proper emoji assignments
- Complete metadata
- Original log text (for expandable UI)
- Correct event types

**Available Generators:**

- `generateConnection` - Player connects to server
- `generateShipEntry/Exit` - Vehicle control flow
- `generateQuantumSpooling/Active/Arrival` - Quantum travel sequence
- `generatePlayerKillsNPC/NPCKillsPlayer` - Combat
- `generateShipDestruction` - Vehicle destruction
- `generateMission*` - Mission events (shared, objectives, completed)
- `generateRespawn` - Hospital spawn
- `generateInsuranceClaim` - Ship claim
- `generateEnvironmentalDeath` - Suffocation, burn, freeze, etc.
- `generateFatalCollision` - Ship crash
- `generateLocationChange` - Inventory opened
- `generateLandingPad` - Landing/takeoff
- `generateSystemQuit` - Session end

## API Reference

### MockPlayerService

```typescript
import { getMockService, type MockServiceConfig } from "./mock";

const config: MockServiceConfig = {
  userId: "mock-player-demo",
  playerName: "DemoPlayer",
  wsUrl: "ws://localhost:8080",
  jwtToken: "<jwt-token>",
  broadcastTarget: "public", // or 'friends', 'group'
  groupId: "<uuid>", // if broadcastTarget === 'group'
  sessionDuration: 0, // ms, 0 = infinite
};

const service = getMockService(config);

// Start service
await service.start();

// Listen to events
service.on("log", (log: Log) => {
  console.log(log.emoji, log.line);
});

service.on("started", () => console.log("Started"));
service.on("stopped", () => console.log("Stopped"));
service.on("error", (error) => console.error(error));

// Get status
const status = service.getStatus();
console.log(status.isRunning, status.logsEmitted, status.uptime);

// Stop service
await service.stop();
```

### HTTP API

**POST /api/mock/start**

```bash
curl -X POST http://localhost:8080/api/mock/start
# Response: { success: true, message: "...", status: {...} }
```

**GET /api/mock/status**

```bash
curl http://localhost:8080/api/mock/status
# Response: { isRunning: true, currentScenario: "Bounty Hunting", logsEmitted: 42, ... }
```

**POST /api/mock/stop**

```bash
curl -X POST http://localhost:8080/api/mock/stop
# Response: { success: true, message: "..." }
```

## Website Integration

To display the demo feed on the homepage:

### 1. Subscribe to Demo Logs

Add a WebSocket message handler for `subscribe_demo`:

```typescript
// In WebSocket server (src/index.ts or handlers)
case 'subscribe_demo': {
  const { userId } = data;
  // Add client to demo subscribers
  demoSubscribers.set(ws, userId);
  break;
}
```

### 2. Broadcast to Demo Subscribers

Modify `send_logs` handler to include demo subscribers:

```typescript
// When mock player sends logs
const mockUserId = "mock-player-demo";

// Broadcast to demo subscribers
for (const [subscriberWs, _] of demoSubscribers) {
  if (subscriberWs.readyState === WebSocket.OPEN) {
    subscriberWs.send(
      JSON.stringify({
        type: "receive_logs",
        data: { logs, userId: mockUserId },
      }),
    );
  }
}
```

### 3. Website Component

```svelte
<!-- /picologs-website/src/routes/demo/+page.svelte -->
<script lang="ts">
  import { LogFeed } from '@space-man-rob/shared-svelte';
  import { onMount } from 'svelte';

  let logs = $state([]);
  let ws: WebSocket;

  onMount(() => {
    ws = new WebSocket('wss://ws.picologs.com/ws');

    ws.onopen = () => {
      // Subscribe to demo logs (no auth required)
      ws.send(JSON.stringify({
        type: 'subscribe_demo',
        data: { userId: 'mock-player-demo' }
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'receive_logs') {
        logs = [...message.data.logs, ...logs].slice(0, 100); // Keep last 100
      }
    };

    return () => ws.close();
  });
</script>

<div class="demo-container">
  <h1>Live Demo</h1>
  <p>Real-time Star Citizen logs from a simulated player</p>
  <LogFeed {logs} />
</div>
```

## Configuration

### Environment Variables

| Variable                 | Default               | Description                           |
| ------------------------ | --------------------- | ------------------------------------- |
| `MOCK_SERVICE_ENABLED`   | `false`               | Enable mock service                   |
| `MOCK_PLAYER_DISCORD_ID` | `mock-player-demo`    | Mock user Discord ID                  |
| `MOCK_PLAYER_NAME`       | `DemoPlayer`          | Display name                          |
| `MOCK_WS_URL`            | `ws://localhost:8080` | WebSocket server URL                  |
| `MOCK_JWT_TOKEN`         | _(required)_          | JWT for authentication                |
| `MOCK_AUTO_START`        | `false`               | Start on server boot                  |
| `MOCK_BROADCAST_TO`      | `public`              | `friends`, `group`, or `public`       |
| `MOCK_GROUP_ID`          | -                     | Group ID if `MOCK_BROADCAST_TO=group` |

### Timing Configuration

Edit `src/mock/scenarios.ts` to adjust delays:

```typescript
// Combat frequency
await ctx.delay(randomDelay(800, 2500)); // 0.8-2.5s between kills

// Quantum travel
await ctx.delay(randomDelay(5000, 12000)); // 5-12s travel time

// Between scenarios (idle)
await ctx.delay(randomDelay(10000, 30000)); // 10-30s idle time
```

## Testing

### Unit Tests (TODO)

```bash
bun test src/mock/generators.test.ts
bun test src/mock/scenarios.test.ts
```

### Integration Test

```bash
# Terminal 1: Start server
bun run dev

# Terminal 2: Start mock service
bun run mock:start

# Terminal 3: Check status
watch -n 1 'bun run mock:status'

# Terminal 4: Connect desktop/website and observe logs
```

### Local Simulation

```bash
bun run mock:simulate-local
# Runs for 1 minute, outputs logs to console
```

## Troubleshooting

### Mock service won't start

**Check environment:**

```bash
echo $MOCK_SERVICE_ENABLED    # Should be 'true'
echo $MOCK_JWT_TOKEN           # Should have JWT
```

**Check database:**

- Mock user must exist in database
- `discordId` must match `MOCK_PLAYER_DISCORD_ID`

**Check logs:**

```bash
# Server logs show WebSocket connection attempt
[MockService] Connecting to WebSocket: ws://localhost:8080
[MockService] WebSocket connected
[MockService] Authenticated successfully
```

### Logs not appearing

**Check WebSocket connection:**

```bash
bun run mock:status
# isRunning: true, logsEmitted should increment
```

**Check broadcast target:**

- If `MOCK_BROADCAST_TO=friends`, ensure mock user has friends
- If `MOCK_BROADCAST_TO=group`, ensure `MOCK_GROUP_ID` is set and user is member

**Check client subscription:**

- Desktop/website must be connected and authenticated
- Check browser/app console for WebSocket messages

### High CPU usage

**Reduce scenario frequency:**

```typescript
// In scenarios.ts, increase idle time
await ctx.delay(randomDelay(30000, 60000)); // 30-60s between scenarios
```

**Reduce event frequency:**

```typescript
// Fewer kills per scenario
const numTargets = randomDelay(1, 2); // Instead of 2-5
```

## Production Considerations

### Security

- **Disable in production** by default (`MOCK_SERVICE_ENABLED=false`)
- Use environment-specific `.env` files
- Protect API endpoints with authentication if exposing publicly
- Use separate mock user account (not real user)

### Performance

- Mock service runs in same process as WebSocket server
- Minimal overhead: ~1-5 logs per second
- Consider dedicated instance for high-traffic demos

### Monitoring

```bash
# Check service health
curl http://localhost:8080/api/mock/status

# Monitor logs
bun run mock:status
```

## Future Enhancements

- [ ] Configurable scenario weights via environment variables
- [ ] Scenario selection by name via API
- [ ] Multiple concurrent mock players
- [ ] WebSocket-less mode for pure testing
- [ ] Record/replay mode for consistent test data
- [ ] Ship image integration in generators
- [ ] Grouped events (killing sprees, vehicle control groups)
- [ ] Mission-specific objectives and rewards
- [ ] Player interaction simulation (chat, trading)

## License

Same as parent project (ISC)
