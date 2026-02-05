FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies (cached layer – only rebuilds when package.json or lockfile change)
FROM base AS install
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Final image
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

EXPOSE 8080

CMD ["bun", "run", "index.ts"]