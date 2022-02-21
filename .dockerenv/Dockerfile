FROM node:17-buster-slim AS BUILD_IMAGE

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src /app/src

RUN ls -a

RUN npm install

RUN npm run build
RUN npm prune --production

FROM node:17-buster-slim

COPY --from=BUILD_IMAGE /app/package*.json ./
COPY --from=BUILD_IMAGE /app/dist ./dist
COPY --from=BUILD_IMAGE /app/node_modules ./node_modules

cmd npm run start
