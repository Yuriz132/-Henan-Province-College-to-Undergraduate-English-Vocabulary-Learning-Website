import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import cloudbase from '@cloudbase/node-sdk';

loadEnv();

const SECRET_ID = process.env.TENCENT_SECRET_ID;
const SECRET_KEY = process.env.TENCENT_SECRET_KEY;
const ENV_ID = 'hennanzsb-d2gg6lb9if6c9aa6f';
const DIST = '/workspace/frontend/dist';

if (!SECRET_ID || !SECRET_KEY) {
  console.error('缺少环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY，请在 .env 中配置');
  process.exit(1);
}

const app = cloudbase.init({ secretId: SECRET_ID, secretKey: SECRET_KEY, env: ENV_ID });

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name).split(path.sep).join('/');
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else out.push({ full, rel });
  }
  return out;
}

async function main() {
  const files = walk(DIST).filter((f) => f.rel !== '.gitkeep');
  console.log(`Found ${files.length} files`);
  let ok = 0;
  let fail = 0;
  for (const f of files) {
    try {
      const buf = fs.readFileSync(f.full);
      await app.storage.uploadFile({ cloudPath: f.rel, fileContent: buf });
      ok++;
      console.log(`✔ ${f.rel}`);
    } catch (e) {
      fail++;
      console.error(`✖ ${f.rel}: ${e.message}`);
    }
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
