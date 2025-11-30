# Server Setup Guide

This guide is intended for advanced users who want to set up and run the translation server.

## Prerequisites

- Node.js 18 or higher
- pnpm package manager
- Docker (optional, for containerized deployment)

## Installation

1. Navigate to the `api` directory:
```bash
cd api
```

2. Install dependencies:
```bash
pnpm install
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

## Running the Server

### Development Mode
```bash
pnpm dev
```

### Production Mode
```bash
pnpm build
pnpm start
```

## Docker Deployment

### Building the Image
```bash
docker build -t translator-service .
```

### Running the Container
```bash
docker run -d -p 8250:8250 --env-file .env translator-service
```

## API Endpoints

- `POST /process` - Process translation requests
- `GET /health` - Health check endpoint
- `GET /status` - Get server status

## Configuration Options

- `SERVER_HOST` - Host to bind the server to (default: 0.0.0.0)
- `SERVER_PORT` - Port to run the server on (default: 8250)
- `TRANSLATOR_SERVICE_URL` - URL of the translation service
- `TRANSLATOR_API_KEY` - API key for the translation service