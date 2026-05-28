/// <reference lib="webworker" />
import SevenZip from '7z-wasm';

interface InMsg {
  items:      { name: string; data: ArrayBuffer }[];
  password:   string;
  level:      number;
  splitBytes: number;
}

self.addEventListener('message', async (e: MessageEvent<InMsg>) => {
  const { items, password, level, splitBytes } = e.data;
  try {
    let stderr = '';
    const sz: any = await (SevenZip as any)({
      print:    () => {},
      printErr: (s: string) => { stderr += s + '\n'; },
    });

    for (const it of items) {
      sz.FS.writeFile(it.name, new Uint8Array(it.data));
    }

    const total = items.reduce((s, it) => s + it.data.byteLength, 0);
    const needSplit = total > splitBytes;
    const outName = 'output.7z';

    const args: string[] = ['a', '-y', `-p${password}`, '-mhe=on', `-mx=${level}`];
    if (needSplit) args.push(`-v${splitBytes}b`);
    args.push(outName, ...items.map((it) => it.name));

    let exit = 0;
    try { exit = sz.callMain(args); }
    catch (err: any) {
      throw new Error(err?.message || String(err?.status ?? err) || 'WASM 執行失敗');
    }
    if (typeof exit === 'number' && exit !== 0) {
      throw new Error(`7z exit ${exit}: ${stderr.slice(0, 300)}`);
    }

    const results: { name: string; data: Uint8Array }[] = [];
    if (needSplit) {
      const entries: string[] = sz.FS.readdir('/');
      const parts = entries.filter((n: string) => n.startsWith(outName + '.')).sort();
      if (parts.length === 0) throw new Error(`無輸出: ${stderr.slice(0, 300)}`);
      for (const p of parts) results.push({ name: p, data: sz.FS.readFile(p) });
    } else {
      results.push({ name: outName, data: sz.FS.readFile(outName) });
    }

    const transferables = results.map((r) => r.data.buffer);
    (self as any).postMessage({ type: 'done', results }, transferables);
  } catch (err: any) {
    (self as any).postMessage({ type: 'error', message: err?.message || String(err) || 'unknown' });
  }
});

export {};
