FROM node:8.11.3-slim

RUN mkdir -p /syncs

ENV PLEX_MIA_SYNC_DIR=/syncs

WORKDIR /opt/service

COPY src /opt/service/src
COPY static /opt/service/static
COPY package.json yarn.lock tsconfig.json /opt/service/

RUN yarn && yarn run tsc -p tsconfig.json && yarn --production

EXPOSE 8080

CMD [ "node", "lib/index.js" ]
