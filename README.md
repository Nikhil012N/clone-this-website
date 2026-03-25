# 🌐 Website Cloner Pro

A professional, cross-platform website cloner with a beautiful CLI interface that can be executed directly with `npx`.

## ✨ Features

- 🎨 **Beautiful Professional UI** - Modern, colorful terminal interface with progress bars and spinners
- 🚀 **NPX Ready** - No installation required, just run `npx clone-this-website`
- 🌍 **Cross-Platform** - Works on Windows, macOS, and Linux
- 🔧 **Auto-Dependency Management** - Automatically installs wget if not present
- 🛡️ **Smart Error Handling** - Comprehensive error handling with user-friendly messages
- 📊 **Progress Tracking** - Real-time progress bars and file counting
- 🧪 **Website Testing** - Tests website accessibility before cloning
- 🎯 **Interactive Mode** - Guided interactive setup for beginners
- ⚙️ **Advanced Options** - Custom output directories, verbose mode, force cloning
- 📈 **Statistics** - Shows file count and directory size after completion

## 🚀 Quick Start

### Method 1: Direct Execution (Recommended)
```bash
npx clone-this-website https://example.com
```

### Method 2: Interactive Mode
```bash
npx clone-this-website --interactive
```

### Method 3: With Options
```bash
npx clone-this-website https://example.com --output my-site --verbose
```

## 📋 Installation Options

### Global Installation
```bash
npm install -g clone-this-website
```

Then use:
```bash
clone-this-website https://example.com
```

### Local Installation
```bash
npm install clone-this-website
```

Then use:
```bash
npx clone-this-website https://example.com
```

## 🎮 Usage Examples

### Basic Usage
```bash
# Clone a website
npx clone-this-website https://github.com

# Start interactive mode
npx clone-this-website --interactive
```

### Advanced Usage
```bash
# Custom output directory
npx clone-this-website https://example.com --output my-website

# Skip website test and force clone
npx clone-this-website https://example.com --force --skip-test

# Verbose output for debugging
npx clone-this-website https://example.com --verbose

# Show help
npx clone-this-website --help

# Show version
npx clone-this-website --version
```

## ⚙️ Command Line Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--output <directory>` | `-o` | Custom output directory name |
| `--force` | `-f` | Force cloning even if website test fails |
| `--skip-test` | `-s` | Skip website accessibility test |
| `--verbose` | `-v` | Enable verbose output |
| `--interactive` | `-i` | Start in interactive mode |
| `--help` | `-h` | Show help information |
| `--version` | `-V` | Show version number |

## 🔧 System Requirements

- **Node.js** >= 12.0.0
- **wget** (auto-installed if not present)
- **Internet connection**

### Supported Platforms

- ✅ **Windows** - Auto-downloads wget binary
- ✅ **macOS** - Uses Homebrew if available
- ✅ **Linux** - Supports apt, yum, pacman, dnf, zypper

## 🛠️ How It Works

1. **Dependency Check** - Verifies wget installation
2. **Auto-Installation** - Installs wget if missing (platform-specific)
3. **Website Test** - Tests URL accessibility (optional)
4. **Directory Setup** - Creates output directory
5. **Cloning Process** - Uses wget with optimized parameters
6. **Progress Tracking** - Shows real-time progress
7. **Statistics** - Displays file count and size

## 📁 Output Structure

```
example.com/
├── index.html
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
├── about/
└── contact/
```

## 🎨 UI Features

### Professional Terminal Interface
- 🎨 Color-coded output with chalk
- 🔄 Animated spinners and progress bars
- 📊 Real-time statistics
- 🛡️ Error highlighting
- ✅ Success indicators

### Interactive Mode
- 📝 Step-by-step guidance
- ✅ Input validation
- 🎯 Smart defaults
- 🔄 Progress feedback

## 🔍 Advanced Configuration

### wget Parameters Used
```bash
wget --recursive \
     --page-requisites \
     --html-extension \
     --convert-links \
     --restrict-file-names=windows \
     --no-parent \
     --domains=example.com \
     --directory-prefix=example.com \
     --mirror \
     --no-check-certificate \
     https://example.com
```

### Custom wget Options
You can modify the wget parameters in the source code for specific needs:
- Change `--mirror` to `--recursive` for shallow cloning
- Adjust `--domains` for multi-domain sites
- Add `--exclude-directories` to skip folders
- Modify `--wait` for rate limiting

## 🐛 Troubleshooting

### Common Issues

#### 1. "wget not found"
**Solution**: The tool auto-installs wget. If it fails:
- **Windows**: Run as Administrator
- **macOS**: Install Homebrew first
- **Linux**: Use your package manager manually

#### 2. "Permission denied"
**Solution**: 
```bash
# On Linux/macOS
sudo npx clone-this-website https://example.com

# Or change output directory
npx clone-this-website https://example.com --output ~/my-site
```

#### 3. "Website test failed"
**Solution**: Use force flag:
```bash
npx clone-this-website https://example.com --force
```

#### 4. "Large sites timeout"
**Solution**: Use verbose mode to monitor:
```bash
npx clone-this-website https://example.com --verbose
```

### Debug Mode
```bash
# Enable verbose output
npx clone-this-website https://example.com --verbose --skip-test
```

## 📚 Examples

### Clone a Documentation Site
```bash
npx clone-this-website https://docs.python.org --output python-docs
```

### Clone with All Options
```bash
npx clone-this-website https://example.com \
  --output my-clone \
  --force \
  --verbose \
  --skip-test
```

### Interactive Session
```bash
$ npx clone-this-website --interactive

╔══════════════════════════════════════════════════════════════╗
║                    WEBSITE CLONER PRO                        ║
║               Professional Cross-Platform Tool                ║
╚══════════════════════════════════════════════════════════════╝

🌐 Clone any website with ease and precision

? Enter website URL to clone: https://github.com
? Output directory name (optional): github-clone
? Skip website accessibility test? No
? Enable verbose output? Yes
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Related Tools

- **wget** - Core downloading utility
- **curl** - Alternative for simple downloads
- **httrack** - More advanced website copying

## 📞 Support

- 📧 Email: support@clone-this-website.com
- 🐛 Issues: [GitHub Issues](https://github.com/clone-this-website/clone-this-website/issues)
- 📖 Docs: [Full Documentation](https://clone-this-website.com/docs)

## 🎯 Best Practices

### For Large Websites
- Use `--verbose` to monitor progress
- Consider `--skip-test` for faster startup
- Ensure sufficient disk space

### For Development
- Clone to a dedicated directory
- Use descriptive output names
- Test accessibility first

### For Production
- Verify terms of service
- Respect robots.txt
- Consider rate limiting

## 🔄 Version History

### v1.0.0
- ✨ Initial release
- 🎨 Professional UI
- 🌍 Cross-platform support
- 🔧 Auto wget installation
- 📊 Progress tracking
- 🎯 Interactive mode

---

**Made with ❤️ by Website Cloner Pro Team**

*Happy cloning! 🚀*
