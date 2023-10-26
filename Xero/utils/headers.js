import { getRandom } from "random-useragent";

export function generateHeaders(origin) {
    const tags = [
		['en-US', 'en'],
		['en-GN', 'en'],
		['fr-CH', 'fr']
	];

	const tag = tags[Math.floor(Math.random() * tags.length)];
	const weight = Math.max(0.1, Math.random() * 0.9).toFixed(1);

	return {
		Origin: origin,
		Pragma: 'no-cache',
		'Cache-Control': 'no-cache',
		'Accept-Encoding': 'gzip, deflate',
		'Accept-Language': `${tag[0]}, ${tag[1]};${weight}`,
		'User-Agent': getRandom()
	};
}