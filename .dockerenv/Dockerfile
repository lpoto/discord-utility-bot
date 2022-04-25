FROM node:17-alpine3.15 AS BUILD_IMAGE

WORKDIR /app

COPY . ./

RUN ls -a

RUN apk add --no-cache bash python3 build-base automake make linux-headers

RUN npm install
RUN npm install -g node-prune

RUN npm run build

RUN npm prune --production
RUN node-prune

FROM alpine:3.15.2

RUN apk add --no-cache nodejs ffmpeg
RUN addgroup -S node && adduser -S node -G node

USER node

COPY --from=BUILD_IMAGE --chown=node:node /app/package*.json ./
COPY --from=BUILD_IMAGE --chown=node:node /app/dist ./dist
COPY --from=BUILD_IMAGE --chown=node:node /app/node_modules ./node_modules


CMD node dist/index.js
