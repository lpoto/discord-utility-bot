FROM node:17-alpine3.15 AS BUILD_IMAGE

WORKDIR /app

COPY package.json ./
COPY tsconfig.json ./
COPY src /app/src

RUN ls -a

RUN apk add --no-cache bash python3 build-base automake make linux-headers

RUN npm install
RUN npm install -g node-prune

RUN npm run build

RUN npm prune --production
RUN node-prune

FROM node:17-alpine3.15

COPY --from=BUILD_IMAGE /app/package*.json ./
COPY --from=BUILD_IMAGE /app/dist ./dist
COPY --from=BUILD_IMAGE /app/node_modules ./node_modules

RUN apk add --no-cache ffmpeg

CMD npm run start
