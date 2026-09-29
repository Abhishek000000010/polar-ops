FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/web/package*.json ./apps/web/

RUN npm install

COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

RUN npm run build:shared && npm run build --workspace=@polar-ops/web

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@polar-ops/web"]
