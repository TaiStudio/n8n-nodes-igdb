import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

interface IGDBCredentials {
	clientId: string;
	clientSecret: string;
}

interface IGDBCover {
	id: number;
	image_id?: string;
}

interface IGDBScreen {
	id?: number;
	image_id: string;
}

interface IGDBGame {
	id: number;
	name: string;
	cover?: IGDBCover | number | null;
	screenshots?: IGDBScreen[] | null;
	screens?: IGDBScreen[] | null;
	[key: string]: unknown;
}

interface TwitchTokenSuccess {
	access_token: string;
	expires_in: number;
	token_type: string;
}

interface TwitchTokenError {
	message?: string;
	error?: string;
}

interface IGDBErrorResponse {
	message?: string;
	error?: string;
}

export class IgdbSearch implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'IGDB Search',
		name: 'igdbSearch',
		icon: { light: 'file:../../icons/igdb.svg', dark: 'file:../../icons/igdb.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
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
				displayOptions: {
					show: {
						operation: ['searchById'],
					},
				},
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				description: 'Game name to search for (used with "Search by Name" operation)',
				default: '',
				displayOptions: {
					show: {
						operation: ['searchByName'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const credentials = (await this.getCredentials('igdbApi')) as unknown as IGDBCredentials;
				const clientId = credentials.clientId;
				const clientSecret = credentials.clientSecret;

				// Exchange client credentials for access token
				const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
					},
					body: new URLSearchParams({
						client_id: clientId,
						client_secret: clientSecret,
						grant_type: 'client_credentials',
					}),
				});

				const tokenData = (await tokenResponse.json()) as
					| TwitchTokenSuccess
					| TwitchTokenError;

				if (!tokenResponse.ok) {
					const message =
						(tokenData as TwitchTokenError).message ??
						(tokenData as TwitchTokenError).error ??
						'Failed to obtain access token';
					throw new NodeOperationError(this.getNode(), message, { itemIndex });
				}

				const accessToken = (tokenData as TwitchTokenSuccess).access_token;

				const operation = this.getNodeParameter('operation', itemIndex) as string;

				// IGDB v4 expects a plain-text query (Apicalypse), NOT JSON.
				// e.g. `search "Zelda"; fields *,cover.image_id,screenshots.image_id; limit 10;`
				const fields = '*,cover.image_id,screenshots.image_id';
				let query: string;

				if (operation === 'searchById') {
					const gameId = this.getNodeParameter('id', itemIndex) as number;
					query = `where id = ${gameId}; fields ${fields};`;
				} else {
					const gameName = this.getNodeParameter('name', itemIndex) as string;
					const escaped = gameName.replace(/"/g, '\\"');
					query = `search "${escaped}"; fields ${fields}; limit 10;`;
				}

				const response = await fetch('https://api.igdb.com/v4/games', {
					method: 'POST',
					headers: {
						'Client-ID': clientId,
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'text/plain',
					},
					body: query,
				});

				const data = (await response.json()) as IGDBGame[] | IGDBErrorResponse;

				if (!response.ok) {
					const message = Array.isArray(data)
						? 'Unknown error'
						: (data.message ?? data.error ?? 'Unknown error');
					throw new NodeOperationError(this.getNode(), message, { itemIndex });
				}

				const games = data as IGDBGame[];

				// Transform results to include cover, id, name, screens with real links, and all info
				const transformed = games.map((game) => {
					const screenshots = game.screenshots ?? game.screens ?? [];
					const coverObject =
						game.cover != null && typeof game.cover === 'object'
							? (game.cover as IGDBCover)
							: null;
					return {
						...game,
						id: game.id,
						name: game.name,
						cover: coverObject?.image_id
							? `https://images.igdb.com/igdb/image/upload/t_cover_big/${coverObject.image_id}.jpg`
							: null,
						screens: Array.isArray(screenshots)
							? screenshots
									.map(
										(screen: IGDBScreen) =>
											screen?.image_id
												? `https://images.igdb.com/igdb/image/upload/t_screenshot_big/${screen.image_id}.jpg`
												: null,
									)
									.filter((link): link is string => link != null)
							: [],
					};
				});

				for (const game of transformed) {
					returnData.push({
						json: game as unknown as IDataObject,
						pairedItem: { item: itemIndex },
					});
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: items[itemIndex].json,
						error: new NodeOperationError(this.getNode(), error as Error, {
							itemIndex,
						}),
						pairedItem: { item: itemIndex },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
			}
		}

		return [returnData];
	}
}
