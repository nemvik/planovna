FROM node:22.13.0-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --include=dev

FROM deps AS build
COPY . .
ENV NODE_ENV=production
RUN npm -w apps/web run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY --from=build /app/apps/web /app/apps/web
EXPOSE 3000
CMD ["sh", "-lc", "npm -w apps/web run start"]
