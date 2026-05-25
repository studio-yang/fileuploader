// mem0-save.mjs — 儲存一筆記憶（Claude 主動呼叫）
// 用法：node --env-file=.env.local scripts/mem0-save.mjs "記憶內容"
import MemoryClient from 'mem0ai';

const memory = process.argv[2];
if (!memory) {
  console.error('用法：npm run mem0:save -- "記憶內容"');
  process.exit(1);
}

const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

await client.add(
  [{ role: 'assistant', content: memory }],
  { user_id: 'chb-fileuploader' }
);

console.log('✅ 已儲存：', memory);
