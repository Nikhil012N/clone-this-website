# clone-this-website

> Enterprise-grade cross-platform website mirroring engine and web crawler with Dual Engine execution, programmatic SDK, and Command Line Interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](index.d.ts)

---

## Overview

`clone-this-website` is a modular, high-performance website mirroring engine designed for enterprise environments. It provides both a programmable Node.js/TypeScript SDK and a scriptable CLI for automated pipelines, archiving workflows, and offline site replication.

### Key Capabilities

- **Dual Engine Architecture**:
  - **Native Engine (`native`)**: Pure Node.js recursive crawler and asset rewriter powered by Cheerio and Axios. Operates with zero external binary dependencies, making it suitable for restricted environments, non-root Docker containers, and locked-down CI/CD workers.
  - **System Engine (`system`)**: Streamed execution utilizing system-installed `wget` for high-throughput raw mirrors.
  - **Automated Engine Selection (`auto`)**: Dynamically resolves the optimal engine based on host capabilities.
- **Deep Asset Localization**: Traverses and rewrites internal links, scripts, stylesheets, images, and fonts to relative paths for offline browsing.
- **Enterprise Network Controls**: Support for authenticated HTTP/HTTPS proxies, custom request headers, configurable User-Agent strings, and rate-limiting timeouts.
- **Automated Compression & Bundling**: Integrated archiving supporting `.zip` and `.tar.gz` output generation.
- **CI/CD Integration**: Supports `--json` flags for structured output ingestion into observability pipelines and automated runners.
- **Declarative Configuration**: Automatically loads options from `.clonerc`, `.clonerc.json`, or custom config files.

---

## Installation

### Global Installation (CLI)

```bash
npm install -g clone-this-website
```

### Local Dependency (SDK)

```bash
npm install clone-this-website
```

---

## Command Line Interface

### Quick Start

```bash
# Basic usage
clone-this-website https://example.com

# Explicit output directory and engine selection
clone-this-website https://example.com --engine native -o ./mirrors/example

# Mirror with immediate zip compression
clone-this-website https://example.com --zip

# Limit recursion depth and rate-limit requests
clone-this-website https://example.com -m 2 -d 1

# Corporate proxy and custom user agent
clone-this-website https://example.com --proxy http://proxy.internal:8080 -u "CustomMirrorService/1.0"

# Exclude media formats
clone-this-website https://example.com -e "mp4,mp3,pdf,zip"

# Machine-readable JSON output for automated pipelines
clone-this-website https://example.com --json
```

### CLI Options Reference

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <dir>` | Destination directory for cloned assets | Target hostname |
| `--config <path>` | Path to custom configuration file | Auto-detected |
| `--engine <type>` | Engine choice: `auto`, `native`, or `system` | `auto` |
| `-m, --max-depth <n>` | Maximum recursion crawl depth | `3` |
| `-c, --concurrency <n>` | Maximum concurrent connections (Native Engine) | `5` |
| `-d, --delay <s>` | Throttle delay between requests in seconds | `0` |
| `-z, --zip` | Generate `.zip` archive upon completion | `false` |
| `--tar` | Generate `.tar.gz` archive upon completion | `false` |
| `-u, --user-agent <s>` | Custom HTTP User-Agent header | Default client agent |
| `--proxy <url>` | HTTP/HTTPS proxy endpoint URL | None |
| `-e, --exclude <ext>` | Comma-separated list of file extensions to skip | None |
| `-s, --skip-test` | Bypass target accessibility pre-check | `false` |
| `-f, --force` | Force cloning even if accessibility check fails | `false` |
| `-v, --verbose` | Enable verbose diagnostic logging | `false` |
| `--json` | Emit structured JSON output | `false` |
| `-i, --interactive` | Launch step-by-step interactive configuration prompt | `false` |

---

## Programmatic SDK

The package exports a fully-typed programmatic API for Node.js and TypeScript services.

### JavaScript (CommonJS & ESM)

```javascript
const { WebsiteCloner } = require('clone-this-website');

async function mirror() {
  const cloner = new WebsiteCloner({
    engine: 'native',
    output: './mirrors/example',
    maxDepth: 2,
    concurrency: 5,
    zip: true,
    exclude: 'pdf,mp4'
  });

  cloner.on('progress', (data) => {
    console.log(`Downloaded ${data.count} resources`);
  });

  const result = await cloner.clone('https://example.com');
  console.log('Mirror completed:', result);
}

mirror().catch(console.error);
```

### TypeScript

```typescript
import { WebsiteCloner, CloneResult, ProgressData } from 'clone-this-website';

const cloner = new WebsiteCloner({
  engine: 'native',
  maxDepth: 3,
  concurrency: 8,
  timeout: 10000
});

cloner.on('progress', (data: ProgressData) => {
  console.log(`Fetched: ${data.count} files`);
});

const result: CloneResult = await cloner.clone('https://example.com');
console.log(`Mirror saved to: ${result.outputDir} (${result.formattedSize})`);
```

---

## Configuration File Support

Options can be defined declaratively in `.clonerc.json` or `cloner.config.js`:

```json
{
  "engine": "native",
  "maxDepth": 3,
  "concurrency": 10,
  "zip": true,
  "exclude": "mp4,mkv,avi,zip",
  "headers": {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN"
  }
}
```

---

## Verification and Testing

Execute the comprehensive unit and integration test suite:

```bash
npm test
```

---

## Specification & API Types

Type declarations are bundled within [`index.d.ts`](index.d.ts).

- `WebsiteCloner`: Core orchestration class extending `EventEmitter`.
- `NativeEngine`: Zero-dependency recursive crawler and HTML/CSS asset rewriter.
- `SystemEngine`: High-performance execution wrapper for system `wget`.
- `Logger`: Configurable diagnostic logger supporting level filtering and JSON formatting.
- `config`: Configuration loading and parsing utilities.
- `utils`: File statistics, path sanitation, and compression helpers.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
