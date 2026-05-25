// mem0-load.mjs — 載入此專案所有記憶（Claude session 開始時執行）
import MemoryClient from 'mem0ai';

const client = new MemoryClient({ apiKey: process.env.MEM0_API_KEY });

const { results } = await client.getAll({ filters: { user_id: 'chb-fileuploader' } });

if (!results || results.length === 0) {
  console.log('📭 尚無專案記憶。');
} else {
  console.log(`📚 載入 ${results.length} 筆記憶：\n`);
  results.forEach((m, i) => {
    console.log(`${i + 1}. ${m.memory}`);
  });
}
