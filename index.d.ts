import { EventEmitter } from 'events';

export type EngineType = 'auto' | 'native' | 'system';
export type ArchiveFormat = 'tar' | 'zip';

export interface ClonerOptions {
  engine?: EngineType;
  output?: string;
  maxDepth?: number;
  concurrency?: number;
  delay?: number;
  timeout?: number;
  zip?: boolean;
  archiveFormat?: ArchiveFormat;
  verbose?: boolean;
  json?: boolean;
  skipTest?: boolean;
  force?: boolean;
  userAgent?: string;
  proxy?: string;
  exclude?: string;
  headers?: Record<string, string>;
  allowCrossOriginAssets?: boolean;
  extractMarkdown?: boolean; // AI / LLM ingestion mode: outputs clean .md alongside HTML
}

export interface ArchiveResult {
  path: string;
  sizeBytes: number;
  formattedSize: string;
}

export interface CloneResult {
  url: string;
  outputDir: string;
  engine: string;
  totalFiles: number;
  totalSizeBytes: number;
  formattedSize: string;
  archive: ArchiveResult | null;
}

export interface ProgressData {
  count?: number;
  url?: string;
  file?: string;
  queueLength?: number;
  raw?: string;
}

export declare class WebsiteCloner extends EventEmitter {
  constructor(options?: ClonerOptions);
  clone(targetUrl: string): Promise<CloneResult>;
  testUrl(url: string): Promise<{ success: boolean; status?: number; error?: string }>;
  resolveOutputDir(url: string): string;

  on(event: 'start', listener: (data: { url: string }) => void): this;
  on(event: 'progress', listener: (data: ProgressData) => void): this;
  on(event: 'archived', listener: (data: ArchiveResult) => void): this;
  on(event: 'complete', listener: (data: CloneResult) => void): this;
}

export declare class NativeEngine {
  constructor(options?: ClonerOptions);
  run(targetUrl: string, outputDir: string, onProgress?: (progress: ProgressData) => void): Promise<{
    outputDir: string;
    engine: 'native';
    filesDownloaded: number;
    totalDiscovered: number;
  }>;
  abort(): void;
}

export declare class SystemEngine {
  constructor(options?: ClonerOptions);
  static isAvailable(): Promise<boolean>;
  static ensureBinary(): Promise<boolean>;
  run(targetUrl: string, outputDir: string, onProgress?: (progress: ProgressData) => void): Promise<{
    outputDir: string;
    engine: 'system';
    fileCount: number;
  }>;
}

export declare class Logger extends EventEmitter {
  constructor(options?: { level?: string; json?: boolean });
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}

export declare const config: {
  loadConfigFile(customPath?: string, workingDir?: string): Record<string, any>;
  mergeConfig(defaults: Record<string, any>, fileConfig?: Record<string, any>, cliConfig?: Record<string, any>): Record<string, any>;
  CONFIG_FILENAMES: string[];
};

export declare const utils: {
  formatBytes(bytes: number): string;
  countFiles(dir: string): number;
  getDirectorySize(dir: string): number;
  archiveDirectory(dir: string, format?: ArchiveFormat): Promise<{ path: string; size: number }>;
  validateUrl(input: string): boolean;
  sanitizePath(urlPath: string): string;
};
