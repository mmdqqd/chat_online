<template>
  <div class="chat-container">
    <!-- 用户信息区 -->
    <div class="user-info" v-if="user">
      欢迎：{{ user.username }}
      <el-button size="small" @click="logout">匿名模式</el-button>
      <el-button size="small" type="danger" @click="exitChat">退出聊天室</el-button>
    </div>

    <!-- 主聊天区 -->
    <div class="chat-main">
      <!-- 在线用户列表 -->
      <div class="user-list">
        <h3>在线用户 ({{ users.length }})</h3>
        <div v-for="user in users" :key="user.userId" class="user-item">
          {{ user.username }}
        </div>
      </div>

      <!-- 聊天消息区 -->
      <div class="message-area">
        <div ref="messagesEnd" class="messages">
          <!-- 系统消息 -->
          <div v-for="msg in systemMessages" :key="msg.timestamp" class="system-message">
            [系统] {{ msg.content }} - {{ formatTime(msg.timestamp) }}
          </div>

          <!-- 用户消息 -->
          <div v-for="msg in messages" :key="msg.id" class="message" :class="{ own: msg.userId === user.userId }">
            <div class="message-header">
              <span class="username">{{ msg.username }}</span>
              <span class="time">{{ formatTime(msg.timestamp) }}</span>
            </div>
            <div class="message-content">{{ msg.content }}</div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="input-area">
          <el-input
              v-model="inputMessage"
              placeholder="输入消息..."
              @keyup.enter="sendMessage"
              :disabled="!wsConnected"
          />
          <el-button
              type="primary"
              @click="sendMessage"
              :disabled="!inputMessage || !wsConnected"
          >
            发送
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      user: {
        userId: '',
        username: ''
      },
      ws: null,
      wsConnected: false,
      reconnectAttempts: 0,
      isExiting: false, // 新增：用于标记是否主动退出聊天室
      messages: [],
      systemMessages: [],
      users: [],
      inputMessage: ''
    };
  },
  created() {
    this.initUser();
    this.connectWebSocket();
  },
  beforeDestroy() {
    if (this.ws) {
      this.ws.close();
    }
  },
  methods: {
// 退出聊天
    exitChat() {
      if (this.ws) {
        this.ws.send(JSON.stringify({
          type: 'user-exit',
          userId: this.user.userId
        }));
        this.isExiting = true; // 设置标志，防止 WebSocket 重新连接
        this.ws.close(); // 关闭 WebSocket 连接
      }

// 跳转到 /news 页面
      this.$router.push('/reader');
    },
// 初始化用户
    initUser() {
      this.user.userId = sessionStorage.getItem('useruid') || this.generateUUID();

      let username = sessionStorage.getItem('username') || sessionStorage.getItem('adminName');

// 去除引号
      this.user.username = username.replace(/^"|"$/g, " ");  // 去除两端引号

      sessionStorage.setItem('useruid', this.user.userId);
      sessionStorage.setItem('username', this.user.username);
    },
// 生成UUID
    generateUUID() {
      return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },
    connectWebSocket() {
      this.ws = new WebSocket('ws://localhost:3000');

      this.ws.onopen = () => {
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.ws.send(JSON.stringify({
          type: 'user-join',
          user: {
            userId: this.user.userId,
            username: this.user.username
          }
        }));
      };

      this.ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        switch (data.type) {
          case 'new-message':
            this.messages.push(data.message);
            this.scrollToBottom();
            break;
          case 'user-list':
            this.users = data.users;
            break;
          case 'system-message':
            this.systemMessages.push(data.message);
            this.scrollToBottom();
            break;
        }
      };

      this.ws.onclose = () => {
        this.wsConnected = false;

        if (!this.isExiting && this.reconnectAttempts < 5) {
// 只有非主动退出时才重连
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connectWebSocket();
          }, 3000);
        }
      };
    },
// 发送消息
    sendMessage() {
      if (!this.inputMessage.trim()) return;

      this.ws.send(JSON.stringify({
        type: 'new-message',
        userId: this.user.userId,
        content: this.inputMessage.trim()
      }));

      this.inputMessage = '';
    },
// 退出登录
    logout() {
      localStorage.removeItem('useruid');
      localStorage.removeItem('username');
      window.location.reload();
    },
// 格式化时间
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },
// 滚动到底部
    scrollToBottom() {
      this.$nextTick(() => {
        const messagesEnd = this.$refs.messagesEnd;
        if (messagesEnd) {
          messagesEnd.scrollTop = messagesEnd.scrollHeight;
        }
      });
    }
  }
};
</script>

<style scoped>
.chat-container {
  max-width: 1200px;
  margin: 20px auto;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
}

.user-info {
  margin-bottom: 20px;
  padding: 10px;
  background: #fff;
  border-radius: 4px;
  text-align: right;
}

.chat-main {
  display: flex;
  gap: 20px;
}

.user-list {
  width: 200px;
  background: white;
  padding: 15px;
  border-radius: 4px;
}

.user-item {
  padding: 5px 0;
  border-bottom: 1px solid #eee;
}

.message-area {
  flex: 1;
  background: white;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}

.messages {
  flex: 1;
  padding: 15px;
  height: 500px;
  overflow-y: auto;
}

.message {
  margin: 10px 0;
  padding: 10px;
  background: #f8f8f8;
  border-radius: 4px;
}

.message.own {
  background: #e3f2fd;
  margin-left: 20%;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.9em;
  color: #666;
}

.system-message {
  color: #999;
  font-size: 0.9em;
  text-align: center;
  margin: 10px 0;
}

.input-area {
  display: flex;
  gap: 10px;
  padding: 15px;
  border-top: 1px solid #eee;
}
</style>