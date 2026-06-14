FROM node:22-alpine

WORKDIR /app

RUN npm install --global npm@10.9.8

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 8081

CMD ["npx", "expo", "start", "--lan", "--port", "8081"]
