import cloudbase from '@cloudbase/node-sdk';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] || '').trim();
const secretId = get('TENCENTCLOUD_SECRET_ID');
const secretKey = get('TENCENTCLOUD_SECRET_KEY');
const ENV = 'hennanzsb-d2gg6lb9if6c9aa6f';

const app = cloudbase.init({ envId: ENV, secretId, secretKey });
const db = app.database();

const targetWordId = Number(process.argv[2] || 3);

console.log(`查找 wordId=${targetWordId} 的评论…`);
const all = await db.collection('comments').where({ wordId: targetWordId }).get();
const list = all.data || [];
console.log(`共找到 ${list.length} 条评论：`);
for (const c of list) {
  console.log(`  _id=${c._id} | author=${c.author} | text=${c.text}`);
}

if (list.length === 0) {
  console.log('没有需要删除的评论。');
  process.exit(0);
}

const { confirm } = process;
console.log('即将删除以上评论。');
for (const c of list) {
  await db.collection('comments').doc(String(c._id)).remove();
  console.log(`已删除 _id=${c._id}`);
}
console.log('完成。');
