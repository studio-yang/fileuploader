// mem0-search.mjs — 搜尋特定記憶（Claude 需要查找時呼叫）
// 用法：node --env-file=.env.local scripts/mem0-search.mjs "關鍵字"
import MemoryClient from 'mem0ai';

const query = process.argv[2];
if (!query) {
  console.error('用法：npm run mem0:search -- "關鍵字"');
  process.exit(1);
}

const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

const results = await client.search(query, { user_id: 'chb-fileuploader' });

if (!results?.results?.length) {
  console.log('🔍 找不到相關記憶。');
} else {
  console.log(`🔍 找到 ${results.results.length} 筆：\n`);
  results.results.forEach((m, i) => {
    console.log(`${i + 1}. [${(m.score * 100).toFixed(0)}%] ${m.memory}`);
  });
}
