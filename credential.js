class IGDBCredential {
  constructor(clientId, clientSecret) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  async getAccessToken() {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(`IGDB OAuth error: ${data.message || data.error || 'Unknown error'}`)
    }
    return data.access_token
  }
}

module.exports = { IGDBCredential }