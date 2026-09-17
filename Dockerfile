FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY . .

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

RUN echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}" >> .env.production && \
    echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}" >> .env.production

RUN npm run build

FROM oven/bun:1.3-slim AS runner
WORKDIR /app
COPY --from=builder /app/.output ./.output
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["bun", ".output/server/index.mjs"]
