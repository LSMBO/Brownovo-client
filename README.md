# Brownovo Client

A desktop application for proteomics analysis, built with Electron and Node.js.

## Features

### 1. Recover
- Process MGF (Mascot Generic Format) files
- Filter spectra based on emergence and minimum UPN
- Apply minimum intensity filtering (mean or median)

### 2. De Novo Sequencing
- Support for two prediction methods:
  - **Novor**: Traditional de novo sequencing
  - **Powernovo**: GPU-accelerated prediction with configurable resources
- Filtering options:
  - Minimum global score
  - Minimum residue score
  - Minimum peptide length
- Automatic subsequence extraction for high-confidence regions

### 3. MS-BLAST
- Protein database searching using MS-BLAST algorithm
- Interactive protein visualization:
  - Search proteins by accession
  - Adjustable similarity filters
  - Visual sequence coverage with peptide mapping
  - Color-coded peptide sequences showing:
    - Full sequence regions
    - Filtered sequence regions
    - Matched regions (aligned)
    - Mismatches in alignments
  - Click-to-expand peptide details with de novo scores

## Requirements

- Node.js 16+
- Electron 33+
- Python Flask server (for backend processing)

## Installation

```bash
# Install dependencies
npm install

# Start the application in development mode
npm start
```

## Building Executables

```bash
# Package the application
npm run package

# Create distributables
npm run make
```

This will create platform-specific executables in the `out/` directory.

## Project Structure

```
Brownovo-client/
├── client/           # Frontend JavaScript modules
│   ├── app.js
│   ├── denovo.js
│   ├── fileDisplay.js
│   ├── jobManager.js
│   ├── msblast.js
│   ├── recover.js
│   ├── renderer.js
│   └── templateLoader.js
├── css/              # Stylesheets
│   └── styles.css
├── img/              # Application icons and images
├── server/           # Electron main process
│   ├── config.js
│   ├── main.js
│   └── preload.js
├── templates/        # HTML templates for results
│   ├── denovo-result.html
│   ├── msblast-result.html
│   └── recover-result.html
├── index.html        # Main application window
└── package.json      # Project configuration
```

## Architecture

The application follows a modular architecture:

1. **Main Process** (`server/main.js`): Handles IPC communication, file operations, and Flask server requests
2. **Renderer Process** (`client/`): Manages UI, user interactions, and result visualization
3. **Template System**: Dynamic HTML templates for displaying processing results
4. **Job Manager**: Tracks and displays ongoing operations

## Development

### Flask Server Integration

The application communicates with a Python Flask server for heavy computations:
- Recover processing
- De novo prediction (Novor/Powernovo)
- MS-BLAST searches
- Protein index generation

Server configuration is managed in `server/config.js`.

### File Handling

The application supports:
- Local file loading
- Automatic file upload to Flask server when needed
- Server-side file caching
- Download of generated results

## License

ISC

## Authors

LSMBO (Laboratoire de Spectrométrie de Masse Bio-Organique)
