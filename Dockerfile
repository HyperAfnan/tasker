FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=deps --chown=bun:bun /app/package.json ./package.json

COPY --chown=bun:bun commands ./commands
COPY --chown=bun:bun events ./events
COPY --chown=bun:bun models ./models
COPY --chown=bun:bun utils ./utils
COPY --chown=bun:bun scripts ./scripts
COPY --chown=bun:bun db.ts index.ts tsconfig.json ./

USER bun

CMD ["bun", "run", "index.ts"]
