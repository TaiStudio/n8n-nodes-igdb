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

interface IGDBScreen {
	image_id: string;
}

interface IGDBGame {
	id: number;
	name: string;
	cover?: { id: number } | null;
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

				let body: Record<string, unknown>;

				if (operation === 'searchById') {
					const gameId = this.getNodeParameter('id', itemIndex) as number;
					body = {
						where: `id = ${gameId}`,
						fields: '*',
					};
				} else {
					const gameName = this.getNodeParameter('name', itemIndex) as string;
					body = {
						search: gameName,
						fields: '*',
					};
				}

				const response = await fetch('https://api.igdb.com/v4/games', {
					method: 'POST',
					headers: {
						'Client-ID': clientId,
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(body),
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
					const screens = game.screens ?? game.screenshots ?? [];
					return {
						...game,
						id: game.id,
						name: game.name,
						cover: game.cover
							? `https://images.igdb.com/igdb/image/upload/t_cover_big/${game.cover.id}.jpg`
							: null,
						screens: Array.isArray(screens)
							? screens
									.map(
										(screen: IGDBScreen) =>
											`https://images.igdb.com/igdb/image/upload/t_screenshot_big/${screen.image_id}.jpg`,
									)
									.filter((link: string) => link.includes('http'))
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
