FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:24-alpine AS builder
WORKDIR /app

# NEXT_PUBLIC_* values are compiled into the browser bundle by Next.js.
# Easypanel passes them as Docker build arguments; expose only the public Maps
# key and Map ID here. Server-only Google credentials remain runtime secrets.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/db ./db
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
