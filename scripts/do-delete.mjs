import cloudbase from '@cloudbase/node-sdk';
import fs from 'node:fs';
const env = fs.readFileSync('.env','utf8');
const get = (k)=>(env.match(new RegExp(`^${k}=(.*)$`,'m'))?.[1]||'').trim();
const app = cloudbase.init({ envId:'hennanzsb-d2gg6lb9if6c9aa6f', secretId:get('TENCENTCLOUD_SECRET_ID'), secretKey:get('TENCENTCLOUD_SECRET_KEY') });
const db = app.database();
const list = await db.collection('comments').where({ wordId:3 }).get();
const ids = (list.data||[]).map(c=>c._id);
console.log('待删除条数:', ids.length);
for (const id of ids) {
  const res = await db.collection('comments').doc(String(id)).remove();
  console.log('删除 _id=', id, '=>', JSON.stringify(res));
}
const after = await db.collection('comments').where({ wordId:3 }).get();
console.log('剩余条数:', (after.data||[]).length);
