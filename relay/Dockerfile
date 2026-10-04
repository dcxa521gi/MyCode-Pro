FROM node:22-alpine
WORKDIR /app
COPY scripts/remote-relay.mjs /app/remote-relay.mjs
ENV HOST=0.0.0.0 PORT=8787
USER node
EXPOSE 8787
CMD ["node", "/app/remote-relay.mjs"]
