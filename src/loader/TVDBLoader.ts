import { EventEmitter } from 'events';

import { ServiceLoadProgress, Progressable } from './ServiceLoadProgress';
import { Library, Episode, Season } from './PlexLibrary';
import { IQueue } from 'queue';

const queue: IQueue = require('queue');
const TVDB = require('node-tvdb');

type SeasonedEpisode = Episode & { season: Season; };
interface TVDBEpisode {
  id: number;
  airedSeason: number;
  airedEpisodeNumber: number;
  episodeName: string;
}

interface SeriesInfo {
  status: string;
  slug: string;
  seriesName: string;
  overview: string;
  network: string;
  id: number;
  firstAired: string;
  banner: string;
  aliases: string[];
}

interface Poster {
  id: number;
  fileName: string;
  resolution: string;
  ratingsInfo: {
    average: number;
    count: number;
  }
  thumbnail: string;
}

interface ShowStats {
  name: string;
  seriesInfo: SeriesInfo;
  seriesPosters: Poster[];
  seasons: SeasonStats[];
}

interface SeasonStats {
  number: number;
  totalEpisodes: number;
  acquiredEpisodes: number;
  missingEpisodes: TVDBEpisode[];
  allEpisodes: { id: number; episodeName: string; airedEpisodeNumber: number; }[];
}

export class TVDBLoader extends EventEmitter implements Progressable {
  public readonly progress: ServiceLoadProgress = new ServiceLoadProgress(this);
  private tvdb: any;

  constructor(private apiKey: string) {
    super();
    this.tvdb = new TVDB(this.apiKey);
  }

  onProgress() {
    this.emit('progress', this.progress.inspect());
  }

  private getSeries = async (title: string, year: string) => {
    const series: any[] = await this.tvdb.getSeriesByName(title);
    if (series.length === 1) {
      return series[0];
    }
    return series.find(s => s.firstAired.startsWith(year)) || (series.length === 0 ? null : series[0]);
  }

  private getMissing = (from: TVDBEpisode[], episodes: SeasonedEpisode[]): TVDBEpisode[] => {
    return from.filter((te) => {
      return !episodes.some(e => parseInt(e.season.media_index, 10) === te.airedSeason && parseInt(e.media_index, 10) === te.airedEpisodeNumber)
        && te.airedEpisodeNumber && te.episodeName;
    });
  }

  async load(plexLibraries: Library[]) {
    const shows: ShowStats[] = [];
    const q = queue({
      concurrency: 10,
    });
    q.stop();
    this.progress.determined(plexLibraries.reduce((sum, lib) => sum + parseInt(lib.count, 10), 0));

    for (const library of plexLibraries) {
      for (const show of library.shows!) {
        q.push(async () => {
          const seasons: SeasonStats[] = [];

          const plexEpisodes = show.seasons!.reduce((episodes, season) => episodes.concat(season.episodes!.map(e => Object.assign({ season }, e))), [] as SeasonedEpisode[]);
          const series = await this.getSeries(show.title, show.year);
          const episodes: TVDBEpisode[] = await this.tvdb.getEpisodesBySeriesId(series.id);
          const missing = this.getMissing(episodes, plexEpisodes);

          const stat: ShowStats = {
            name: show.title,
            seriesInfo: series,
            seriesPosters: await this.tvdb.getSeriesImages(series.id, 'poster'),
            seasons,
          };

          for (const e of episodes) {
            if (!seasons[e.airedSeason] && e.airedSeason) {
              seasons[e.airedSeason - 1] = {
                acquiredEpisodes: plexEpisodes.filter(pe => pe.season.media_index === `${e.airedSeason}`).length,
                totalEpisodes: episodes.filter(ee => ee.airedSeason === e.airedSeason && ee.episodeName && ee.airedEpisodeNumber).length,
                missingEpisodes: missing.filter(ee => ee.airedSeason === e.airedSeason),
                allEpisodes: episodes.filter(ee => ee.airedSeason === e.airedSeason).map(e => ({ id: e.id, episodeName: e.episodeName, airedEpisodeNumber: e.airedEpisodeNumber })),
                number: e.airedSeason,
              };
            }
          }

          shows.push(stat);

          this.progress.didWork(1);
        });
      }
    }

    await new Promise(r => q.start(r));
    return shows;
  }
}
