const { IGDBCredential } = require('./credential')

const node = {
  name: 'IGDB Search',
  // eslint-disable-next-line n8n-nodes-base.nodeDescriptionValidation
  description: 'Search IGDB for games by ID or name',
  // eslint-disable-next-line n8n-nodes-base.nodeValidateApi
  credentials: [
    {
      name: 'IGDBCredential',
      // eslint-disable-next-line n8n-nodes-base.credentialValidate
      validate: async (credential) => {
        try {
          await new IGDBCredential(credential.clientId).getAccessToken()
          return { success: true }
        } catch (error) {
          return { success: false, error: error.message }
        }
      },
    },
  ],
  // eslint-disable-next-line n8n-nodes-base.nodeDescriptionValidation
  parameters: [
    {
      displayName: 'Operation',
      name: 'operation',
      type: 'options',
      options: [
        { name: 'Search by ID', value: 'searchById' },
        { name: 'Search by Name', value: 'searchByName' },
      ],
      default: 'searchByName',
      description: 'Select the type of search',
    },
    {
      displayName: 'ID',
      name: 'id',
      type: 'number',
      description: 'Game ID to search for (used with "Search by ID" operation)',
      default: 0,
    },
    {
      displayName: 'Name',
      name: 'name',
      type: 'string',
      description: 'Game name to search for (used with "Search by Name" operation)',
      default: '',
    },
  ],
  // eslint-disable-next-line n8n-nodes-base.nodeValidateApi
  outputs: 1,
  // eslint-disable-next-line n8n-nodes-base.nodeDescriptionValidation
  execute: async function (nodeData) {
    const { credentials, parameter } = nodeData
    const { operation, id, name } = parameter

    const credential = credentials.find(
      (c) => c.name === 'IGDBCredential'
    )

    if (!credential) {
      throw new Error('IGDB credential not found')
    }

    const igdbCredential = new IGDBCredential(credential.clientId)
    const accessToken = await igdbCredential.getAccessToken()

    let endpoint, body

    if (operation === 'searchById') {
      endpoint = `games/${id}?fields=*`
      body = {}
    } else {
      endpoint = `games`
      body = {
        search: name,
        fields: '*',
      }
    }

    const response = await fetch(`https://api.igdb.com/v4/games`, {
      method: 'POST',
      headers: {
        'Client-ID': credential.clientId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`IGDB API error: ${data.message || data.error || 'Unknown error'}`)
    }

    let results

    if (operation === 'searchById') {
      results = [data]
    } else {
      results = data
    }

    // Transform results to include cover, id, name, screens with real links, and all info
    const transformed = results.map((game) => ({
      // Basic fields
      id: game.id,
      name: game.name,
      cover: game.cover ? `https://images.igdb.com/cover/${game.cover.id}-FULL.jpg` : null,
      screens: game.screens
        ? game.screens
            .map((screen) => `https://images.igdb.com/screen/${screen.image_id}-FULL.jpg`)
            .filter((link) => link.includes('http'))
        : [],
      // All other info
      ...game,
    }))

    return [{ json: transformed }]
  },
}

module.exports = node