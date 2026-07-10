import cloudbase from '@cloudbase/node-sdk';
import fs from 'node:fs';
const env = fs.readFileSync('.env','utf8');
const get = (k)=>(env.match(new RegExp(`^${k}=(.*)$`,'m'))?.[1]||'').trim();
const app = cloudbase.init({ envId:'hennanzsb-d2gg6lb9if6c9aa6f', secretId:get('TENCENTCLOUD_SECRET_ID'), secretKey:get('TENCENTCLOUD_SECRET_KEY') });
const db = app.database();
const r = await db.collection('comments').where({ wordId:3 }).get();
console.log('count=', (r.data||[]).length);
for (const c of (r.data||[])) console.log(JSON.stringify({_id:c._id, author:c.author, text:c.text, wordId:c.wordId}));
