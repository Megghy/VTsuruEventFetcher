FROM node:alpine
WORKDIR /app
COPY package.json .
RUN yarn install
COPY . .
EXPOSE 51201
CMD ["node", "app.js"]