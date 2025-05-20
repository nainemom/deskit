import { createHash } from 'node:crypto';
import {
	createReadStream,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { cwd } from 'node:process';

const PREFIX = 'deskit';

export const HOME = process.env.HOME || process.env.USERPROFILE || '';

export const SHORTCUTS_DIR = join(HOME, '.local/share/applications');
export const ICONS_DIR = join(HOME, '.local/share/icons');
export const STATIC_DIR = join(HOME, `.local/share/${PREFIX}`);
export const TEMP_DIR = join(HOME, `.temp/${PREFIX}`);

export const checksum = async (input: string | URL) => {
	const hash = createHash('md5');

	if (typeof input === 'string' && statSync(input).isFile()) {
		const stream = createReadStream(input, {
			autoClose: true,
			encoding: 'utf-8',
		});
		for await (const chunk of stream) {
			hash.update(chunk as Buffer);
		}
	} else {
		hash.update(input.toString());
	}

	return hash.digest('hex');
};

export const installedApps = () =>
	Promise.resolve(
		readdirSync(STATIC_DIR).map((id) => {
			const desktopFileContent = readFileSync(
				resolve(SHORTCUTS_DIR, `${id}.desktop`),
				{
					encoding: 'utf-8',
				},
			);

			const name = desktopFileContent.match(/^Name=(.+)$/m)?.[1] || 'unknown';
			const version =
				desktopFileContent.match(/^X-Version=(.+)$/m)?.[1] || 'unknown';
			const type = desktopFileContent.match(/^X-Type=(.+)$/m)?.[1] || 'unknown';
			return {
				name,
				version: version.toLowerCase() === 'latest' ? 'latest' : `v${version}`,
				id,
				type,
			};
		}),
	);

export const uninstall = (appId: string) => {
	rmSync(resolve(SHORTCUTS_DIR, `${appId}.desktop`), {
		force: true,
	});
	rmSync(resolve(STATIC_DIR, appId), {
		force: true,
	});
	rmSync(resolve(ICONS_DIR, appId), {
		force: true,
	});
	rmSync(resolve(HOME, `.local/share/ice/profiles/${appId}`), {
		force: true,
	});
	return Promise.resolve();
};

export const resolveInputAsPath = (input: string) => {
	try {
		const fullPath = resolve(cwd(), input);
		if (statSync(fullPath).isFile()) {
			return fullPath;
		}
		return null;
	} catch (_e) {
		return null;
	}
};

export const resolveInputAsUrl = (input: string) => {
	try {
		const url = new URL(input);
		return url;
	} catch (_e) {
		return null;
	}
};
