FROM node:10.23-slim
WORKDIR /usr/app
COPY package.json .
RUN npm install --quiet
COPY . .
