FROM node:10.24.1-slim
WORKDIR /usr/app
COPY package.json .
RUN npm install --quiet
COPY . .
