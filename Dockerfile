FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build-time environment variable
ARG VITE_API_BASE_URL=http://13.235.143.251:8001/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build application
RUN npm run build

EXPOSE 8002

# Serve static app using Node.js preview server (no Nginx)
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "8002"]
