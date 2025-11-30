# Minecraft Mod Translation Service - Client

This is the client component of the Minecraft Mod Translation Service. It provides both a command-line interface (CLI) and a graphical user interface (GUI) for interacting with the translation server to process Minecraft mod files.

## 📁 Project Structure

```
client/
├── __init__.py                 # Package initialization
├── main.py                     # Main entry point (CLI and GUI)
├── run_gui.py                  # GUI-only launcher script
├── requirements.txt            # Python dependencies
├── translator.py               # Original file (maintained for compatibility)
├── translator_client.py        # Refactored core client logic
├── README.md                   # This file
└── gui/                        # GUI components directory
    ├── __init__.py             # GUI package initialization
    └── translator_gui.py       # GUI interface implementation
```

## ✨ Features

1. **Dual Interface Support** - Command-line interface for automation and scripting, plus a full-featured GUI for ease of use
2. **Multi-threaded Processing** - Concurrent file processing with configurable thread count
3. **File Format Support** - Handles JAR files, JSON, properties files, and other Minecraft mod formats
4. **Error Handling** - Robust retry mechanisms and error classification
5. **Progress Tracking** - Detailed statistics and progress monitoring
6. **Cross-platform** - Works on Windows, macOS, and Linux

## 🚀 Installation and Setup

### Prerequisites

- Python 3.7 or higher
- pip package manager

### Quick Setup

1. Navigate to the `client` directory:
```bash
cd client
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. For GUI functionality on Debian/Ubuntu systems, install tkinter:
```bash
sudo apt-get install python3-tk
```

4. Create a `.env` file based on `.env.example` (in the root directory):
```bash
cp ../.env.example ../.env
```

5. Edit the `.env` file with your server configuration

### Environment Variables

The client uses environment variables from the root `.env` file. Key variables include:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLIENT_SERVER_URL` | `http://localhost:8250` | Translation server URL |
| `CLIENT_INPUT_DIR` | `./input` | Directory containing files to translate |
| `CLIENT_OUTPUT_DIR` | `./output` | Directory for translated files |
| `CLIENT_SUPPORTED_LANGUAGES` | `en,ru,de,fr,es` | Supported language codes |
| `CLIENT_TIMEOUT` | `30` | Request timeout in seconds |
| `CLIENT_RETRY_COUNT` | `3` | Number of retry attempts |
| `CLIENT_POLLING_INTERVAL` | `5` | Status polling interval |
| `CLIENT_MAX_FILE_SIZE` | `10485760` | Maximum file size in bytes |
| `CLIENT_LOG_LEVEL` | `INFO` | Logging level |
| `CLIENT_LOG_FILE` | `client.log` | Log file path |
| `CLIENT_API_KEY` | - | API key for server authentication |

## 🛠️ Usage

### Command-Line Interface (CLI)

```bash
# Basic usage
python main.py [options]

# Example: Translate from English to Russian
python main.py --source_lang en --target_lang ru --input_dir ./mods --output_dir ./translated

# Example: Use with specific server and settings
python main.py \
  --server_url http://my-server:8250 \
  --input_dir ./input \
  --output_dir ./output \
  --source_lang en \
  --target_lang zh-CN \
  --threads 5 \
  --timeout 60

# Show help
python main.py --help
```

### Graphical User Interface (GUI)

```bash
# Launch GUI
python main.py --gui

# Or use the dedicated GUI launcher
python run_gui.py
```

### CLI Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--gui` | Flag | - | Launch the graphical interface |
| `--server_url` | String | `http://localhost:8250` | Server API URL |
| `--input_dir` | String | `./input` | Input directory with files to translate |
| `--output_dir` | String | `./output` | Output directory for translated files |
| `--source_lang` | String | `en` | Source language code |
| `--target_lang` | String | `ru` | Target language code |
| `--threads` | Integer | `3` | Number of concurrent processing threads |
| `--timeout` | Integer | `30` | Request timeout in seconds |
| `--retry_count` | Integer | `3` | Number of retry attempts |
| `--recursive` | Flag | `False` | Recursively search subdirectories |
| `--dry_run` | Flag | `False` | Test mode without actual processing |
| `--skip_health_check` | Flag | `False` | Skip server health check |
| `--log_level` | String | `INFO` | Logging level (DEBUG, INFO, WARNING, ERROR) |
| `--ai_provider` | String | `openrouter` | AI provider to use |
| `--backup_translator` | Boolean | `True` | Use backup translator on failure |

### Supported Languages

The application supports all common language codes including:
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

## 🔐 Private Key and Security Setup

### Adding Private Keys to Repository

⚠️ **Security Warning**: Never commit private keys directly to the repository.

Instead, use one of these secure methods:

#### Method 1: Environment Variables (Recommended)
1. Store your API keys in environment variables
2. Reference them in your `.env` file
3. Ensure `.env` is in `.gitignore`

#### Method 2: GitHub Secrets for Actions
1. Go to your repository Settings → Secrets and variables → Actions
2. Add your secrets (e.g., `TRANSLATOR_API_KEY`)
3. Reference them in your workflow files

#### Method 3: SSH Keys for Private Repositories
1. Generate SSH keys: `ssh-keygen -t rsa -b 4096`
2. Add public key to GitHub: Settings → SSH and GPG keys
3. Use SSH URLs instead of HTTPS for repository access

### Configuration Security
- Always use `.env` files for configuration
- Never hardcode sensitive information
- Validate all user inputs
- Use HTTPS for server connections

## 🚀 GitHub Actions Workflow

The project includes a comprehensive CI/CD pipeline in `.github/workflows/build-and-publish.yml` that:

### Workflow Features
- Builds client executables for Windows, macOS, and Linux
- Creates Docker images for the server
- Runs tests across multiple platforms
- Publishes releases automatically
- Implements security scanning

### Workflow Configuration

The workflow file includes:

```yaml
name: Build and Publish
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
```

### Adding Private Keys to GitHub Actions

To use private keys in your GitHub Actions workflow:

1. **Add Secrets to Repository**:
   - Go to repository Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Add your private key as a secret (e.g., `TRANSLATOR_API_KEY`)

2. **Reference in Workflow**:
   ```yaml
   env:
     TRANSLATOR_API_KEY: ${{ secrets.TRANSLATOR_API_KEY }}
   ```

3. **Secure Usage in Jobs**:
   ```yaml
   - name: Configure API Key
     run: echo "API_KEY=${{ secrets.TRANSLATOR_API_KEY }}" >> $GITHUB_ENV
   ```

### Customizing the Workflow

To customize the build workflow:

1. Edit `.github/workflows/build-and-publish.yml`
2. Modify the matrix strategy to add/remove platforms
3. Adjust build steps as needed
4. Update artifact names and paths
5. Add additional testing or validation steps

### Workflow Triggers

The workflow runs automatically on:
- Push to `main` branch (builds and publishes)
- Pull requests to `main` branch (runs tests only)
- Manual dispatch (for testing)

## 🧪 Testing

### Client Tests

```bash
# Run all tests
python -m pytest

# Run tests with coverage
python -m pytest --cov=.

# Run specific test file
python -m pytest tests/test_client.py
```

### Integration Testing

Test the client with a running server:

```bash
# Start server in another terminal
cd api && pnpm dev

# Run client integration tests
cd client && python -c "from translator_client import *; test_connection()"
```

## 🐳 Docker Usage

### Client Docker Image

Build and run the client in a container:

```bash
# Build client Docker image
docker build -t translator-client -f Dockerfile.client .

# Run client container
docker run -it --env-file ../.env \
  -v $(pwd)/input:/input \
  -v $(pwd)/output:/output \
  translator-client \
  python main.py --input_dir /input --output_dir /output
```

## 🔧 Advanced Configuration

### Custom Translation Providers

To add a new translation provider:

1. Implement the provider interface in `translator_client.py`
2. Add configuration options to handle the new provider
3. Update the CLI options to allow provider selection

### Performance Tuning

Adjust these parameters for optimal performance:

- `--threads`: Number of concurrent processing threads (balance with server capacity)
- `--timeout`: Request timeout (increase for large files or slow servers)
- `--retry_count`: Number of retry attempts (balance between reliability and speed)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/translator-service.git

# Install development dependencies
cd client
pip install -r requirements.txt
pip install pytest pytest-cov  # for testing

# Run in development mode
python main.py --help
```

## 🐛 Troubleshooting

### Common Issues

1. **Permission errors**: Ensure proper file permissions and directory access
2. **API key errors**: Verify your API keys are correctly set in environment variables
3. **Connection errors**: Check server URL and network connectivity
4. **Memory issues**: Reduce the number of processing threads

### Debugging

Enable debug logging:
```bash
# Set environment variable
export CLIENT_LOG_LEVEL=DEBUG

# Or in your .env file
CLIENT_LOG_LEVEL=DEBUG
```

### Error Classification

The client automatically classifies and handles different error types:
- Network errors: Retried with exponential backoff
- Server errors: Handled with fallback mechanisms  
- File validation errors: Logged with appropriate messages
- Authentication errors: Prompted for reconfiguration

## 📄 License

This project is licensed under the terms specified in the main repository LICENSE file.