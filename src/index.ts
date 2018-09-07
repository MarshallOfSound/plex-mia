import * as compression from 'compression';
import * as express from 'express';
import * as expressWs from 'express-ws';
import * as fs from 'fs';
import * as path from 'path';
import * as uuid from 'uuid';
import * as WebSocket from 'ws';

import { PlexLibrary } from './loader/PlexLibrary';
import { RawProgress } from './loader/ServiceLoadProgress';
import { TVDBLoader } from './loader/TVDBLoader';

const {
  TAUTULLI_BASE_URL,
  TAUTULLI_API_KEY,
  TVDB_API_KEY,
  MIA_USERNAME,
  MIA_PASSWORD,
  PLEX_MIA_SYNC_DIR,
} = process.env;

if (!MIA_USERNAME || MIA_USERNAME.length < 2) {
  console.error(`MIA_USERNAME: "${MIA_USERNAME}" is too short or undefined`);
  process.exit(1);
}

if (!MIA_PASSWORD || MIA_PASSWORD.length < 10) {
  console.error(`MIA_PASSWORD: "************" is too short or undefined`);
  process.exit(1);
}

const basicAuth = require('express-basic-auth')
const basicAuthMiddleware = basicAuth({
  users: {
    [MIA_USERNAME!]: MIA_PASSWORD!,
  },
  challenge: true,
  realm: `PlexMiaRealm-${process.env.MIA_USERNAME}`,
});

type WSMessage = {
  type: 'key';
  value: string;
} & {
  type: 'refresh';
};

const app = express();
const ws = expressWs(app);

const keys = new Set<string>();

app.use(compression());

app.get('/', (req, res) => res.redirect('/~'));

app.use('/~', basicAuthMiddleware, express.static(path.resolve(__dirname, '..', 'static')));
app.use('/~/js', basicAuthMiddleware, express.static(path.resolve(__dirname, 'public-js')));

const syncPath = path.resolve(PLEX_MIA_SYNC_DIR || __dirname, 'sync.json');

app.get('/latest', basicAuthMiddleware, (req, res) => {
  if (fs.existsSync(syncPath)) {
    res.json({ latest: fs.readFileSync(syncPath, 'utf8') });
  } else {
    res.json({ latest: null });
  }
});

app.post('/key', basicAuthMiddleware, (req, res) => {
  const key = uuid.v4();
  keys.add(key);
  res.json({ key });
});

let refreshProgress: {
  plex: RawProgress,
  tvdb: RawProgress,
} | null = null;

const subbed: WebSocket[] = [];

const refresh = () => {
  if (refreshProgress) return;

  const library = new PlexLibrary({
    baseURL: TAUTULLI_BASE_URL!,
    apiKey: TAUTULLI_API_KEY!,
  });
  const tvdb = new TVDBLoader(TVDB_API_KEY!);

  const broadcast = (update = true) => {
    if (update) {
      refreshProgress = {
        plex: library.progress.inspect(),
        tvdb: tvdb.progress.inspect(),
      };
    }
    for (const client of subbed) {
      if (client.readyState !== client.OPEN) continue;
      client.send(JSON.stringify({ refreshProgress }));
    }
  };

  broadcast();
  
  library.on('progress', broadcast);
  tvdb.on('progress', broadcast);
  
  library.load().then((showLibraries) => {
    return tvdb.load(showLibraries);
  }).then((missing) => {
    fs.writeFileSync(syncPath, JSON.stringify(missing));
    refreshProgress = null;
    broadcast(false);
  }).catch((err) => {
    console.error(err);
    refreshProgress = null;
    broadcast(false);
  });
};

ws.app.ws('/socket', (socket) => {
  let allowed = false;

  socket.on('message', (data) => {
    let message: WSMessage;
    try {
      message = JSON.parse(data.toString());
    } catch (err) {
      return;
    }
    if (message.type === 'key') {
      if (keys.has(message.value)) {
        allowed = true;
        socket.send(JSON.stringify({ refreshProgress }));
        if (!subbed.find(s => s === socket)) {
          subbed.push(socket);
        }
      } else {
        socket.close();
      }
      return;
    }
    if (!allowed) return;

    switch (message.type) {
      case 'refresh':
        refresh();
        return;
    }
  });
});

app.use(basicAuthMiddleware, (req, res) => res.send('Not Found'));

const port = process.env.PORT || 8085;
app.listen(port, () => {
  console.log('MIA running on: ', port)
});
