FROM node:18-alpine

WORKDIR /app

COPY backend ./backend

WORKDIR /app/backend

RUN npm install

EXPOSE 9000

CMD ["node", "server.js"]