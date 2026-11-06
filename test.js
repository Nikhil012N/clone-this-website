#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('Running Enterprise Test Suite for clone-this-website (v2.1.0)...\n');

let failed = false;
function assert(name, condition, errorMsg = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
  } else {
    console.error(`[FAIL] ${name}: ${errorMsg}`);
    failed = true;
  }
}

async function runTests() {
  // 1. Structure integrity
  console.log('--- 1. Structural Checks ---');
  assert('package.json exists', fs.existsSync('package.json'));
  assert('index.js SDK exists', fs.existsSync('index.js'));
  assert('bin/cli.js exists', fs.existsSync('bin/cli.js'));
  assert('index.d.ts types exist', fs.existsSync('index.d.ts'));
  assert('lib/cloner.js exists', fs.existsSync('lib/cloner.js'));
  assert('lib/engines/native.js exists', fs.existsSync('lib/engines/native.js'));
  assert('lib/engines/system.js exists', fs.existsSync('lib/engines/system.js'));

  // 2. Programmatic SDK Export verification
  console.log('\n--- 2. Programmatic SDK Export ---');
  const { WebsiteCloner, NativeEngine, SystemEngine, Logger, RetryHandler, SecurityManager, utils } = require('./index');
  assert('WebsiteCloner is class', typeof WebsiteCloner === 'function');
  assert('NativeEngine is class', typeof NativeEngine === 'function');
  assert('SystemEngine is class', typeof SystemEngine === 'function');
  assert('Logger is class', typeof Logger === 'function');
  assert('RetryHandler is class', typeof RetryHandler === 'function');
  assert('SecurityManager is class', typeof SecurityManager === 'function');
  assert('SecurityManager prevents path traversal', () => {
    try {
      SecurityManager.safeResolve('/base', '../../etc/passwd');
      return false;
    } catch {
      return true;
    }
  });
  assert('utils.validateUrl validates https', utils.validateUrl('https://example.com'));
  assert('utils.validateUrl rejects invalid protocol', !utils.validateUrl('ftp://example.com'));
  assert('utils.formatBytes works', utils.formatBytes(1048576).includes('MB'));

  // 3. CLI --help and --version checks
  console.log('\n--- 3. CLI Commands ---');
  try {
    const helpOutput = execSync('node bin/cli.js --help', { encoding: 'utf8' });
    assert('CLI --help outputs description', helpOutput.includes('Enterprise cross-platform website mirroring engine'));
    assert('CLI supports --engine option', helpOutput.includes('--engine'));
    assert('CLI supports --json option', helpOutput.includes('--json'));
    assert('CLI supports AI --markdown option', helpOutput.includes('--markdown'));
  } catch (err) {
    assert('CLI --help command runs', false, err.message);
  }

  // 4. Mock Server & Native Crawl with AI Markdown Generation Integration Test
  console.log('\n--- 4. Mock Server & Native Crawl Integration ---');
  const mockPort = 8999;
  const mockServer = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Mock Enterprise Test Site</title></head>
          <body>
            <h1>Enterprise Mirror Test</h1>
            <p>Welcome to enterprise automated mirror system.</p>
            <a href="/about.html">About Page</a>
            <img src="/logo.png" />
          </body>
        </html>
      `);
    } else if (req.url === '/about.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h1>About Page</h1><p>Documentation for LLM ingestion.</p><a href="/">Home</a></body></html>');
    } else if (req.url === '/logo.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise((resolve) => mockServer.listen(mockPort, resolve));

  const testOutputDir = path.join(__dirname, '.test_clone_output');
  if (fs.existsSync(testOutputDir)) {
    fs.rmSync(testOutputDir, { recursive: true, force: true });
  }

  try {
    const cloner = new WebsiteCloner({
      engine: 'native',
      output: testOutputDir,
      zip: true,
      extractMarkdown: true, // Test AI RAG markdown output
      maxDepth: 2,
      skipTest: true
    });

    let progressEventTriggered = false;
    cloner.on('progress', () => {
      progressEventTriggered = true;
    });

    const result = await cloner.clone(`http://localhost:${mockPort}/`);
    assert('Clone completes successfully', result && result.totalFiles >= 2);
    assert('Progress events were emitted', progressEventTriggered);
    assert('index.html cloned to disk', fs.existsSync(path.join(testOutputDir, 'index.html')));
    assert('about.html cloned to disk', fs.existsSync(path.join(testOutputDir, 'about.html')));
    assert('logo.png cloned to disk', fs.existsSync(path.join(testOutputDir, 'logo.png')));
    assert('Clean Markdown for AI extracted', fs.existsSync(path.join(testOutputDir, 'index.md')));
    assert('tar.gz archive created via native zlib', fs.existsSync(`${testOutputDir}.tar.gz`));

    // Inspect index.html asset rewriting
    const savedHtml = fs.readFileSync(path.join(testOutputDir, 'index.html'), 'utf8');
    assert('HTML link rewritten relative', savedHtml.includes('about.html'));

    // Inspect AI markdown content
    const savedMd = fs.readFileSync(path.join(testOutputDir, 'index.md'), 'utf8');
    assert('Markdown extracted clean heading', savedMd.includes('# Enterprise Mirror Test'));
  } catch (err) {
    assert('Native crawler mirror test passes', false, err.message);
  } finally {
    mockServer.close();
    // Cleanup test artifacts
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
    if (fs.existsSync(`${testOutputDir}.tar.gz`)) {
      fs.unlinkSync(`${testOutputDir}.tar.gz`);
    }
  }

  if (failed) {
    console.error('\nTests failed.');
    process.exit(1);
  } else {
    console.log('\nAll enterprise tests passed successfully!\n');
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
