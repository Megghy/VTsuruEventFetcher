import axios from 'axios';
import dotenv from 'dotenv';
import ChatClientDirectOpenLive from './chat/ChatClientDirectOpenLive.js';
import http from 'http';

const VTSURU_BASE_URL = 'https://hongkong.vtsuru.live/api/';
const VTSURU_EVENT_URL = VTSURU_BASE_URL + 'event/';

let TOKEN;
let chatClient;
let status = 'ok';
let code;
let authInfo;
let self;

let events = [];

Init();
async function Init() {
  dotenv.config();
  console.log('token: ' + process.env.VTSURU_TOKEN);
  TOKEN = process.env.VTSURU_TOKEN;
  if (process.env.PORT) {
    const port = process.env.PORT;
    const server = http.createServer((req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Hello World');
    });

    server.listen(port, () => {
      console.log(`Server is listening: ${port}`);
    });
  }

  setInterval(() => {
    SendHeartbeat();
  }, 20000);
  SendEvent();
}
let isFirst = true;
async function getSelfInfo() {
  try {
    let res = (
      await axios.get(VTSURU_BASE_URL + 'account/self', {
        params: {
          token: TOKEN,
        },
      })
    ).data;
    if (res.code == 200) {
      if (!res.data.biliAuthCode) {
        console.log('[GET INFO] 你尚未绑定B站账号并填写身份码, 请前往控制面板进行绑定');
        return false;
      }
      self = res.data;
      return true;
    } else {
      console.log('[GET USER INFO] ' + res.message);
    }
  } catch (err) {
    console.log(err.message);
    return false;
  }
}
async function startRoom() {
  try {
    let res = (
      await axios.get(VTSURU_BASE_URL + 'open-live/start', {
        params: {
          token: TOKEN,
        },
      })
    ).data;
    if (res.code == 200) {
      authInfo = res.data;
      return res.data;
    } else {
      console.log('[START ROOM] ' + res.message);
    }
  } catch (err) {
    console.log(err.message);
    return null;
  }
}
/**
 * Sends an event to the server.
 *
 * @return {boolean} Returns `true` if the event was sent successfully, otherwise `false`.
 */
async function SendEvent() {
  const tempEvents = events.length > 20 ? [...events].splice(0, 20) : events;
  try {
    let res = (
      await axios.post(VTSURU_EVENT_URL + 'update', tempEvents, {
        params: {
          token: TOKEN,
          status: status,
        },
      })
    ).data;
    if (res.code == 200) {
      if (isFirst) {
        isFirst = false;
      }
      if (tempEvents.length > 0) {
        console.log(
          `[ADD EVENT] 已发送 ${tempEvents.length} 条事件: 舰长-${tempEvents.filter((e) => e.type == 0).length}, SC-${
            tempEvents.filter((e) => e.type == 1).length
          }, 礼物-${tempEvents.filter((e) => e.type == 2).length}, 弹幕-${tempEvents.filter((e) => e.type == 3).length}`
        );
        events.splice(0, tempEvents.length);
      }
      if (code && code != res.data) {
        console.log('[ADD EVENT] 房间号改变, 重新连接');
        code = res.data;
        RestartRoom();
      }
      33;
      code = res.data;

      if (!chatClient) {
        initChatClient();
      }
      return true;
    } else {
      console.log(`[ADD EVENT] 失败: ${res.message}`);
      return false;
    }
  } catch (err) {
    console.error('[ADD EVENT] 无法访问后端: ' + err.message);
    return false;
  } finally {
    setTimeout(async () => {
      SendEvent();
    }, 1100);
  }
}
function RestartRoom() {
  if (chatClient) {
    chatClient.stop();
  }
  chatClient = undefined;
  initChatClient();
}
async function SendHeartbeat() {
  if (!chatClient || !authInfo) {
    return;
  }
  try {
    const resp = (
      await axios.get(VTSURU_BASE_URL + 'open-live/heartbeat-internal', {
        params: {
          token: TOKEN,
        },
      })
    ).data;
    if (resp.code != 200) {
      console.log('[HEARTBEAT] 已过期 ' + resp.message);
      RestartRoom();
      return false;
    }
    true;
  } catch {
    return false;
  }
}
let isIniting = false;
async function initChatClient() {
  if (isIniting) {
    return;
  }
  isIniting = true;
  while (!(await getSelfInfo())) {
    console.log('无法获取用户信息, 10秒后重试');
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  let authInfo = await startRoom();
  while (!authInfo) {
    console.log('无法开启场次, 10秒后重试');
    await new Promise((resolve) => setTimeout(resolve, 10000));
    if (!authInfo) {
      authInfo = await startRoom();
    }
  }
  try {
    const tempClient = new ChatClientDirectOpenLive(authInfo);

    //chatClient.msgHandler = this;
    tempClient.CMD_CALLBACK_MAP = CMD_CALLBACK_MAP;
    tempClient.start();
    chatClient = tempClient;
    console.log('已连接房间: ' + authInfo.anchor_info.room_id);
    isIniting = false;
  } catch (err) {
    console.log(err);
  }
}
function OnSC(command) {
  const data = command.data;
  console.log(`[SC事件] ${data.user_info?.uname}: ${data.message} <${data.rmb}元>`);
  events.push({
    type: 1,
    name: data.uname,
    uId: data.uid,
    msg: data.message,
    price: data.rmb,
    num: 1,
    time: data.timestamp,
    guard_level: data.guard_level,
    fans_medal_level: data.fans_medal_level,
    fans_medal_name: data.fans_medal_name,
    fans_medal_wearing_status: data.fans_medal_wearing_status,
  });
}
function OnGuard(command) {
  const data = command.data;
  const model = {
    type: 0,
    name: data.user_info.uname,
    uId: data.user_info.uid,
    msg: data.guard_level == 1 ? '总督' : data.guard_level == 2 ? '提督' : '舰长',
    price: 0,
    num: data.num,
    time: data.timestamp,
    guard_level: data.guard_level,
    fans_medal_level: data.fans_medal_level,
    fans_medal_name: data.fans_medal_name,
    fans_medal_wearing_status: data.fans_medal_wearing_status,
  };
  console.log(`[舰长事件] ${data.user_info.uname}: ${model.msg}`);
  events.push(model);
}
function OnMessage(command) {
  const data = command.data;
  console.log(`[弹幕事件] ${data.uname}: ${data.msg}`);
  events.push({
    type: 3,
    name: data.uname,
    uId: data.uid,
    msg: data.msg,
    price: 0,
    num: 0,
    time: data.timestamp,
    guard_level: data.guard_level,
    fans_medal_level: data.fans_medal_level,
    fans_medal_name: data.fans_medal_name,
    fans_medal_wearing_status: data.fans_medal_wearing_status,
    emoji: data.dm_type == 1 ? data.emoji_img_url : null,
  });
}
function OnGift(command) {
  const data = command.data;
  const price = (data.price * data.gift_num) / 1000;
  console.log(`[礼物事件] ${data.uname}: ${data.gift_name} ${data.gift_num}个 <¥${price}>`);
  events.push({
    type: 2,
    name: data.uname,
    uId: data.uid,
    msg: data.gift_name,
    price: data.paid ? price : -price,
    num: data.gift_num,
    time: data.timestamp,
    guard_level: data.guard_level,
    fans_medal_level: data.fans_medal_level,
    fans_medal_name: data.fans_medal_name,
    fans_medal_wearing_status: data.fans_medal_wearing_status,
  });
}
function OnLike(command) {
  const data = command.data;
  console.log(`[点赞事件] ${data.uname}: ${data.like_count}`);
  events.push({
    type: 4,
    name: data.uname,
    uId: data.uid,
    msg: data.like_text,
    price: 0,
    num: data.like_count,
    time: data.timestamp,
    guard_level: data.guard_level,
    fans_medal_level: data.fans_medal_level,
    fans_medal_name: data.fans_medal_name,
    fans_medal_wearing_status: data.fans_medal_wearing_status,
  });
}
function OnSCDel(command) {
  const data = command.data;
  console.log(`[sc删除事件] ${data.message_ids}`);
  events.push({
    type: 5,
    msg: data.message_ids.join(','),
  });
}
const CMD_CALLBACK_MAP = {
  LIVE_OPEN_PLATFORM_DM: OnMessage,
  LIVE_OPEN_PLATFORM_SEND_GIFT: OnGift,
  LIVE_OPEN_PLATFORM_GUARD: OnGuard,
  LIVE_OPEN_PLATFORM_SUPER_CHAT: OnSC,
  LIVE_OPEN_PLATFORM_SUPER_CHAT_DEL: OnSCDel,
  LIVE_OPEN_PLATFORM_LIKE: OnLike,
};
