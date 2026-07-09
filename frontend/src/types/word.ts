export interface Word {
  id: number;
  part: string;
  list: string;
  word: string;
  phonetic: string;
  meaning: string;
}

export interface PartInfo {
  name: string;
  lists: ListInfo[];
  total: number;
}

export interface ListInfo {
  name: string;
  total: number;
}

export interface Progress {
  [listKey: string]: {
    reviewed: number;
    total: number;
  };
}

export type ListKey = string; // `${part}::${list}`
