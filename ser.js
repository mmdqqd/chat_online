const WebSocket = require('ws')
const http = require('http')
const mysql = require('mysql2/promise')

// 数据库配置
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'chattest',
  waitForConnections: true,
  connectionLimit: 10
})

// 创建HTTP服务器
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('Chat Server is Running')
})

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server })

// 用户管理
const activeUsers = new Map()

// 消息处理
wss.on('connection', async (ws) => {
  let currentUser = null


  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data)
      switch (message.type) {
        case 'user-join':
          await handleUserJoin(ws, message.user)
          break
        case 'new-message':
          await handleNewMessage(message)
          break
          case 'user-exit': // 监听退出聊天室事件
        await handleUserExit(message.userId);
        break;
      }
    } catch (error) {
      console.error('消息处理错误:', error)
    }
  })

  // 连接关闭处理
  ws.on('close', async () => {
    if (currentUser) {
      activeUsers.delete(currentUser.userId)
      broadcastUserList()
      broadcastSystemMessage(`${currentUser.username} 已离开`)
    }
  })
})

async function handleUserJoin(ws, userData) {
  const connection = await pool.getConnection()
  try {
    // 保存用户到数据库
    await connection.query(
      'INSERT INTO users (user_id, username) VALUES (?, ?) ' +
      'ON DUPLICATE KEY UPDATE username = VALUES(username)',
      [userData.userId, userData.username]
    )

    // 添加到在线列表
    activeUsers.set(userData.userId, userData)
    currentUser = userData

    // 广播更新
    broadcastUserList()
    broadcastSystemMessage(`${userData.username} 已加入`)
  } finally {
    connection.release()
  }
}


async function handleUserExit(userId) {
  if (activeUsers.has(userId)) {
    const user = activeUsers.get(userId);
    activeUsers.delete(userId);

    broadcastUserList(); // 重新广播在线用户列表
    broadcastSystemMessage(`${user.username} 退出了聊天室`);
  }
}

async function handleNewMessage(message) {
  const connection = await pool.getConnection()
  try {
    // 保存消息到数据库
    await connection.query(
      'INSERT INTO messages (user_id, content) VALUES (?, ?)',
      [message.userId, message.content]
    )

    // 广播消息
    broadcast({
      type: 'new-message',
      message: {
        ...message,
        timestamp: Date.now()
      }
    })
  } finally {
    connection.release()
  }
}

// 广播工具函数
function broadcastUserList() {
  broadcast({
    type: 'user-list',
    users: Array.from(activeUsers.values())
  })
}

function broadcastSystemMessage(content) {
  broadcast({
    type: 'system-message',
    message: {
      content,
      timestamp: Date.now(),
      isSystem: true
    }
  })
}

function broadcast(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message))
    }
  })
}

// 启动服务器
server.listen(3000, () => {
  console.log('🚀 服务器已启动：')
  console.log('   - WebSocket: ws://localhost:3000')
  console.log('   - HTTP:      http://localhost:3000')
})










