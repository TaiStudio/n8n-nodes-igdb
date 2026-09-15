// @ts-ignore
import { ICredential } from 'n8n-workflow'

export class IGDBCredential implements ICredential {
  clientId: string
  clientSecret: string

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId
    this.clientSecret = clientSecret
  }

  async getAccessToken(): Promise<string> {
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

    const data = (await response.json()) as { access_token: string; message?: string; error?: string }
    if (!response.ok || data.message) {
      throw new Error(data.message || data.error || 'Unknown error')
    }
    return data.access_token
  }
}