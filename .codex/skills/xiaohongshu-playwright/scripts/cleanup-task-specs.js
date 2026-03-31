#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function main() {
  const taskSpecDir = path.join(__dirname, "..", "data", "task-specs");
  if (!fs.existsSync(taskSpecDir)) {
    console.log(taskSpecDir);
    return;
  }

  for (const file of fs.readdirSync(taskSpecDir)) {
    if (!file.endsWith(".json")) continue;
    fs.unlinkSync(path.join(taskSpecDir, file));
  }

  console.log(taskSpecDir);
}

main();
