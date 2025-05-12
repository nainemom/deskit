#!/usr/bin/env node

import { cac } from "cac";
import { installedApps, resolveInputAsPath, uninstall } from "./lib";
import { installers } from "./modules";
import { oraPromise } from "ora";
import { stdout } from "node:process";

const cli = cac("appimage-sync");

cli
  .command("install [appimage_path|webapp_url]", "Install given input")
  .alias("i")
  .alias("add")
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
    const apps = await installedApps();
    const RESET = "\x1b[0m";
    const DIM = "\x1b[2m";

    stdout.write(apps.map(app => `${DIM}[${app.type}]${RESET} ${app.name} (${app.version})\t${DIM}${app.id}${RESET}`).join("\n"));
    stdout.write('\n');
  });

cli
  .command("uninstall [input]", "Uninstall given input")
  .alias("u")
  .alias("remove")
  .action(async (input: string) => {
    await oraPromise(uninstall(input));
  });

cli.version("0.0.0");
cli.help();
cli.parse();
