FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production nginx stage
FROM nginx:alpine

COPY --from=builder /app/build /usr/share/nginx/html

# React Router support - serve index.html for all routes
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
