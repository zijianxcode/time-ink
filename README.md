# Zero Draft Clone

一个可直接运行的“Zero Draft 写作冲刺”网站克隆版（Next.js + TypeScript）。

## 功能
- 时长选择：3 / 5 / 10 / 15 / 20 / 30 / 60 分钟
- 倒计时：开始、暂停、重置
- 主编辑区：实时输入
- 本地持久化：当前草稿、已保存内容、剩余时间
- 倒计时结束自动保存
- 复制本轮内容 / 复制已保存内容
- 清空本轮 / 重新开始
- 防误关页面提醒（计时中且有内容时）
- 快捷键：
  - Ctrl/Cmd + Enter：开始/暂停
  - Ctrl/Cmd + L：清空本轮

## 运行
```bash
npm install
npm run dev
```
浏览器打开：`http://localhost:3000`
