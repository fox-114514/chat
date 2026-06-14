FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source and build
COPY . .
RUN npm run build

# Create storage directory
RUN mkdir -p /app/storage/uploads

ENV NODE_ENV=production
ENV STORAGE_PATH=/app/storage

EXPOSE 3000

CMD ["node", "dist/index.js"]
