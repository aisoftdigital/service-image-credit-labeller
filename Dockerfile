# Start with Alpine + Node.js
FROM node:20-alpine

# Install sharp dependencies
RUN apk add --no-cache \
  libc6-compat \
  vips-dev \
  build-base \
  python3 \
  make \
  g++ \
  bash

# Create app directory
WORKDIR /app

# Copy only package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Local temp directory (ephemeral)
RUN mkdir -p /tmp/processing

# Optional: cleanup logic in your Node.js script to clear /tmp/processing after run

# Set environment variables (if needed)
ENV NODE_ENV=production

# Expose the port
EXPOSE 3000

# Run your app
CMD ["node", "index.js"]