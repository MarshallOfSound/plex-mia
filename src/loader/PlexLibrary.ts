import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { IQueue } from 'queue';
import * as querystring from 'querystring';
import { ServiceLoadProgress, Progressable } from './ServiceLoadProgress';

var queue: IQueue = require('queue');

type TautulliCommand = 'get_libraries' | 'get_library_media_info';

interface TResponse<T> {
  response: {
    message: string | null;
    data: T;
    result: 'success' | 'failure';
  };
}

interface FilterResponse<T> {
  draw: number;
  recordsTotal: number;
  total_file_size: number;
  recordsFiltered: number;
  filtered_file_size: number;
  data: T | 'null';
}

export interface Library {
  /**
   * Number of items in the library (shows / movies / artists)
   */
  count: string;
  /**
   * Number of items in the items in the library (episodes)
   */
  child_count: string;
  section_type: 'movie' | 'artist' | 'show';
  section_id: string;
  section_name: string;
  shows?: Show[];
}

interface Show {
  title: string;
  sort_title: string;
  year: string;
  rating_key: string;
  section_id: string;
  seasons?: Season[];
}

export interface Season {
  title: string;
  sort_title: string;
  rating_key: string;
  section_id: string;
  parent_rating_key: string;
  episodes?: Episode[];
  media_index: string;
}

export interface Episode {
  title: string;
  sort_title: string;
  file_size: string;
  year: string;
  video_resolution: string;
  bitrate: string;
  video_codec: string;
  media_index: string;
}

export class PlexLibrary extends EventEmitter implements Progressable {
  public readonly progress: ServiceLoadProgress = new ServiceLoadProgress(this);

  onProgress() {
    this.emit('progress', this.progress.inspect());
  }
  
  constructor(private opts: {
    baseURL: string;
    apiKey: string;
  }) {
    super();
  }

  private request = async <T>(cmd: TautulliCommand, extraQuery: Record<string, string> = {}): Promise<T> => {
    let extraQString = querystring.stringify(extraQuery);
    if (extraQString.length) {
      extraQString = `&${extraQString}`;
    }
    const url = `${this.opts.baseURL}${this.opts.baseURL.endsWith('/') ? '' : '/'}api/v2?apikey=${this.opts.apiKey}&cmd=${cmd}&length=500${extraQString}`;
    const response = await fetch(url);
    return await response.json();
  }

  private data = <T>(response: TResponse<T>) => response.response.data;

  private async getLibraries() {
    return this.data(await this.request<TResponse<Library[]>>('get_libraries'));
  }

  private async getShows(showLibrary: Library) {
    const response = this.data(await this.request<TResponse<FilterResponse<Show[]>>>('get_library_media_info', { section_id: showLibrary.section_id }));
    if (response.data === 'null') return [];
    return response.data;
  }

  private async getSeasons(show: Show) {
    const response = this.data(await this.request<TResponse<FilterResponse<Season[]>>>('get_library_media_info', { section_id: show.section_id, rating_key: show.rating_key }));
    if (response.data === 'null') return [];
    return response.data;
  }

  private async getEpisodes(season: Season) {
    const response = this.data(await this.request<TResponse<FilterResponse<Episode[]>>>('get_library_media_info', { section_id: season.section_id, rating_key: season.rating_key }));
    if (response.data === 'null') return [];
    return response.data;
  }

  async load() {
    this.onProgress();
    const q = queue({
      concurrency: 5,
    });
    q.stop();

    const tvLibraries = (await this.getLibraries()).filter(l => l.section_type === 'show');
    this.progress.determined(tvLibraries.reduce((sum, lib) => sum + parseInt(lib.child_count, 10), 0));

    for (const lib of tvLibraries) {
      q.push(async () => {
        const shows = await this.getShows(lib);
        lib.shows = shows;

        for (const show of shows) {
          q.push(async () => {
            const seasons = await this.getSeasons(show);
            show.seasons = seasons;

            for (const season of seasons) {
              q.push(async () => {
                const episodes = await this.getEpisodes(season);
                season.episodes = episodes;

                this.progress.didWork(episodes.length);
              });
            }
          });
        }
      });
    }

    await new Promise(r => q.start(r));
    return tvLibraries;
  }
}