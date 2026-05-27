// mem0-delete.mjs — 刪除特定記憶
// 用法：
//   npm run mem0:delete -- <memory-id>       依 ID 刪除
//   npm run mem0:delete -- --keyword "字串"   依關鍵字搜尋並刪除第一筆
import MemoryClient from 'mem0ai';

const arg = process.argv[2];
if (!arg) {
  console.error('用法：npm run mem0:delete -- <memory-id>');
  console.error('   或：npm run mem0:delete -- --keyword "字串"');
  process.exit(1);
}

const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

if (arg === '--keyword') {
  const keyword = process.argv[3];
  if (!keyword) { console.error('需提供關鍵字'); process.exit(1); }
  const r = await client.search(keyword, { filters: { user_id: 'chb-fileuploader' } });
  const hit = r?.results?.[0];
  if (!hit) { console.log('🔍 找不到相關記憶'); process.exit(0); }
  console.log(`找到：${hit.memory}`);
  await client.delete(hit.id);
  console.log('✅ 已刪除');
} else {
  await client.delete(arg);
  console.log(`✅ 已刪除 ID: ${arg}`);
}
