import type { ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';

export class IGDBApi implements ICredentialType {
	name = 'igdbApi';
	displayName = 'IGDB API';
	documentationUrl = 'https://docs.igdb.com/';
	icon = {
		light: 'file:../icons/igdb.svg',
		dark: 'file:../icons/igdb.dark.svg',
	} as const;

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.igdb.com/v4',
			url: '/games',
			method: 'POST',
			body: JSON.stringify({}),
			headers: {
				'Client-ID': '={{$credentials?.clientId}}',
				Authorization: 'Bearer {{token}}',
				'Content-Type': 'application/json',
			},
		},
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'Your IGDB Client ID from https://igdb.com/',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Your IGDB Client Secret from https://igdb.com/',
		},
	];
}
