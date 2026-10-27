# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

# Solo los manifiestos: así la capa de `npm ci` se reutiliza mientras no cambien.
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

# Árbol de dependencias sin las de desarrollo, para la imagen final.
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json

# Los enlaces de node_modules/@rokai/* apuntan aquí; hace falta el package.json
# de cada workspace además de su `dist`.
COPY --from=build /app/packages/config/package.json ./packages/config/package.json
COPY --from=build /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build /app/packages/db/package.json ./packages/db/package.json
COPY --from=build /app/packages/db/dist ./packages/db/dist
COPY --from=build /app/packages/db/drizzle ./packages/db/drizzle
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist

# `registerWeb()` resuelve apps/web/dist desde apps/api/dist.
COPY --from=build /app/apps/web/dist ./apps/web/dist

USER node
EXPOSE 3000
# La semilla es idempotente (solo rellena catálogos vacíos y respeta los ajustes
# editados), así que puede correr en cada arranque: sin ella el despliegue queda
# sin tarifas, equipos ni plantillas.
CMD ["sh", "-c", "node packages/db/dist/migrate.js && node packages/db/dist/seed.js && node apps/api/dist/server.js"]
