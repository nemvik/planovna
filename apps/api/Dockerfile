FROM node:22.13.0-bookworm-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --include=dev

FROM deps AS build
COPY . .
RUN npm -w apps/api run prisma:generate
RUN npm -w apps/api run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --include=dev
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/prisma /app/apps/api/prisma
COPY --from=build /app/apps/api/generated /app/apps/api/generated
COPY --from=build /app/apps/api/prisma.config.ts /app/apps/api/prisma.config.ts
EXPOSE 3000
CMD ["sh", "-lc", "npm -w apps/api run prisma:migrate:deploy && npm -w apps/api run start:prod"]
