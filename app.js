import axios from 'axios';
import dotenv from 'dotenv';
import ChatClientDirectWeb from './chat/ChatClientDirectWeb.js';
import https from 'https';

const VTSURU_BASE_URL = 'https://hongkong.vtsuru.live/api/';
const VTSURU_EVENT_URL = VTSURU_BASE_URL + 'event/';

let TOKEN;
let uid = -1;
let roomId = -1;
let chatClient;
let status = 'ok';

let isCookieValid = false;

let events = [];

const agent = new https.Agent({
  rejectUnauthorized: false,
  minVersion: 'TLSv1.2',
});

Init();
async function Init() {
  dotenv.config();
  const u = extractDedeUserID(process.env.VTSURU_BILI_COOKIE);
  if (!u) {
    status = 'cookie无效';
    console.log('cookie无效, 可能导致事件缺失');
  } else {
    uid = Number(u);
    console.log('cookie: ' + process.env.VTSURU_BILI_COOKIE);
    console.log('uid: ' + u);
  }
  if (!process.env.VTSURU_TOKEN) {
    console.log('未提供token');
    return;
  }
  console.log('token: ' + process.env.VTSURU_TOKEN);
  TOKEN = process.env.VTSURU_TOKEN;
  await checkCookie();
  await Check();
  setInterval(async () => {
    await Check();
  }, 5000);
  setInterval(() => {
    checkCookie();
  }, 30000);
}
let isFirst = true;
let isChecking = false;
async function Check() {
  if (isChecking) {
    return;
  }
  isChecking = true;
  try {
    const success = await SendEvent();
    if (success && !chatClient) {
      initChatClient();
    }
  } catch (err) {
    console.log(err);
    isChecking = false;
  }
}
async function checkCookie() {
  try {
    const response = await axios.get('https://api.bilibili.com/x/member/web/account', {
      headers: {
        Cookie: process.env.VTSURU_BILI_COOKIE,
      },
      httpAgent: agent,
    });
    const json = response.data;
    if (json.code !== 0) {
      isCookieValid = false;
      status = 'Cookie已失效';
      console.log(`Cookie已失效: [${json.code}] ${json.message}`);
    } else {
      if (isFirst) {
        console.log('cookie有效: ' + JSON.stringify(json.data));
      }
      uid = json.data.mid;
      isCookieValid = true;
      status = 'ok';
    }
  } catch (ex) {
    Logs.Warn(ex);
  }
}
function extractDedeUserID(str) {
  const regex = /DedeUserID=([^;]+)/;
  const match = str.match(regex);
  if (match && match[1]) {
    return match[1];
  }
  return null; // 如果未找到匹配项，则返回null或其他适当的默认值
}
async function SendEvent() {
  const tempEvents = events.length > 10 ? [...events].splice(0, 10) : events;
  try {
    let res = (
      await axios.post(VTSURU_EVENT_URL + 'add', tempEvents, {
        params: {
          token: TOKEN,
          status: status,
        },
        httpAgent: agent,
      })
    ).data;
    if (res.code == 200) {
      if (isFirst) {
        isFirst = false;
      }
      if (tempEvents.length > 0) {
        console.log(`[ADD EVENT] 已发送 ${tempEvents.length} 条事件`);
        events.splice(0, tempEvents.length);
      }
      roomId = res.data;
      return true;
    } else {
      console.log(`[ADD EVENT] 失败: ${res.message}`);
      return false;
    }
  } catch (err) {
    console.error('[ADD EVENT] 失败:', err);
    return false;
  }
}
async function initChatClient() {
  const cookie = process.env.VTSURU_BILI_COOKIE;
  chatClient = new ChatClientDirectWeb(roomId, cookie ? { cookie: cookie, uid: uid } : null);

  //chatClient.msgHandler = this;
  chatClient.CMD_CALLBACK_MAP = CMD_CALLBACK_MAP;
  chatClient.start();
  console.log('已连接房间');
}
function OnSC(command) {
  const data = command.data;
  console.log(`[SC事件] ${data.user_info?.uname}: ${data.message}`);
  events.push({
    type: 1,
    name: data.user_info.uname,
    uId: data.uid,
    msg: data.message,
    price: data.price,
    num: 1,
    time: data.ts,
  });
}
function OnGuard(command) {
  const data = command.data;
  console.log(`[舰长事件] ${data.username}: ${data.role_name}`);
  events.push({
    type: 0,
    name: data.username,
    uId: data.uid,
    msg: data.role_name,
    price: data.price / 1000,
    num: data.num,
    time: Date.now(),
  });
}
const CMD_CALLBACK_MAP = {
  USER_TOAST_MSG: OnGuard,
  SUPER_CHAT_MESSAGE: OnSC,
};
