# clone-this-website

> Ultra-lightweight enterprise website mirroring engine and AI crawler with Dual Engine execution, zero-vulnerability footprint, and automated LLM/RAG Markdown extraction.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![Vulnerabilities](https://img.shields.io/badge/vulnerabilities-0-brightgreen.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-blue.svg)](index.d.ts)

---

## Overview

`clone-this-website` is a minimal, high-performance website mirroring engine engineered for modern enterprise infrastructures and AI data pipelines. It provides both a programmable Node.js/TypeScript SDK and an instant-execution CLI runnable directly via `npx`.

### Architectural Highlights

- **Near-Zero External Dependencies**: Engineered with only 1 external dependency (`cheerio` for HTML/CSS DOM parsing). All networking, CLI parsing, progress streaming, and compression use native Node.js built-ins (`fetch`, `readline`, `zlib`, `stream`).
- **Zero Vulnerabilities**: 100% clean security profile verified by `npm audit` with 0 warnings.
- **Enterprise Security Hardening**: Built-in `SecurityManager` for path traversal mitigation (Zip Slip protection) and header injection sanitization.
- **Transient Failure Resilience**: `RetryHandler` with exponential backoff and randomized jitter for network-resilient crawling.
- **AI & RAG Ready (`--markdown`, `--ai`)**: Automatically strips non-content elements (`<script>`, `<nav>`, `<footer>`, `<svg>`, `<iframe>`) and generates clean semantic Markdown alongside mirrored assets for ingestion into vector stores (Pinecone, Chroma, Qdrant) and LLM contexts.
- **Dual Engine Architecture**:
  - **Native Engine (`native`)**: Pure Node.js recursive crawler and asset rewriter. Works in restricted containers, non-root environments, and locked-down CI/CD workers without external binaries.
  - **System Engine (`system`)**: Streamed execution utilizing system `wget` for high-throughput raw mirrors.
  - **Automated Engine Selection (`auto`)**: Dynamically resolves the optimal engine based on host capabilities.
- **Native USTAR Tar.gz Archiving**: High-performance streaming compression powered by Node's native `zlib`—no external unmaintained compression libraries.
- **Enterprise Network Controls**: Support for authenticated proxies, custom request headers, configurable User-Agent strings, and rate-limiting timeouts.
- **Declarative Configuration**: Automatically loads options from `.clonerc`, `.clonerc.json`, or custom config files.

---

## Installation & Execution

### Zero-Install Execution via npx

Run instantly in any terminal or CI/CD runner without global installation:

```bash
# Direct execution via npx
npx clone-this-website https://example.com

# AI Pipeline: Extract clean Markdown for RAG / LLMs
npx clone-this-website https://example.com --ai

# Interactive prompt wizard
npx clone-this-website
```

### Global Installation (CLI)

```bash
npm install -g clone-this-website

# Run via primary command:
clone-this-website https://example.com

# Or via the short alias:
cloner https://example.com
```

### Local Dependency (Programmatic SDK)

```bash
npm install clone-this-website
```

---

## Command Line Interface

### Quick Start

```bash
# Basic usage
npx clone-this-website https://example.com

# AI Pipeline: Mirror site and generate clean Markdown for LLM ingestion
npx clone-this-website https://example.com --ai

# Mirror and package into a compressed tar.gz bundle
npx clone-this-website https://example.com --zip

# Limit recursion depth and rate-limit requests
npx clone-this-website https://example.com -m 2 -d 1

# Corporate proxy and custom user agent
npx clone-this-website https://example.com --proxy http://proxy.internal:8080 -u "CustomMirrorService/1.0"

# Exclude media formats
npx clone-this-website https://example.com -e "mp4,mp3,pdf,zip"

# Machine-readable JSON output for automated CI/CD pipelines
npx clone-this-website https://example.com --json
```

### CLI Options Reference

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <dir>` | Destination directory for cloned assets | Target hostname |
| `--config <path>` | Path to custom configuration file | Auto-detected |
| `--engine <type>` | Engine choice: `auto`, `native`, or `system` | `auto` |
| `--markdown`, `--ai` | Extract clean Markdown alongside HTML for LLMs/RAG | `false` |
| `-m, --max-depth <n>` | Maximum recursion crawl depth | `3` |
| `-c, --concurrency <n>` | Maximum concurrent connections (Native Engine) | `5` |
| `-d, --delay <s>` | Throttle delay between requests in seconds | `0` |
| `-z, --zip` | Generate compressed archive upon completion | `false` |
| `-u, --user-agent <s>` | Custom HTTP User-Agent header | Default client agent |
| `--proxy <url>` | HTTP/HTTPS proxy endpoint URL | None |
| `-e, --exclude <ext>` | Comma-separated list of file extensions to skip | None |
| `-s, --skip-test` | Bypass target accessibility pre-check | `false` |
| `-f, --force` | Force cloning even if accessibility check fails | `false` |
| `-v, --verbose` | Enable verbose diagnostic logging | `false` |
| `--json` | Emit structured JSON output | `false` |
| `-i, --interactive` | Launch interactive step-by-step configuration prompt | `false` |

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
    retries: 3,
    extractMarkdown: true, // Enables clean Markdown generation for LLM RAG
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
import {
  WebsiteCloner,
  CloneResult,
  ProgressData,
  SecurityManager,
  RetryHandler
} from 'clone-this-website';

const cloner = new WebsiteCloner({
  engine: 'native',
  maxDepth: 3,
  concurrency: 8,
  timeout: 10000,
  retries: 3,
  extractMarkdown: true
});

cloner.on('progress', (data: ProgressData) => {
  console.log(`Fetched: ${data.count} files`);
});

const result: CloneResult = await cloner.clone('https://example.com');
console.log(`Saved to: ${result.outputDir} (${result.formattedSize})`);
```

---

## Configuration File Support

Options can be defined declaratively in `.clonerc.json` or `cloner.config.js`:

```json
{
  "engine": "native",
  "maxDepth": 3,
  "concurrency": 10,
  "retries": 3,
  "extractMarkdown": true,
  "zip": true,
  "exclude": "mp4,mkv,avi,zip",
  "headers": {
    "Authorization": "Bearer YOUR_ACCESS_TOKEN"
  }
}
```

---

## Verification and Testing

Execute the automated test suite:

```bash
npm test
```

---

## Specification & API Types

Type declarations are bundled within [`index.d.ts`](index.d.ts).

- `WebsiteCloner`: Core orchestration class extending `EventEmitter`.
- `NativeEngine`: Recursive crawler, HTML/CSS asset rewriter, and Markdown extractor.
- `SystemEngine`: Execution wrapper for system `wget`.
- `SecurityManager`: Path traversal sanitization, SSRF protection, and header hygiene.
- `RetryHandler`: Exponential backoff and jitter retry mechanism.
- `Logger`: Diagnostic logger supporting level filtering and JSON formatting.
- `config`: Configuration loading and parsing utilities.
- `utils`: File statistics, native tar.gz generation, and URL helpers.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
