# n8n IGDB Node

An n8n node for integrating with IGDB (Internet Game Database) API.

## Features

- **Search by ID**: Find a game by its IGDB ID
- **Search by Name**: Find games by name
- Returns complete game information including:
  - Game ID and name
  - Cover image URL (FULL size)
  - Screenshots with real links
  - All other IGDB game fields

## Installation

1. Copy the files to your n8n custom nodes directory:
   ```
   mkdir -p ~/.n8n/nodes/n8n-nodes-igdb
   cp -r * ~/.n8n/nodes/n8n-nodes-igdb/
   ```

2. Install dependencies:
   ```
   cd ~/.n8n/nodes/n8n-nodes-igdb
   npm install
   ```

3. Restart n8n

## Credential Setup

1. Register an application at [IGDB](https://igdb.com/) to get your Client ID and Client Secret
2. In n8n, go to **Credentials** → **New Credential** → **IGDB**
3. Enter your:
   - **Client ID**: From IGDB dashboard
   - **Client Secret**: From IGDB dashboard

## Usage

Add the **"IGDB Search"** node to your workflow:

### Parameters

| Parameter | Description |
|-----------|-------------|
| **Operation** | Select search type: `Search by ID` or `Search by Name` |
| **ID** | Game ID to search for (used with "Search by ID") |
| **Name** | Game name to search for (used with "Search by Name") |

### Output

The node returns an array of games with these fields:
- `id` - IGDB game ID
- `name` - Game name
- `cover` - Cover image URL (e.g., `https://images.igdb.com/cover/abc123-FULL.jpg`)
- `screens` - Array of screenshot URLs with real links
- All other IGDB game fields

## API

Uses IGDB API v4 with OAuth2 client credentials flow.
Endpoint: `https://api.igdb.com/v4/games`

## License

MIT