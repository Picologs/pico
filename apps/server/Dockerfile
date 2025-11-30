# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace configuration
COPY package.json ./

# Copy all workspace packages
COPY packages ./packages
COPY apps/server ./apps/server

# Install dependencies for server and its workspace dependencies
WORKDIR /app/apps/server
RUN bun install --frozen-lockfile

# Production stage
FROM oven/bun:1
WORKDIR /app

# Copy installed dependencies and application code
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/server ./apps/server

# Set working directory to server app
WORKDIR /app/apps/server

# Expose port
EXPOSE 8080

# Start the server
CMD ["bun", "run", "src/index.ts"]
