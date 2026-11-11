# The website on CranL. Every push builds this: the tests run first, and only when they pass is the
# site built and served. A failing test fails the build, so the site already live stays as it was.

FROM node:24-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm test && pnpm build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY tools/serve.ts ./tools/serve.ts
ENV PORT=8080
EXPOSE 8080
CMD ["node", "tools/serve.ts", "dist"]
