# syntax = docker/dockerfile:1

# Use official Bun image
FROM oven/bun:1 AS base

LABEL fly_launch_runtime="Bun/SvelteKit"

# SvelteKit app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Build stage
FROM base AS build

# Copy workspace configuration
COPY package.json ./
COPY pnpm-workspace.yaml* ./

# Copy all workspace packages with their tsconfig
COPY packages ./packages

# Copy website app
COPY apps/website ./apps/website

# Install dependencies
WORKDIR /app/apps/website
RUN bun install --frozen-lockfile

# Generate .svelte-kit for shared package (needed for tsconfig extends)
WORKDIR /app/packages/shared
RUN bun run --bun svelte-kit sync || true

# Build website
WORKDIR /app/apps/website
RUN bun run prepare
RUN bun run build

# Production stage
FROM base

# Copy root workspace configuration (needed for workspace: dependencies)
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./

# Copy workspace packages
COPY --from=build /app/packages ./packages

# Copy website package.json and install production dependencies
COPY --from=build /app/apps/website/package.json ./apps/website/
WORKDIR /app/apps/website
RUN bun install --frozen-lockfile --production --ignore-scripts

# Copy built application from build stage
COPY --from=build /app/apps/website/build ./build

# Expose port (Fly.io will set PORT env var)
EXPOSE 3000

# Start the server
CMD ["bun", "run", "build/index.js"]
