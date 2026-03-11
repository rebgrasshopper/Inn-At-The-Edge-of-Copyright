# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY client/package*.json ./client/

# Install dependencies
RUN npm ci
RUN cd client && npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Install drizzle-kit for migrations (needed for db setup)
RUN npm install drizzle-kit better-sqlite3

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist

# Copy drizzle config and migrations
COPY drizzle.config.ts ./
COPY src/db/schema.ts ./src/db/
COPY drizzle ./drizzle

# Create data directory for SQLite
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=/data/game.db

# Expose port
EXPOSE 3000

# Start the server
CMD ["node", "dist/server.js"]
