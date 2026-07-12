# Backend: REST + WebSocket signaling + WebSocket relay (single TCP port).
# No UDP / public IP needed, so it runs on any free tier.
FROM node:22-alpine
RUN corepack enable
WORKDIR /app

# Copy the repo (node_modules/build excluded via .dockerignore).
COPY . .

# Install only the server and its workspace deps (skips the Expo app).
RUN pnpm install --frozen-lockfile=false --filter @crafttogether/server...

ENV PORT=8080
EXPOSE 8080/tcp
WORKDIR /app/server
# Run with tsx so the shared workspace package (TS source) resolves at runtime.
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
