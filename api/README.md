# Minecraft Mod Translation Service - Server

This is the server component of the Minecraft Mod Translation Service. It handles translation requests and processes various file formats including JAR files for Minecraft mods.

## 📁 Project Structure

```
api/
├── Dockerfile                 # Docker configuration for containerization
├── package.json               # Node.js dependencies and scripts
├── pnpm-lock.yaml             # Lock file for pnpm dependencies
├── pnpm-workspace.yaml        # Workspace configuration
├── tsconfig.json              # TypeScript configuration
├── eslint.config.js           # ESLint configuration
└── src/                       # Source code directory
    ├── app.ts                 # Main application entry point
    ├── server.ts              # Server initialization
    ├── config/                # Configuration files
    │   ├── config.ts          # Configuration management
    │   └── index.ts           # Configuration exports
    ├── controllers/           # Request controllers
    │   └── JarController.ts   # JAR file processing controller
    ├── middleware/            # Express middleware
    │   ├── uploadMiddleware.ts # File upload handling
    │   └── validationMiddleware.ts # Request validation
    ├── routes/                # API route definitions
    │   └── jarRoutes.ts       # JAR processing routes
    ├── services/              # Business logic services
    │   ├── JarProcessingService.ts # JAR file processing logic
    │   ├── PackParserService.ts # Resource pack parsing
    │   ├── ai/                # AI integration services
    │   ├── file/              # File handling utilities
    │   └── translation/       # Translation services
    └── utils/                 # Utility functions
        ├── errorUtils.ts      # Error handling utilities
        ├── logger.ts          # Logging utilities
        ├── timeUtils.ts       # Time-related utilities
        ├── types.ts           # Type definitions
        └── validationUtils.ts # Validation utilities
```

## 🚀 Installation and Setup

### Prerequisites

- Node.js 18 or higher
- pnpm package manager (recommended) or npm/yarn

### Quick Setup

1. Navigate to the `api` directory:
```bash
cd api
```

2. Install dependencies:
```bash
pnpm install
# or if you don't have pnpm: npm install -g pnpm && pnpm install
```

3. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

4. Edit the `.env` file with your configuration:
```bash
# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8250
TRANSLATOR_SERVICE_URL=https://api.translator.example.com
TRANSLATOR_API_KEY=your_translator_api_key
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Host to bind the server to |
| `SERVER_PORT` | `8250` | Port to run the server on |
| `TRANSLATOR_SERVICE_URL` | - | URL of the translation service |
| `TRANSLATOR_API_KEY` | - | API key for the translation service |
| `MAX_FILE_SIZE` | `10485760` | Maximum file size in bytes (10MB) |
| `ENABLE_RATE_LIMIT` | `true` | Enable rate limiting |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds (15 minutes) |
| `RATE_LIMIT_MAX` | `100` | Maximum requests per window |

## 🛠️ Development

### Running in Development Mode

```bash
# Start with auto-reload on file changes
pnpm dev
```

### Building for Production

```bash
# Compile TypeScript to JavaScript
pnpm build

# Run the production build
pnpm start
```

### Linting and Formatting

```bash
# Lint the code
pnpm lint

# Format the code
pnpm format
```

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch
```

## 🐳 Docker Deployment

### Building the Image

```bash
# Build the Docker image
docker build -t translator-service .
```

### Running the Container

```bash
# Run with environment file
docker run -d -p 8250:8250 --env-file .env translator-service

# Run with specific environment variables
docker run -d -p 8250:8250 \
  -e SERVER_HOST=0.0.0.0 \
  -e SERVER_PORT=8250 \
  -e TRANSLATOR_API_KEY=your_key_here \
  translator-service
```

### Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  translator-service:
    image: ghcr.io/your-username/translator-service:latest
    ports:
      - "8250:8250"
    env_file:
      - .env
    environment:
      - SERVER_HOST=0.0.0.0
      - SERVER_PORT=8250
    restart: unless-stopped
```

## 🌐 API Endpoints

### Health Check
- `GET /health` - Check server health status

### Translation Processing
- `POST /process` - Process translation requests
  - Accepts multipart/form-data with files
  - Supports various file formats (JAR, JSON, properties, etc.)
  - Requires authentication via API key

### Status
- `GET /status` - Get server status and statistics

## 🔐 API Authentication

The server supports API key authentication. Include your API key in the request headers:

```
Authorization: Bearer YOUR_API_KEY
# or
X-API-Key: YOUR_API_KEY
```

## 🔧 Configuration

### Custom Translation Providers

To add a new translation provider:

1. Create a new service in `src/services/translation/`
2. Implement the translation interface
3. Register the provider in the main application
4. Add configuration options to the config module

### Rate Limiting

Rate limiting is enabled by default. You can configure it in the environment variables:
- `ENABLE_RATE_LIMIT`: Enable/disable rate limiting
- `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds
- `RATE_LIMIT_MAX`: Maximum requests per window

## 🚀 GitHub Actions and CI/CD

The project includes automated build workflows that:
- Build Docker images for multiple platforms
- Run tests on each commit
- Publish images to GitHub Container Registry
- Deploy to production on main branch updates

### Workflow Configuration

The workflow is defined in `.github/workflows/build-and-publish.yml` and includes:
- Build and test on Ubuntu, Windows, and macOS
- Docker image building and publishing
- Automated versioning
- Security scanning

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Run linting and formatting (`pnpm lint && pnpm format`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 🐛 Troubleshooting

### Common Issues

1. **Port already in use**: Change the `SERVER_PORT` in your `.env` file
2. **Permission errors**: Ensure you have proper permissions to read/write files
3. **API key errors**: Verify your API keys are correctly set in the `.env` file
4. **Memory issues**: Increase Node.js memory limit with `NODE_OPTIONS="--max-old-space-size=4096"`

### Debugging

Enable debug logging by setting environment variables:
```
LOG_LEVEL=debug
NODE_ENV=development
```

## 📄 License

This project is licensed under the terms specified in the main repository LICENSE file.