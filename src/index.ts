#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { exit, stderr, stdout } from 'node:process';
import { cac } from 'cac';
import { oraPromise } from 'ora';
import {
	installedApps,
	resolveInputAsPath,
	resolveInputAsUrl,
	uninstall,
} from './lib';
import { installers } from './modules';

const cli = cac('deskit');

cli
	.command('install [appimage_path|webapp_url]', 'Install given input')
	.alias('i')
	.alias('add')
	.action(async (input: string) => {
		const webappUrl = resolveInputAsUrl(input);
		const appimagePath = resolveInputAsPath(input);
		if (appimagePath) {
			await oraPromise(installers.appimage(appimagePath));
		} else if (webappUrl) {
			await oraPromise(installers.webapp(webappUrl));
		} else {
			stderr.write('unknown input');
			stdout.write('\n');
			exit(1);
		}
	});

cli
	.command('list', 'List of installed apps')
	.alias('ls')
	.action(async () => {
		const apps = await installedApps();
		const RESET = '\x1b[0m';
		const DIM = '\x1b[2m';

		stdout.write(
			apps
				.map(
					(app) =>
						`${DIM}[${app.type}]${RESET} ${app.name} (${app.version})\t${DIM}${app.id}${RESET}`,
				)
				.join('\n'),
		);
		stdout.write('\n');
	});

cli
	.command('uninstall [input]', 'Uninstall given input')
	.alias('u')
	.alias('remove')
	.action(async (input: string) => {
		await oraPromise(uninstall(input));
	});

const version = JSON.parse(
	readFileSync(resolve(__dirname, '../package.json'), { encoding: 'utf-8' }),
).version as string;
cli.version(version);
cli.help();
cli.parse();
