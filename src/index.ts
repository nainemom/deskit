#!/usr/bin/env node

import { execSync } from 'node:child_process';
import {
	chmodSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	realpathSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { argv, cwd, exit, stderr, stdout } from 'node:process';
import {
	cancel,
	confirm,
	intro,
	log,
	multiselect,
	outro,
} from '@clack/prompts';
import { isLinux } from 'std-env';

const HOME = process.env.HOME || process.env.USERPROFILE || '';
const DESKTOP_DIR = join(HOME, '.local/share/applications');
const ICON_DIR = join(HOME, '.local/share/icons/appimage-sync');
const PREFIX = 'appimage-sync';

const getSyncedAppNames = (): string[] => {
	if (!existsSync(DESKTOP_DIR)) return [];
	return readdirSync(DESKTOP_DIR)
		.filter((f) => f.startsWith(`${PREFIX}-`) && f.endsWith('.desktop'))
		.map((f) => f.slice(PREFIX.length + 1, -8));
};

const extractAppImage = (path: string, tempDir: string): string => {
	execSync(`${path} --appimage-extract`, { cwd: tempDir });
	return join(tempDir, 'squashfs-root');
};

const run = async () => {
	const packageJson: { version: string } = JSON.parse(
		readFileSync(join(__dirname, '../package.json'), 'utf8'),
	);
	intro(`AppImage Sync v${packageJson.version}`);

	if (!isLinux) {
		return cancel('This tool only works on Linux.');
	}

	const appImagesDir = resolve(cwd(), argv[2] || '.');
	if (!existsSync(appImagesDir)) {
		return cancel(`"${appImagesDir}" does not exist.`);
	}

	const appImages = readdirSync(appImagesDir).filter((file) =>
		file.toLowerCase().endsWith('.appimage'),
	);

	if (appImages.length === 0) {
		return cancel(`No AppImages found in "${appImagesDir}".\n`);
	}

	const syncedNames = getSyncedAppNames();

	const selected = await multiselect({
		message: 'Select AppImages to sync:',
		initialValues: syncedNames,
		options: appImages.map((file) => ({
			label: file,
			value: file,
		})),
		required: false,
	})
		.then((value) => (Array.isArray(value) ? value : []))
		.catch(() => []);

	log.info('Cleaning old entries...');

	for (const name of syncedNames) {
		const desktopPath = join(DESKTOP_DIR, `${PREFIX}-${name}.desktop`);
		if (existsSync(desktopPath)) rmSync(desktopPath);
	}
	if (existsSync(ICON_DIR)) rmSync(ICON_DIR, { recursive: true });
	mkdirSync(ICON_DIR, { recursive: true });

	if (selected.length === 0) {
		return outro('Done!');
	}
	log.info('Extracting and syncing selected AppImages...\n');

	for (const file of selected) {
		try {
			const absPath = join(appImagesDir, file);
			log.step(`Processing ${file}...`);

			log.step(`Making executable: ${file}`);
			chmodSync(absPath, 0o755);

			const tempDir = resolve(
				'/tmp',
				`appimage-sync-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			);
			mkdirSync(tempDir, { recursive: true });

			log.step('Extracting AppImage...');
			const extractedPath = extractAppImage(absPath, tempDir);

			const desktopFileName = readdirSync(extractedPath).find((f) =>
				f.endsWith('.desktop'),
			);
			if (!desktopFileName) throw new Error('No .desktop file found.');

			const desktopFilePath = join(extractedPath, desktopFileName);
			const rawDesktop = readFileSync(desktopFilePath, 'utf8');

			const iconTargetPath = join(ICON_DIR, basename(file, '.AppImage'));
			const dirIconPath = join(extractedPath, '.DirIcon');
			if (existsSync(dirIconPath)) {
				let iconSourcePath = dirIconPath;
				const stat = statSync(dirIconPath);
				if (stat.isSymbolicLink()) {
					iconSourcePath = realpathSync(dirIconPath);
				}
				log.step(`Copying icon to ${iconTargetPath}\n`);
				copyFileSync(iconSourcePath, iconTargetPath);
			} else {
				log.warn('No .DirIcon found.\n');
			}

			log.step('Writing modified .desktop entry...\n');
			const modifiedDesktop = rawDesktop
				.replace(/^Exec=.*$/m, `Exec=${absPath}`)
				.replace(/^Icon=.*$/m, `Icon=${iconTargetPath}`);

			const outDesktopPath = join(DESKTOP_DIR, `${PREFIX}-${file}.desktop`);
			writeFileSync(outDesktopPath, modifiedDesktop);
			chmodSync(outDesktopPath, 0o755);

			log.step('Cleaning up extracted temp files...\n');
			rmSync(tempDir, { recursive: true, force: true });
			log.step(`Synced ${file}\n`);
		} catch (err) {
			log.error(`Failed to process ${file}: ${(err as Error).message}\n`);
		}
	}

	outro('Done!');
};

run();
