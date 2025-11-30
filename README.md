# Translator Service

[Russian version](README-ru.md)

This project provides a translation service with both server and client components. The server handles translation requests, while the client provides both GUI and command-line interfaces to interact with the service. The application supports translation of various file formats including JAR files for Minecraft mods.

## ✨ Features

- Translation between multiple languages
- Support for various file formats
- GUI and command-line interfaces
- Docker support for easy deployment
- Cross-platform binary builds via GitHub Actions
- Configurable via environment variables
- Automated publishing of releases

## 🚀 Installation and Setup

### Quick Start with Pre-built Binaries

Download the appropriate binary for your OS from the [Releases](https://github.com/your-repo/releases) page:

1. Download the binary for your operating system (Windows, macOS, Linux)
2. Make it executable (on Linux/macOS: `chmod +x translator-client`)
3. Create a `.env` file based on `.env.example`
4. Run the application: `./translator-client --help`

### Using Docker

Server:
```bash
docker run -d -p 8250:8250 --env-file .env ghcr.io/your-username/translator-service:latest
```

Client:
```bash
docker run -it --env-file .env -v $(pwd)/input:/input -v $(pwd)/output:/output ghcr.io/your-username/translator-client:latest
```

### From Source

#### Requirements
- Python 3.7+ (for client)
- Node.js 18+ (for server)
- pnpm (for server)

#### Installing Dependencies
```bash
# For client
cd client
pip install -r requirements.txt

# For server
cd api
npm install -g pnpm
pnpm install
```

## 🎛️ Usage

### Starting the Application

The client application can be run in two modes:

#### GUI Mode
```bash
cd client
python main.py --gui
```

#### Command Line Mode
```bash
cd client
python main.py [options]
```

### 🔧 Main Command Line Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `--server_url` | `http://localhost:8250` | Server API URL |
| `--input_dir` | `./input` | Directory with files to translate |
| `--output_dir` | `./output` | Directory for translated files |
| `--source_lang` | `en` | Source language code |
| `--target_lang` | `ru` | Target language code |
| `--supported_languages` | `en,ru,de,fr,es` | Comma-separated list of supported languages |
| `--timeout` | `30` | Request timeout in seconds |
| `--retry_count` | `3` | Number of retry attempts |
| `--polling_interval` | `5` | Polling interval for status checks |
| `--max_file_size` | `10485760` | Maximum file size in bytes |
| `--log_level` | `INFO` | Logging level |
| `--log_file` | `client.log` | Log file path |

### 🌐 Supported Languages

The following language codes are supported in the application:

```
af, sq, am, ar, hy, az, eu, be, bn, bs, bg, ca, ceb, ny,
zh-CN, zh-TW, co, hr, cs, da, nl, en, eo, et, tl, fi, fr,
fy, gl, ka, de, el, gu, ht, ha, haw, iw, hi, hmn, hu,
is, ig, id, ga, it, ja, jw, kn, kk, km, ko, ku, ky, lo,
la, lv, lt, lb, mk, mg, ms, ml, mt, mi, mr, mn, my, ne,
no, ps, fa, pl, pt, pa, ro, ru, sm, gd, sr, st, sn, sd,
si, sk, sl, so, es, su, sw, sv, tg, ta, te, th, tr, uk,
ur, uz, vi, cy, xh, yi, yo, zu
```

### 🎯 Usage Examples

**Basic usage:**
```bash
python main.py --server_url http://localhost:8250 --source_lang en --target_lang ru
```

**Advanced usage with settings:**
```bash
python main.py \
  --server_url http://localhost:8250 \
  --input_dir ./mods \
  --output_dir ./translated \
  --source_lang en \
  --target_lang zh-CN \
  --timeout 60 \
  --retry_count 5
```

**Using GUI:**
```bash
python main.py --gui
```

## ⚙️ Features and Advantages

### 🔄 Multi-threaded Processing
The application supports parallel file processing with configurable number of threads. This significantly speeds up processing when handling a large number of files.

### 📊 Progress Bar
When `tqdm` is installed, an interactive progress bar is displayed showing:
- Current number of processed files
- Remaining time
- Processing speed

### 📈 Detailed Statistics
After processing completion, detailed statistics are displayed:
```
==================================================
📊 PROCESSING STATISTICS
==================================================
✅ Successful:       42
❌ Errors:           3
🧩 Invalid:          5
🔧 Corrupted:        2
⏭️ Skipped:          1
📈 Total:            53
🎯 Success rate:     79.2%
==================================================
```

### 🔍 Smart File Validation
Before sending to the server, files are checked for:
- File existence
- Zero size (empty files)
- Exceeding maximum size
- Correct file format

### 🔄 Automatic Retry Mechanism
On temporary network or server errors:
- Automatic retry attempts (configurable)
- Exponential backoff between attempts
- Different strategies for different error types

### 🚨 Smart Error Handling
The system automatically classifies errors and handles them appropriately:
- Network errors with retries
- Server-side problems with fallback mechanisms
- File validation errors with appropriate logging

### 📁 Flexible File System
- Automatic directory creation when needed
- Safe file operations with conflict checking
- Support for various file formats

### 📝 Advanced Logging
- Log writing to file (configurable)
- Multiple logging levels
- Detailed logging of all critical events and errors

## 🛠️ Server Setup

For advanced users who want to set up their own server, please refer to [README-server.md](README-server.md).

## 🚀 GitHub Actions and Automated Builds

The project includes automated build workflows that:
- Build binaries for multiple platforms (Windows, macOS, Linux)
- Create Docker images for both client and server
- Publish releases automatically
- Run tests on multiple operating systems

To use the automated builds, simply push changes to the `main` branch, and the workflow will automatically build and publish new versions.

## 🤝 Contributing

We welcome contributions to this project! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

For more detailed information about contributing and modifying the code, see [ADVANCED-USERS.md](ADVANCED-USERS.md).

## 🐳 Docker Support

### Building Docker Images

Server:
```bash
cd api
docker build -t translator-service .
```

Client:
```bash
cd client
docker build -t translator-client .
```

### Running with Docker Compose

Create a `docker-compose.yml` file:
```yaml
version: '3.8'
services:
  server:
    image: ghcr.io/your-username/translator-service:latest
    ports:
      - "8250:8250"
    env_file:
      - .env
    environment:
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=8250

  client:
    image: ghcr.io/your-username/translator-client:latest
    volumes:
      - ./input:/input
      - ./output:/output
    env_file:
      - .env
    depends_on:
      - server
```

Then run:
```bash
docker-compose up -d
```

## 📄 Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Then modify the values as needed for your setup.

## 🆘 Support

If you encounter any problems:

1. Check this documentation
2. Look through existing [Issues](https://github.com/your-repo/issues)
3. Create a new issue with detailed information about your problem

For advanced users who want to modify the code, see [ADVANCED-USERS.md](ADVANCED-USERS.md).