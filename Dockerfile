# Server image for Cloud Run. tsx runs the TypeScript directly — no compile
# step; this is friends-scale, not a build-pipeline showcase.
FROM node:22-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages
RUN npm ci --omit=dev

ENV HOST=0.0.0.0
# Cloud Run injects PORT; dev-server.ts already reads it.
CMD ["npm", "start"]
