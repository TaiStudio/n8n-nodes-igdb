import {
    INodeType,
    INodeTypeDescription,
    IExecuteFunctions,
    NodeConnectionTypes
} from 'n8n-workflow'
import { IGDBApi } from '../../credentials/IGDBApi.credentials'

export class IgdbSearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'IGDB Search',
		name: 'igdbSearch',
		icon: { light: 'file:../../icons/igdb.svg', dark: 'file:../../icons/igdb.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["nameOrId"]}}',
		description: 'Search IGDB for games by ID or name',
		defaults: {
			name: 'IGDB Search',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'igdbApi',
				required: true,
			},
		],
		properties: {
			operation: {
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Search by ID', value: 'searchById' },
					{ name: 'Search by Name', value: 'searchByName' },
				],
				default: 'searchByName',
			},
			id: {
				displayName: 'ID',
				name: 'id',
				type: 'number',
				description: 'Game ID to search for (used with "Search by ID" operation)',
				default: 0,
			},
			name: {
				displayName: 'Name',
				name: 'name',
				type: 'string',
				description: 'Game name to search for (used with "Search by Name" operation)',
				default: '',
			},
		},
	}

	execute(this: IExecuteFunctions) {
		const credentials = this.getCredentials('igdbApi') as IGDBApi
		const clientId = credentials.clientId

		// Exchange client credentials for access token
		const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: credentials.clientSecret,
				grant_type: 'client_credentials',
			}),
		})

		const tokenData = (await tokenResponse.json()) as { access_token: string }
		if (!tokenResponse.ok) {
			throw new NodeOperationError(
				tokenData.message || 'Failed to obtain access token'
			)
		}

		const accessToken = tokenData.access_token

		let body

		if ($parameter('operation') === 'searchById') {
			body = {}
		} else {
			body = {
				search: $parameter('name') as string,
				fields: '*',
			}
		}

		const response = await fetch('https://api.igdb.com/v4/games', {
			method: 'POST',
			headers: {
				'Client-ID': clientId,
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})

		const data = (await response.json()) as Array<{
			id: number
			name: string
			cover: { id: number } | null
			screens: Array<{ image_id: number }> | null
		}>

		if (!response.ok) {
			throw new NodeOperationError(
				data.message || data.error || 'Unknown error'
			)
		}

		// Transform results to include cover, id, name, screens with real links, and all info
interface IGDBGame {
		id: number
		name: string
		cover: { id: number } | null
		screens: Array<{ image_id: number }> | null
		[key: string]: unknown
	}

	interface IGDBScreen {
		image_id: number
	}

	const transformed = data.map((game: IGDBGame) => ({
			id: game.id,
			name: game.name,
			cover: game.cover
				? `https://images.igdb.com/cover/${game.cover.id}-FULL.jpg`
				: null,
			screens: game.screens
					? game.screens
							.map((screen: IGDBScreen) => `https://images.igdb.com/screen/${screen.image_id}-FULL.jpg`)
							.filter((link: string) => link.includes('http'))
					: [],
			...game,
		}))

		return [{ json: transformed, pairedItem: { item: 0 } }]
}
}