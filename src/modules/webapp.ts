import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { HOME, ICONS_DIR, SHORTCUTS_DIR, STATIC_DIR, checksum } from '../lib';

export const webapp = async (webappUrl: URL) => {
	const appId = await checksum(webappUrl);

	const profilePath = resolve(HOME, `.local/share/ice/profiles/${appId}`);
	mkdirSync(profilePath, {
		recursive: true,
	});

	mkdirSync(STATIC_DIR, { recursive: true });
	const appPath = resolve(STATIC_DIR, appId);
	writeFileSync(
		appPath,
		`
    #!/bin/bash
  
    if command -v google-chrome-stable > /dev/null 2>&1; then
      BROWSER_CMD="google-chrome-stable"
    elif command -v google-chrome > /dev/null 2>&1; then
      BROWSER_CMD="google-chrome"
    elif command -v chromium-browser > /dev/null 2>&1; then
      BROWSER_CMD="chromium-browser"
    elif command -v chromium > /dev/null 2>&1; then
      BROWSER_CMD="chromium"
    else
      exit 1
    fi

    # Run the browser with the URL and additional arguments
    "$BROWSER_CMD" --app="${webappUrl.toString()}" --class=Deskit-${appId} --name=Deskit-${appId} --user-data-dir=${profilePath}
  `,
	);
	chmodSync(appPath, 0o755);

	const dom = await (async () => {
		const content = await fetch(webappUrl.toString(), {
			headers: {
				accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
				'accept-language': 'en-US,en;q=0.9,fa-IR;q=0.8,fa;q=0.7',
				'cache-control': 'max-age=0',
				priority: 'u=0, i',
				'sec-fetch-dest': 'document',
				'sec-fetch-mode': 'navigate',
				'sec-fetch-site': 'same-origin',
				'sec-fetch-user': '?1',
			},
			referrerPolicy: 'strict-origin-when-cross-origin',
			method: 'GET',
			mode: 'cors',
		}).then((res) => res.text());
		return new JSDOM(content).window.document;
	})();

	const icon = await (async () => {
		const iconEls = [...dom.head.querySelectorAll('link[rel*="icon"]')];
		for (const iconEl of iconEls) {
			const href = iconEl.getAttribute('href');
			if (href) {
				const iconUrl = new URL(href, webappUrl);
				const iconPath = resolve(ICONS_DIR, appId);
				const iconContent = await fetch(iconUrl.toString()).then((res) =>
					res.arrayBuffer(),
				);
				mkdirSync(ICONS_DIR, { recursive: true });
				writeFileSync(iconPath, Buffer.from(iconContent));
				return iconPath;
			}
		}
		return null;
	})();

	const name = await (async () => {
		const titleEl = dom.head.querySelector('title');
		const ret = titleEl?.innerHTML || webappUrl.hostname;
		if (ret.includes('|')) {
			const parts = ret.split('|');
			return parts[parts.length - 1].trim();
		}
		return ret;
	})();

	const version = 'latest';

	const desktopFileContent = (() => {
		const ret: string[] = [
			'[Desktop Entry]',
			`Name=${name}`,
			`Icon=${icon}`,
			`X-Version=${version}`,
			'X-Type=WebApp',
			`Exec=${appPath}`,
			'Terminal=false',
			'Type=Application',
		];

		return ret.join('\n');
	})();

	mkdirSync(SHORTCUTS_DIR, { recursive: true });
	const desktopFileTarget = join(SHORTCUTS_DIR, `${appId}.desktop`);
	writeFileSync(desktopFileTarget, desktopFileContent, {
		encoding: 'utf-8',
	});
	chmodSync(desktopFileTarget, 0o755);

	return desktopFileTarget;
};
