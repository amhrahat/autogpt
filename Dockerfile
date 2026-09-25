# ---- build stage ----
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# keep only production deps + prisma engines for the runtime image
RUN npm prune --omit=dev

# ---- runtime stage ----
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/main.js"]
