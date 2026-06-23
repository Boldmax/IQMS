FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S iqms -u 1001 && \
    chown -R iqms:nodejs /app

USER iqms

EXPOSE 5000

# Seed on first run, then start
CMD ["node", "index.js"]
