interface RawProgress {
  indeterminate: boolean;
  completed: number;
  total: number;
}

const loadLatest = async () => {
  const response = await fetch('/latest', { credentials: 'include' });
  renderMissing((await response.json()).latest);
};

const renderSyncProgress = (progress: { plex: RawProgress; tvdb: RawProgress } | null) => {
  const container = $('#sync-progress');
  const plex = $('#plex-progress');
  const tvdb = $('#tvdb-progress');

  if (!progress) {
    container.css('display', 'none');
    loadLatest();
    return;
  }

  container.css('display', 'block');

  const handle = (elem: JQuery<HTMLElement>, progress: RawProgress) => {
    if (progress.indeterminate) {
      elem.addClass('progress-bar-animated')
        .css('width', '100%');
      elem.find('div').text('Pending')
        .removeClass('bg-success')
        .addClass('bg-warning');
    } else {
      elem.removeClass('progress-bar-animated')
        .css('width', `${progress.total ? Math.round(progress.completed / progress.total * 100) : 0}%`);
      elem.find('div').text(`${progress.completed} / ${progress.total}`)
        .addClass('bg-success')
        .removeClass('bg-warning');
    }
  };
  handle(plex, progress.plex);
  handle(tvdb, progress.tvdb);
}

const getSocket = async () => {
  const socket = new WebSocket(`${location.protocol === 'http:' ? 'ws:' : 'wss:'}//${location.host}/socket`);
  const openPromise = new Promise(resolve => socket.addEventListener('open', resolve));
  const keyResponse = await fetch('/key', { credentials: 'include', method: 'POST' });
  const { key } = await keyResponse.json();
  await openPromise;
  socket.send(JSON.stringify({ type: 'key', value: key }));
  (window as any).s = socket;
  return socket;
};

const renderMissing = (rawMissing: any) => {
  const accordion = $('#accordion');
  if (!rawMissing) {
    accordion.css('display', 'none');
    return;
  }

  accordion.css('display', 'block');
  accordion.find('.card').remove();

  const missing = JSON.parse(rawMissing).sort((a: any, b: any) => a.name.localeCompare(b.name));
  for (const show of missing) {
    const goodSeasons = show.seasons.filter((a: any) => a);
    const totalAcquired = goodSeasons.reduce((total: number, season: any) => total + season.acquiredEpisodes, 0);
    const totalAll = goodSeasons.reduce((total: number, season: any) => total + season.totalEpisodes, 0);
    const totalMissing = totalAll - totalAcquired;

    accordion.append($(
`<div class="card">
  <div class="card-header" id="showHeading${show.seriesInfo.id}">
    <h5 class="mb-0">
      <button class="btn btn-link" data-toggle="collapse" data-target="#show${show.seriesInfo.id}">
        ${show.name}
      </button>
      <div style="float: right; position: relative; top: 10px; right: 10px; display: flex;">
        <div style="font-size: 0.9rem; margin-right: 8px; display: flex; align-items: center;">
          ${totalAcquired}/${totalAll}
        </div>
        <div class="progress" style="height: 20px; width: 100px;">
          <div class="progress-bar ${totalMissing === 0 ? 'bg-success' : (totalMissing >= 10 ? 'bg-danger' : 'bg-warning')}" style="width: ${Math.round(totalAcquired / totalAll * 100)}%;"></div>
        </div>
      </div>
    </h5>
  </div>

  <div id="show${show.seriesInfo.id}" class="collapse" data-parent="#accordion">
    <div class="card-body">
      <div class="flex">
        <img src="https://www.thetvdb.com/banners/${show.seriesPosters[0].fileName}" class="s-image" />
        <p class="overview">${show.seriesInfo.overview}</p>
      </div>

      <div id="accordion${show.seriesInfo.id}">
        ${goodSeasons.map((goodSeason: any) => {
          const seasonMissing = goodSeason.totalEpisodes - goodSeason.acquiredEpisodes;
          return `<div class="card">
<div class="card-header" id="showSeasonHeading${show.seriesInfo.id}-${goodSeason.number}">
  <h5 class="mb-0">
    <button class="btn btn-link" data-toggle="collapse" data-target="#showSeason${show.seriesInfo.id}-${goodSeason.number}">
      Season ${goodSeason.number}
    </button>
    <div style="float: right; position: relative; top: 10px; right: 10px; display: flex;">
      <div style="font-size: 0.9rem; margin-right: 8px; display: flex; align-items: center;">
        ${goodSeason.acquiredEpisodes}/${goodSeason.totalEpisodes}
      </div>
      <div class="progress" style="height: 20px; width: 100px;">
        <div class="progress-bar ${seasonMissing === 0 ? 'bg-success' : (seasonMissing >= 6 ? 'bg-danger' : 'bg-warning')}" style="width: ${Math.round(goodSeason.acquiredEpisodes / goodSeason.totalEpisodes * 100)}%;"></div>
      </div>
    </div>
  </h5>
</div>

<div id="showSeason${show.seriesInfo.id}-${goodSeason.number}" class="collapse" data-parent="#accordion${show.seriesInfo.id}">
  <div class="card-body">
    <div id="accordion${show.seriesInfo.id}">
      ${goodSeason.allEpisodes.sort((a: any, b: any) => a.airedEpisodeNumber - b.airedEpisodeNumber).map((episode: any) => {
        const isMissing = goodSeason.missingEpisodes.find((e: any) => e.id === episode.id);
        return `<div class="card">
  <div class="card-header" id="showSeasonHeading${show.seriesInfo.id}-${goodSeason.number}">
    <h5 class="mb-0">
      <button class="btn btn-link">
      ${episode.airedEpisodeNumber} - ${episode.episodeName}
      </button>
      ${isMissing ? `
<div style="float: right; height: 40px; display: flex; align-items: center; margin-right: 8px;">
  <span style="font-size: 0.9rem;">
    Missing
  </span>
  <i class="material-icons" style="border-radius: 100%; padding: 4;">close</i>
</div>` : ''}
    </h5>
  </div>
</div>`;
      }).join('\n')}
    </div>
  </div>
</div>
</div>`;
        }).join('\n')}
      </div>
    </div>
  </div>
</div>`
    ));
  }
};

getSocket().then(socket => {
  socket.addEventListener('message', (event) => {
    const { refreshProgress } = JSON.parse(event.data);
    renderSyncProgress(refreshProgress);
  });

  $('#refresh-button').click(() => {
    socket.send(JSON.stringify({ type: 'refresh' }));
  });
});
