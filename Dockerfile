FROM node:19.0.0-alpine3.16 as builder

ADD . .
ENV NODE_ENV=production
RUN npm install

FROM gcr.io/distroless/nodejs20-debian11

COPY --from=builder /package.json /
COPY --from=builder /node_modules /node_modules
COPY --from=builder /src /src

WORKDIR /src
EXPOSE 51201
CMD ["app.js"]