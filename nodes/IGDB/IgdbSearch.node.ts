import { NodeConnectionTypes, type INodeType, type INodeTypeDescription, type IExecuteFunctions } from 'n8n-workflow'
import { IGDBCredential } from '../../credentials/IGDBApi.credentials'

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
				name: 'IGDBCredential',
				required: true,
			},
		],
		properties: [
			{
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
	}

	execute(this: IExecuteFunctions, pairedItem: { item: number }): NodeOutput[] {
		const credentials = this.getCredentials('IGDBCredential') as IGDBCredential[]
		if (!credentials || credentials.length === 0) {
			throw new NodeOperationError('IGDB credential not found')
		}

		const clientId = credentials[0].clientId

		const accessToken = await credentials[0].getAccessToken()

		const body = {
			search: $parameter('name') as string,
			fields: '*',
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

		const data = (await response.json()) as IGDBGame[]

		if (!response.ok) {
			throw new NodeOperationError(
				data.message || data.error || 'Unknown error'
			)
		}

		// Transform results to include cover, id, name, screens with real links, and all info
		const transformed = data.map((game: IGDBGame): IGDBGameOutput => ({
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

		return [{ json: transformed, pairedItem: { item: pairedItem.item } }]
	}
}

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

interface IGDBGameOutput {
	id: number
	name: string
	cover: string | null
	screens: string[]
	[key: string]: unknown
}

interface NodeOutput {
	json: IGDBGameOutput[]
}