# One image for the API and the worker. The API also serves the built React app (same origin, no CORS).
FROM node:22-alpine AS web
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY --from=web /app/frontend/dist /app/frontend/dist
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]
