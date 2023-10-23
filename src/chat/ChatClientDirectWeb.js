import axios from 'axios';

import ChatClientOfficialBase from './ChatClientOfficialBase/index.js';

export default class ChatClientDirectWeb extends ChatClientOfficialBase {
  constructor(roomId, auth) {
    super();
    this.CMD_CALLBACK_MAP = {};
    this.auth = auth;

    // 调用initRoom后初始化，如果失败，使用这里的默认值
    this.roomId = roomId;
    this.roomOwnerUid = -1;
    this.hostServerList = [{ host: 'broadcastlv.chat.bilibili.com', port: 2243, wss_port: 443, ws_port: 2244 }];
  }

  async initRoom() {
    let res;
    try {
      res = (
        await axios.get('https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo', {
          params: {
            id: this.roomId,
          },
          headers: this.auth
            ? {
                Cookie: this.auth.cookie,
              }
            : null,
        })
      ).data;
    } catch (err) {
      console.log(err);
      return true;
    }
    if (res.code == 0) {
      this.token = res.data.token;
      if (res.data.host_list.length !== 0) {
        this.hostServerList = res.data.host_list;
      }
    }
    return true;
  }

  async onBeforeWsConnect() {
    // 重连次数太多则重新init_room，保险
    let reinitPeriod = Math.max(3, (this.hostServerList || []).length);
    if (this.retryCount > 0 && this.retryCount % reinitPeriod === 0) {
      this.needInitRoom = true;
    }
    return super.onBeforeWsConnect();
  }

  getWsUrl() {
    let hostServer = this.hostServerList[this.retryCount % this.hostServerList.length];
    return `wss://${hostServer.host}:${hostServer.wss_port}/sub`;
  }

  sendAuth() {
    let authParams;
    if (this.auth) {
      authParams = {
        roomid: this.roomId,
        uid: this.auth?.uid ? this.auth.uid : 0,
        protover: 3,
        key: this.token,
        platform: 'web',
        type: 2,
      };
    } else {
      authParams = {
        roomid: this.roomId,
        key: this.token,
      };
    }
    this.websocket.send(this.makePacket(authParams, 7));
  }
}
