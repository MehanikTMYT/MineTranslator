# Advanced User Guide

This guide is intended for advanced users who want to modify the code, contribute to the project, or set up custom configurations.

## Project Structure

```
translator-service/
├── api/                    # Server code
│   ├── src/                # Server source files
│   │   ├── app.ts          # Main server application
│   │   └── ...
│   ├── Dockerfile          # Docker configuration for server
│   └── ...
├── client/                 # Client code
│   ├── gui/                # GUI components
│   │   └── translator_gui.py
│   ├── main.py             # Main client entry point
│   ├── translator_client.py # Core client logic
│   └── ...
├── .github/                # GitHub Actions workflows
│   └── workflows/
│       └── build-and-publish.yml
├── .env.example            # Example environment file
└── README.md               # Main documentation
```

## Setting Up Development Environment

### Server Development

1. Navigate to the `api` directory:
```bash
cd api
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

### Client Development

1. Navigate to the `client` directory:
```bash
cd client
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the client in development mode:
```bash
python main.py --help
```

## Customizing the Server

### Adding New Translation Providers

To add a new translation provider, modify the server's translation logic in `api/src/app.ts`:

1. Add the new provider's API endpoint and authentication
2. Implement the translation function
3. Update the server's routing to handle the new provider

### Modifying API Endpoints

The server provides the following endpoints:
- `POST /process` - Process translation requests
- `GET /health` - Health check
- `GET /status` - Server status

You can modify these endpoints in `api/src/app.ts`.

## Customizing the Client

### Adding New File Formats

To add support for new file formats:

1. Modify the `TranslatorClient` class in `client/translator_client.py`
2. Add the new file format to the supported formats list
3. Implement the necessary parsing and processing logic

### Modifying GUI Components

The GUI is built using tkinter and is located in `client/gui/translator_gui.py`:

1. Add new widgets or modify existing ones
2. Update the layout and styling
3. Connect new functionality to the GUI elements

## Environment Variables

The application uses environment variables for configuration. See `.env.example` for all available options:

```bash
# Server Configuration
SERVER_HOST=0.0.0.0
SERVER_PORT=8250
TRANSLATOR_SERVICE_URL=https://api.translator.example.com
TRANSLATOR_API_KEY=your_translator_api_key

# Client Configuration
CLIENT_SERVER_URL=http://localhost:8250
CLIENT_INPUT_DIR=./input
CLIENT_OUTPUT_DIR=./output
CLIENT_SUPPORTED_LANGUAGES=en,ru,de,fr,es
CLIENT_TIMEOUT=30
CLIENT_RETRY_COUNT=3
CLIENT_POLLING_INTERVAL=5
CLIENT_MAX_FILE_SIZE=10485760
CLIENT_LOG_LEVEL=INFO
CLIENT_LOG_FILE=client.log
CLIENT_API_KEY=your_client_api_key
```

## Building Executables

### Client Executable

To build a standalone executable for the client:

```bash
cd client
pip install pyinstaller
pyinstaller --onefile main.py -n translator-client
```

The executable will be created in the `dist/` directory.

### Server Executable

The server is built using Node.js and can be packaged using:

```bash
cd api
pnpm build
```

## Docker Configuration

### Server Docker Image

The server can be built and run using Docker:

```bash
# Build the image
docker build -t translator-service .

# Run the container
docker run -d -p 8250:8250 --env-file .env translator-service
```

### Multi-stage Docker Builds

For optimized Docker images, consider using multi-stage builds that only include necessary files in the final image.

## Testing

### Server Tests

Run server tests using:
```bash
cd api
pnpm test
```

### Client Tests

Run client tests using:
```bash
cd client
python -m pytest
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the `SERVER_PORT` in your `.env` file
2. **Permission errors**: Ensure you have proper permissions to read/write files
3. **API key errors**: Verify your API keys are correctly set in the `.env` file

### Debugging

Enable debug logging by setting `CLIENT_LOG_LEVEL=DEBUG` in your `.env` file.