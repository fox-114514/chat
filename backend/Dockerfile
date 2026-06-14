FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built artifacts and migrations
COPY --from=builder /app/dist ./dist

# Create storage directory
RUN mkdir -p /app/storage/uploads

ENV NODE_ENV=production
ENV STORAGE_PATH=/app/storage

EXPOSE 3000

CMD ["node", "dist/index.js"]
