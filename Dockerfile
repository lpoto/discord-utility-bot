FROM node:16

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src /app/src

RUN ls -a

RUN npm install
RUN npm run build

cmd ["npm", "run", "start"]
