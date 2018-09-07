<p align="center">
  <img src="logo.png" />
</p>

> Plex MIA - Find those pesky missing episodes from your plex box

![Docker Automated build](https://img.shields.io/docker/automated/marshallofsound/plex-mia.svg?style=flat-square) ![Docker Build Status](https://img.shields.io/docker/build/marshallofsound/plex-mia.svg?style=flat-square) [![Docker image](https://img.shields.io/badge/docker-marshallofsound/plex--mia-blue.svg?longCache=true&logo=docker&style=flat-square)](https://hub.docker.com/r/marshallofsound/plex-mia/)

## What is Plex MIA?

This is a simple web app you can link to your plex instance and TVDB to determine which episodes you are missing from your collection.  It does simple comparisons between your plex library and TVDB and presents a simple web UI to see which episodes you are missing.

### Why not use Sonarr?

Sonarr is very heavily leaning towards the downloading of your shows rather than indexing / determining what's missing.  Although it's UI does let you do that I personally do not run Sonarr on the same machine as Plex (I run plex on my media server and Sonarr on my seedbox).  Running a second instance of Sonarr purely for this feature seemed overkill so I made this.

### What does this not do?

Download missing episodes or link to other applications and get them to download them, if you want easy downloading of episodes I would reccomend [Sonarr](https://github.com/Sonarr/Sonarr).

## Getting Started

### Requirements

In order to use Plex MIA you're going to need to already have set up [Tautulli](https://github.com/Tautulli/Tautulli) with your plex server.  You'll need the URL you use to access Tautulli and it's API key.

You'll also need an API key from [TVDB](https://www.thetvdb.com/), API keys are free once you sign up, just head to [TVDB API Keys](https://www.thetvdb.com/member/api) and generate a new key.

### Docker

There's a handy docker image for getting this up and running quickly, run it with a command like below

```bash
docker run \
  -d \
  marshallofsound/plex-mia \
  -p 8085:8085
  -e TAUTULLI_BASE_URL=https://url-to-tautulli.com
  -e TAUTULLI_API_KEY=my-tautulli-key
  -e TVDB_API_KEY=my-tvdb-key
  -e MIA_USERNAME=admin
  -e MIA_PASSWORD=admin
  -v ./path/to/persist/syncs:/syncs
```

The web UI will be accessible at [http://localhost:8085](http://localhost:8085)

### UnRaid

Use `https://github.com/MarshallOfSound/plex-mia` as the templates URL and then choose "Plex MIA" as the template.  Fill out the required variables and launch the docker image.

License
-------

The MIT License (MIT)

Copyright (c) 2018 Samuel Attard

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
