#!/bin/bash
# 双击我即可启动 / ダブルクリックで起動
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "需要安装 Node.js（https://nodejs.org）"
  echo "Node.js が必要です（https://nodejs.org）"
  read -r -p "按回车键关闭 / Enter で閉じる"
  exit 1
fi
node server.mjs 8765
