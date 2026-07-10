// 部署脚本：将 frontend/dist 上传到 CloudBase 静态托管（绕开 tcb CLI 的已知问题）。
// 用法：node cloudbase-deploy.mjs
// 说明：使用环境 API 密钥直连 COS 静态托管桶上传，按文件并发。
import fs from 'node:fs';
import path from 'node:path';
import COS from 'cos-nodejs-sdk-v5';

// 从仓库根目录 .env 读取密钥（不写死、不提交到仓库）
function loadEnv(key) {
  try {
    const text = fs.readFileSync(path.resolve('..', '.env'), 'utf8');
    const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (m) return m[1].trim();
  } catch {
    /* ignore */
  }
  return process.env[key] || '';
}

const SECRET_ID = loadEnv('TENCENTCLOUD_SECRET_ID');
const SECRET_KEY = loadEnv('TENCENTCLOUD_SECRET_KEY');
if (!SECRET_ID || !SECRET_KEY) {
  console.error('缺少 TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY，请检查根目录 .env');
  process.exit(1);
}
const REGION = 'ap-shanghai';
const BUCKET = '0d09-static-hennanzsb-d2gg6lb9if6c9aa6f-1451800226';
const DIST = path.resolve('dist');

const cos = new COS({ SecretId: SECRET_ID, SecretKey: SECRET_KEY });

function headersFor(rel) {
  // index.html 禁止缓存，确保每次都能拿到最新的资源哈希引用
  if (rel === 'index.html') {
    return { 'Cache-Control': 'no-cache, no-store, must-revalidate', Pragma: 'no-cache', Expires: '0' };
  }
  // 带哈希戳的资源可以长期缓存
  if (/\.[a-f0-9]{8}\./.test(rel)) {
    return { 'Cache-Control': 'public, max-age=31536000, immutable' };
  }
  return {};
}

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
  if (!fs.existsSync(DIST)) {
    console.error(`找不到构建目录 ${DIST}，请先运行 pnpm build`);
    process.exit(1);
  }
  const files = walk(DIST).filter((f) => f.rel !== '.gitkeep');
  console.log(`Found ${files.length} files`);
  let ok = 0;
  let fail = 0;
  await Promise.all(
    files.map(async (f) => {
      try {
        await new Promise((resolve, reject) => {
          cos.putObject(
            { Bucket: BUCKET, Region: REGION, Key: f.rel, Body: fs.createReadStream(f.full), Headers: headersFor(f.rel) },
            (err, data) => (err ? reject(err) : resolve(data))
          );
        });
        ok++;
        console.log(`✔ ${f.rel}`);
      } catch (e) {
        fail++;
        console.error(`✖ ${f.rel}: ${e.message}`);
      }
    })
  );
  console.log(`\nDone. ok=${ok} fail=${fail}`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
