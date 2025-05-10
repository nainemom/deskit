import { createHash } from "node:crypto";
import {
  createReadStream,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { cwd } from "node:process";

const PREFIX = "deskit";

export const HOME = process.env.HOME || process.env.USERPROFILE || "";

export const SHORTCUTS_DIR = join(HOME, ".local/share/applications");
export const ICONS_DIR = join(HOME, `.local/share/icons`);
export const STATIC_DIR = join(HOME, `.local/share/${PREFIX}`);
export const TEMP_DIR = join(HOME, `.temp/${PREFIX}`);

export const checksum = async (input: string | URL) => {
  const hash = createHash("md5");

  if (typeof input === "string" && statSync(input).isFile()) {
    const stream = createReadStream(input, {
      autoClose: true,
      encoding: "utf-8",
    });
    for await (const chunk of stream) {
      hash.update(chunk as Buffer);
    }
  } else {
    hash.update(input.toString());
  }

  return hash.digest("hex");
};

export const installedApps = () =>
  Promise.resolve(
    readdirSync(STATIC_DIR).map((appId) => {
      const name = (() => {
        try {
          const desktopFileContent = readFileSync(
            resolve(SHORTCUTS_DIR, `${appId}.desktop`),
            {
              encoding: "utf-8",
            }
          );
          const match = desktopFileContent.match(/^Name=(.+)$/m);
          return match ? match[1] : "Unknown";
        } catch {
          return "Unknown";
        }
      })();

      return `${name}: ${appId}`;
    })
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
