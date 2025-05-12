import { execSync } from "node:child_process";
import { basename, join, resolve } from "node:path";
import {
  checksum,
  ICONS_DIR,
  TEMP_DIR,
  STATIC_DIR,
  SHORTCUTS_DIR,
} from "../../lib";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";

export const appimage = async (filePath: string) => {
  const appId = await checksum(filePath);

  // Copy .appimage to static dir
  mkdirSync(STATIC_DIR, { recursive: true });
  const appPath = resolve(STATIC_DIR, appId);
  copyFileSync(filePath, appPath);
  chmodSync(appPath, 0o755);

  // Extract app to temp folder
  const extractDirRoot = resolve(TEMP_DIR, appId);
  mkdirSync(extractDirRoot, { recursive: true });
  execSync(`${appPath} --appimage-extract`, { cwd: extractDirRoot });
  const extractDir = resolve(extractDirRoot, "squashfs-root");

  const originalDesktopFileContent = (() => {
    const desktopFileName = readdirSync(extractDir).find((f) =>
      f.endsWith(".desktop")
    );
    if (!desktopFileName)
      return '';
    [
        "[Desktop Entry]",
        `Name=${basename(filePath)}`,
        "Exec=",
        "Terminal=false",
        "Type=Application",
        "X-Version=0.0.0",
        "Icon=",
      ].join("\n");
    return readFileSync(resolve(extractDir, desktopFileName), "utf8");
  })();

  const icon = (() => {
    const dirIconPath = resolve(extractDir, ".DirIcon");
    if (existsSync(dirIconPath)) {
      let iconSourcePath = dirIconPath;
      const stat = statSync(dirIconPath);
      if (stat.isSymbolicLink()) {
        iconSourcePath = realpathSync(dirIconPath);
      }
      mkdirSync(ICONS_DIR, { recursive: true });
      const iconTargetPath = resolve(ICONS_DIR, appId);
      copyFileSync(iconSourcePath, iconTargetPath);
      return iconTargetPath;
    }
    return null;
  })();

  const name = (() => {
    const match = originalDesktopFileContent.match(/^Name=(.+)$/m);
    if (match && match[1]) return match[1];
    return null;
  })();

  const version = (() => {
    const match = originalDesktopFileContent.match(/^X-AppImage-Version=(.+)$/m);
    if (match && match[1])
      return match[1];
    return null;
  })();

  const desktopFileContent = (() => {
    let ret: string[] = [
      '[Desktop Entry]',
      `Name=${name || basename(filePath)}`,
      `Icon=${icon || ''}`,
      `X-Version=${version || '0.0.0'}`,
      'X-Type=AppImage',
      `Exec=${appPath}`,
    ];

    originalDesktopFileContent.split('\n').forEach((line) => {
      if (!ret.map(r => r.split('=')[0]).includes(line.split('=')[0])) {
        ret = [
          ...ret,
          line,
        ];
      }
    });

    return ret.join('\n');
  })();


  mkdirSync(SHORTCUTS_DIR, { recursive: true });
  const desktopFileTarget = join(SHORTCUTS_DIR, `${appId}.desktop`);
  writeFileSync(desktopFileTarget, desktopFileContent, {
    encoding: "utf-8",
  });
  chmodSync(desktopFileTarget, 0o755);

  rmSync(extractDirRoot, { recursive: true, force: true });

  return desktopFileTarget;
};
