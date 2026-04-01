#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const SKILL_DIR = path.resolve(__dirname, "..");
const MIRROR_HOST = "https://npmmirror.com/mirrors/playwright";
const TARGET_DEPENDENCIES = {
  exceljs: "4.4.0",
  playwright: "1.48.0",
  "rebrowser-patches": "1.0.19",
};

function log(step) {
  console.log(`==> ${step}`);
}

function resolveCommand(command) {
  if (process.platform === "win32" && (command === "npm" || command === "npx")) {
    return `${command}.cmd`;
  }
  return command;
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(resolveCommand(command), args, {
    cwd: SKILL_DIR,
    stdio: "inherit",
    env: options.env || process.env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  return result.status === 0;
}

function getInstalledVersion(pkgName) {
  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, {
      paths: [SKILL_DIR],
    });
    return JSON.parse(fs.readFileSync(pkgJsonPath, "utf8")).version;
  } catch {
    return null;
  }
}

function hasExpectedDependencies() {
  return Object.entries(TARGET_DEPENDENCIES).every(([pkgName, version]) => {
    return getInstalledVersion(pkgName) === version;
  });
}

function installDependencies() {
  const installArgs = [
    "install",
    "--save-exact",
    `exceljs@${TARGET_DEPENDENCIES.exceljs}`,
    `playwright@${TARGET_DEPENDENCIES.playwright}`,
    `rebrowser-patches@${TARGET_DEPENDENCIES["rebrowser-patches"]}`,
  ];

  log("正在安装固定版本 npm 依赖（优先 npmmirror）");
  const installedWithMirror = runCommand("npm", [
    ...installArgs,
    "--registry=https://registry.npmmirror.com",
  ]);

  if (installedWithMirror) {
    return;
  }

  log("npmmirror 安装失败，回退官方 npm 源");
  if (!runCommand("npm", installArgs)) {
    process.exit(1);
  }
}

function resolveChromiumExecutable() {
  try {
    const { chromium } = require(path.join(SKILL_DIR, "node_modules", "playwright"));
    return chromium.executablePath();
  } catch {
    return null;
  }
}

function hasInstalledChromium() {
  const executablePath = resolveChromiumExecutable();
  return Boolean(executablePath) && fs.existsSync(executablePath);
}

function installChromium() {
  const envWithMirror = {
    ...process.env,
    PLAYWRIGHT_DOWNLOAD_HOST: MIRROR_HOST,
  };

  log("正在通过 npmmirror 下载 Playwright Chromium");
  const installedWithMirror = runCommand(
    "npx",
    ["playwright", "install", "chromium"],
    { env: envWithMirror }
  );

  if (installedWithMirror) {
    return;
  }

  log("Chromium 镜像下载失败，回退官方源");
  if (!runCommand("npx", ["playwright", "install", "chromium"])) {
    process.exit(1);
  }
}

function patchPlaywright() {
  log("正在给 Playwright 打反检测补丁");
  if (!runCommand("npx", ["rebrowser-patches", "patch", "--packageName", "playwright"])) {
    console.warn("⚠️  补丁应用失败，反检测能力可能降低");
  }
}

function main() {
  log("正在检查 npm 依赖");
  if (hasExpectedDependencies()) {
    log("npm 依赖已满足目标版本，跳过安装");
  } else {
    installDependencies();
  }

  log("正在检查 Playwright Chromium");
  if (hasInstalledChromium()) {
    log("Chromium 浏览器已安装，跳过下载");
  } else {
    installChromium();
  }

  patchPlaywright();

  log("环境初始化完成");
}

main();
