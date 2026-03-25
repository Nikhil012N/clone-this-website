#!/usr/bin/env node

// Simple test script for clone-this-website
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Website Cloner Pro...\n');

// Test 1: Check if package.json exists
console.log('📋 Test 1: Checking package.json...');
if (fs.existsSync('package.json')) {
  console.log('✅ package.json exists');
} else {
  console.log('❌ package.json missing');
  process.exit(1);
}

// Test 2: Check if index.js exists
console.log('\n📋 Test 2: Checking index.js...');
if (fs.existsSync('index.js')) {
  console.log('✅ index.js exists');
} else {
  console.log('❌ index.js missing');
  process.exit(1);
}

// Test 3: Check if index.js is executable
console.log('\n📋 Test 3: Checking index.js shebang...');
const indexContent = fs.readFileSync('index.js', 'utf8');
if (indexContent.startsWith('#!/usr/bin/env node')) {
  console.log('✅ index.js has proper shebang');
} else {
  console.log('❌ index.js missing shebang');
  process.exit(1);
}

// Test 4: Check dependencies
console.log('\n📋 Test 4: Checking dependencies...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = ['chalk', 'ora', 'inquirer', 'cli-progress', 'commander', 'axios'];
  
  for (const dep of requiredDeps) {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`✅ ${dep} dependency found`);
    } else {
      console.log(`❌ ${dep} dependency missing`);
      process.exit(1);
    }
  }
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
  process.exit(1);
}

// Test 5: Check bin configuration
console.log('\n📋 Test 5: Checking bin configuration...');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (packageJson.bin && packageJson.bin['clone-this-website']) {
    console.log('✅ bin configuration found');
  } else {
    console.log('❌ bin configuration missing');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Error checking bin configuration:', error.message);
  process.exit(1);
}

// Test 6: Try to run help command
console.log('\n📋 Test 6: Testing help command...');
try {
  const help = execSync('node index.js --help', { encoding: 'utf8', timeout: 10000 });
  if (help.includes('clone-this-website')) {
    console.log('✅ Help command works');
  } else {
    console.log('❌ Help command output invalid');
    console.log('Help output:', help);
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Help command failed:', error.message);
  process.exit(1);
}

// Test 7: Try to run version command
console.log('\n📋 Test 7: Testing version command...');
try {
  const version = execSync('node index.js --version', { encoding: 'utf8', timeout: 5000 });
  if (version.trim()) {
    console.log('✅ Version command works:', version.trim());
  } else {
    console.log('❌ Version command output empty');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Version command failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All tests passed! Website Cloner Pro is ready to use.');
console.log('\n📖 Usage examples:');
console.log('  npx clone-this-website https://example.com');
console.log('  npx clone-this-website --interactive');
console.log('  npx clone-this-website https://example.com --output my-site --verbose');
