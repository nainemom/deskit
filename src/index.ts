#!/usr/bin/env node

import { cac } from "cac";
import { installedApps, resolveInputAsPath, uninstall } from "./lib";
import { installers } from "./modules";
import { oraPromise } from "ora";

const cli = cac("appimage-sync");

cli
  .command("install [appimage_path|webapp_url]", "Install given input")
  .alias("i")
  .action(async (input: string) => {
    // const webappUrl = resolveInputAsUrl(input);
    const appimagePath = resolveInputAsPath(input);
    if (appimagePath) {
      await oraPromise(installers.appimage(appimagePath));
    }
  });

cli
  .command("list", "List of installed apps")
  .alias("ls")
  .action(async () => {
    const apps = await oraPromise(installedApps(), {
      isSilent: true,
    });
    console.log(apps.join("\n"));
  });

cli
  .command("uninstall [input]", "Uninstall given input")
  .alias("u")
  .action(async (input: string) => {
    await oraPromise(uninstall(input));
  });

cli.version("0.0.0");
cli.help();
cli.parse();
