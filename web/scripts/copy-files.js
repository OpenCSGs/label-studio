#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const copyFiles = [
  {
    from: "./node_modules/@martel/audio-file-decoder/decode-audio.wasm",
    to: "./node_modules/@martel/audio-file-decoder/dist/decode-audio.wasm"
  }
];

copyFiles.forEach(({ from, to }) => {
  const fromPath = path.resolve(__dirname, from);
  const toPath = path.resolve(__dirname, to);
  const toDir = path.dirname(toPath);

  try {
    // 确保目标目录存在
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }

    // 检查源文件是否存在
    if (fs.existsSync(fromPath)) {
      // 复制文件
      fs.copyFileSync(fromPath, toPath);
      console.log(`✓ Copied ${from} to ${to}`);
    } else {
      console.warn(`⚠ Source file not found: ${fromPath}`);
    }
  } catch (error) {
    console.error(`✗ Error copying ${from} to ${to}:`, error.message);
    process.exit(1);
  }
});

console.log('File copying completed!');
