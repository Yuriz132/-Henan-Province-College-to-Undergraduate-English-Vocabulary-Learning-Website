// 云函数（HTTP 类型）：管理员删除评论
// 以 HTTP 函数部署后，可通过公网 URL 直接调用，绕过云函数的“调用权限”限制。
// 仅当传入的 code 正确时才执行删除，口令由前端在管理员模式下传入。
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: 'hennanzsb-d2gg6lb9if6c9aa6f' });

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.main = async (event) => {
  // 处理 CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  let body = {};
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body || {};
  } catch {
    /* ignore */
  }
  const { id, code } = body;
  if (code !== '20051226') {
    return { statusCode: 403, headers, body: JSON.stringify({ ok: false, error: 'forbidden' }) };
  }
  if (!id) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'missing id' }) };
  }
  try {
    await app.database().collection('comments').doc(String(id)).remove();
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: String(e && e.message ? e.message : e) }),
    };
  }
};
