FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

RUN npm install

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run build:shared && npm run build --workspace=@polar-ops/api

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=@polar-ops/api"]
