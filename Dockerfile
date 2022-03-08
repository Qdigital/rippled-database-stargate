FROM node:10-slim
WORKDIR /usr/app
COPY package.json .
RUN npm install --quiet
COPY . .
