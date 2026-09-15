// @ts-ignore
import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow'
// @ts-ignore
import { IGDBCredential } from '../credentials/IGDBApi.credentials'

export class IGDB implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'IGDB Search',
		name: 'igdbSearch',
		icon: { light: 'file:../../../../icons/igdb.svg', dark: 'file:../../../../icons/igdb.dark.svg' },
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

	async execute(this: any, nodeData: any) {
		// @ts-ignore
		const { credentials, parameters } = nodeData
		const { operation, name } = parameters

		// @ts-ignore
		const credential = credentials.find(
			(c: any) => c.name === 'IGDBCredential'
		) as IGDBCredential

		if (!credential) {
			throw new Error('IGDB credential not found')
		}

		const clientId = credential.clientId

		const accessToken = await credential.getAccessToken()

		let body

		if (operation === 'searchById') {
			body = JSON.stringify({})
		} else {
			body = JSON.stringify({
				search: name,
				fields: '*',
			})
		}

		const response = await fetch('https://api.igdb.com/v4/games', {
			method: 'POST',
			headers: {
				'Client-ID': clientId,
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body,
		})

		const data = (await response.json()) as Array<{
			id: number
			name: string
			cover: { id: number } | null
			screens: Array<{ image_id: number }> | null
			[key: string]: any
		}>

		if (!response.ok) {
			throw new Error((data as any).message || (data as any).error || 'Unknown error')
		}

		let results

		if (operation === 'searchById') {
			results = [data]
		} else {
			results = data
		}

		// Transform results to include cover, id, name, screens with real links, and all info
		const transformed = results.map((game: any) => ({
			id: game.id,
			name: game.name,
			cover: game.cover
				? `https://images.igdb.com/cover/${game.cover.id}-FULL.jpg`
				: null,
			screens: game.screens
				? game.screens
						.map((screen: any) => `https://images.igdb.com/screen/${screen.image_id}-FULL.jpg`)
						.filter((link: string) => link.includes('http'))
				: [],
			...game,
		}))

		return [{ json: transformed }]
	}
}