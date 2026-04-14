FROM node:18-alpine

# Set working directory and create uploads folder with correct permissions
WORKDIR /app
COPY backend ./backend

# Use the non-root node user provided by the image
RUN chown -R node:node /app
USER node

WORKDIR /app/backend
RUN npm install

EXPOSE 9000
CMD ["node", "server.js"]