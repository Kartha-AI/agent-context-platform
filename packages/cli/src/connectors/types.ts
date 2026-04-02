export type RawRecord = Record<string, string>;

export interface Connector {
  type: string;
  extract(filePath: string): Promise<RawRecord[]>;
}
