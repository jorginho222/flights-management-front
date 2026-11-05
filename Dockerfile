FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# Local development: docker-compose.yaml mounts the project over this copy.
FROM deps AS dev
ENV NODE_ENV=development
ENV NG_CLI_ANALYTICS=false
COPY --chown=node:node . .
EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0", "--port", "4200"]

FROM deps AS build
ENV NG_CLI_ANALYTICS=false
COPY --chown=node:node . .
RUN npx ng build

FROM nginxinc/nginx-unprivileged:stable-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-render-config.sh /docker-entrypoint.d/40-render-config.sh
COPY --from=build --chown=nginx:nginx /app/dist/flights-management-front/browser /usr/share/nginx/html
EXPOSE 8080
