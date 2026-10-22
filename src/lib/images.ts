import data from '../data/commons-images.json';

export interface CommonsImage {
  file: string;
  src: string;
  width: number;
  height: number;
  author: string;
  licence: string;
  licenceUrl?: string;
  page: string;
}

const images = data as Record<string, CommonsImage>;

/** Normalise a Commons file name the same way the fetch script does. */
export function commonsKey(file: string) {
  return file.replace(/^File:/i, '').replace(/_/g, ' ').trim();
}

/** Look up a fetched Commons image. Returns undefined until it has been fetched. */
export function getCommonsImage(file: string): CommonsImage | undefined {
  return images[commonsKey(file)];
}
