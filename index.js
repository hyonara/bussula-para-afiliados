const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const http = require("http");
const url = require("url");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const PORT = process.env.PORT || 3000;
const BAILEYS_API_KEY = process.env.BAILEYS_API_KEY || null;

// Diretório para armazenar credenciais
const authDir = path.join(__dirname, "baileys_auth");

// Variáveis globais
let currentQRCode = null;
let whatsappConnected = false;
let socket = null;
let messages = []; // Armazenar mensagens recebidas

// Criar diretório se não existir
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Função para validar API Key
function validateAPIKey(req) {
  if (!BAILEYS_API_KEY) {
    return false;
  }
  
  const authHeader = req.headers.authorization || "";
  const apiKeyFromHeader = authHeader.replace("Bearer ", "").trim();
  
  return apiKeyFromHeader === BAILEYS_API_KEY;
}

// Função para gerar QR Code em imagem Data URL
async function generateQRImage(text) {
  try {
    const qrDataUrl = await QRCode.toDataURL(text, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return qrDataUrl;
  } catch (error) {
    console.error("Erro ao gerar QR Code:", error.message);
    return null;
  }
}

// Função para enviar resposta JSON
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

// Criar página HTML
const htmlPage = (qrImage, connected) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bússola para Afiliados - WhatsApp Bot</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px 30px;
      max-width: 500px;
      text-align: center;
      animation: slideUp 0.5s ease-out;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }
    
    .compass-icon {
      font-size: 40px;
      margin-bottom: 15px;
    }
    
    .subtitle {
      color: #666;
      font-size: 14px;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    
    .status {
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 30px;
      font-weight: 600;
      font-size: 16px;
    }
    
    .status.connected {
      background: #d4edda;
      color: #155724;
      border: 2px solid #28a745;
    }
    
    .status.waiting {
      background: #fff3cd;
      color: #856404;
      border: 2px solid #ffc107;
    }
    
    .qr-container {
      background: #f8f9fa;
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 350px;
    }
    
    .qr-container img {
      max-width: 100%;
      height: auto;
      border-radius: 10px;
    }
    
    .qr-container.empty {
      color: #999;
      font-size: 16px;
    }
    
    .instruction {
      background: #e7f3ff;
      color: #004085;
      padding: 15px;
      border-radius: 10px;
      border-left: 4px solid #0066cc;
      text-align: left;
      font-size: 14px;
      line-height: 1.6;
    }
    
    .instruction strong {
      display: block;
      margin-bottom: 8px;
      font-size: 16px;
    }
    
    .instruction ol {
      margin-left: 20px;
    }
    
    .instruction li {
      margin-bottom: 8px;
    }
    
    .refresh-button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      transition: background 0.3s ease;
    }
    
    .refresh-button:hover {
      background: #764ba2;
    }
    
    .footer {
      margin-top: 20px;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="compass-icon">🧭</div>
    <h1>Bússola para Afiliados</h1>
    <p class="subtitle">WhatsApp Bot de Autenticação</p>
    
    <div class="status ${connected ? 'connected' : 'waiting'}">
      ${connected ? '✅ WhatsApp Conectado' : '⏳ Aguardando Autenticação'}
    </div>
    
    ${!connected ? \`
      <div class="qr-container \${!qrImage ? 'empty' : ''}">
        \${qrImage ? \`<img src="\${qrImage}" alt="QR Code">\` : '<p>Gerando QR Code...</p>'}
      </div>
      
      <div class="instruction">
        <strong>Como conectar seu WhatsApp:</strong>
        <ol>
          <li>Abra o WhatsApp no seu celular</li>
          <li>Vá para <strong>Configurações → Dispositivos conectados</strong></li>
          <li>Clique em <strong>Conectar um dispositivo</strong></li>
          <li>Aponte a câmera para o QR Code acima</li>
          <li>Aguarde a conexão ser estabelecida</li>
        </ol>
      </div>
      
      <button class="refresh-button" onclick="location.reload()">🔄 Atualizar QR Code</button>
    \` : \`
      <div style="padding: 40px; color: #28a745; font-size: 18px;">
        <p>Seu WhatsApp está conectado e pronto para usar! 🎉</p>
        <p style="font-size: 14px; color: #666; margin-top: 15px;">
          O bot está rodando e pode receber mensagens.
        </p>
      </div>
    \`}
    
    <div class="footer">
      Bússola para Afiliados © 2026
    </div>
  </div>
</body>
</html>
`;

// Criar servidor HTTP
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Rota: GET / - Página web com QR Code
  if (pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(htmlPage(currentQRCode, whatsappConnected));
    return;
  }

  // Rota: GET /api/status - Status da conexão (sem autenticação para monitoramento)
  if (pathname === "/api/status" && req.method === "GET") {
    sendJSON(res, 200, {
      connected: whatsappConnected,
      hasQR: currentQRCode !== null,
      qrCode: whatsappConnected ? null : currentQRCode,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // === ROTAS PROTEGIDAS POR API KEY ===
  if (!validateAPIKey(req)) {
    sendJSON(res, 401, {
      error: "Unauthorized",
      message: "API Key inválida ou não fornecida",
      detail: "Envie a chave via header: Authorization: Bearer SUA_API_KEY",
    });
    return;
  }

  // Rota: POST /api/messages/send - Enviar mensagem
  if (pathname === "/api/messages/send" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        const { to, message } = data;

        if (!to || !message) {
          sendJSON(res, 400, {
            error: "Bad Request",
            message: "Campos 'to' (número) e 'message' (texto) são obrigatórios",
          });
          return;
        }

        if (!whatsappConnected || !socket) {
          sendJSON(res, 503, {
            error: "Service Unavailable",
            message: "WhatsApp não está conectado",
          });
          return;
        }

        // Formatar número para WhatsApp (adicionar @s.whatsapp.net se necessário)
        const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;

        // Enviar mensagem
        const result = await socket.sendMessage(jid, { text: message });

        sendJSON(res, 200, {
          success: true,
          message: "Mensagem enviada com sucesso",
          messageId: result.key.id,
          to: to,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        sendJSON(res, 500, {
          error: "Internal Server Error",
          message: error.message,
        });
      }
    });
    return;
  }

  // Rota: GET /api/messages - Listar mensagens recebidas
  if (pathname === "/api/messages" && req.method === "GET") {
    const limit = parseInt(query.limit) || 50;
    const offset = parseInt(query.offset) || 0;
    const from = query.from || null;

    let filtered = messages;
    if (from) {
      filtered = messages.filter((m) => m.from === from);
    }

    const paginated = filtered.slice(offset, offset + limit);

    sendJSON(res, 200, {
      success: true,
      total: filtered.length,
      returned: paginated.length,
      limit: limit,
      offset: offset,
      messages: paginated,
    });
    return;
  }

  // Rota: GET /api/chats - Listar conversas (contatos com histórico)
  if (pathname === "/api/chats" && req.method === "GET") {
    if (!whatsappConnected || !socket) {
      sendJSON(res, 503, {
        error: "Service Unavailable",
        message: "WhatsApp não está conectado",
      });
      return;
    }

    try {
      // Agrupar mensagens por contato
      const chatMap = {};
      messages.forEach((msg) => {
        const key = msg.from || msg.to;
        if (!chatMap[key]) {
          chatMap[key] = {
            jid: key,
            name: msg.fromName || msg.toName || key,
            lastMessage: msg.message,
            lastMessageTime: msg.timestamp,
            messageCount: 0,
          };
        }
        chatMap[key].messageCount += 1;
      });

      const chats = Object.values(chatMap);

      sendJSON(res, 200, {
        success: true,
        chatCount: chats.length,
        chats: chats,
      });
    } catch (error) {
      console.error("Erro ao listar chats:", error);
      sendJSON(res, 500, {
        error: "Internal Server Error",
        message: error.message,
      });
    }
    return;
  }

  // Rota: GET /api/session - Informações da sessão atual
  if (pathname === "/api/session" && req.method === "GET") {
    sendJSON(res, 200, {
      success: true,
      connected: whatsappConnected,
      hasQR: currentQRCode !== null,
      totalMessagesReceived: messages.length,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Rota: POST /api/disconnect - Desconectar WhatsApp
  if (pathname === "/api/disconnect" && req.method === "POST") {
    if (!whatsappConnected || !socket) {
      sendJSON(res, 400, {
        error: "Bad Request",
        message: "WhatsApp já está desconectado",
      });
      return;
    }

    try {
      socket.logout();
      whatsappConnected = false;
      currentQRCode = null;

      sendJSON(res, 200, {
        success: true,
        message: "WhatsApp desconectado",
      });
    } catch (error) {
      console.error("Erro ao desconectar:", error);
      sendJSON(res, 500, {
        error: "Internal Server Error",
        message: error.message,
      });
    }
    return;
  }

  // 404 - Rota não encontrada
  sendJSON(res, 404, {
    error: "Not Found",
    message: "Rota não encontrada",
    availableRoutes: {
      public: ["GET /", "GET /api/status"],
      protected: [
        "POST /api/messages/send",
        "GET /api/messages",
        "GET /api/chats",
        "GET /api/session",
        "POST /api/disconnect",
      ],
    },
  });
});

// Iniciar servidor HTTP
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
  console.log(`📱 Acesse http://localhost:${PORT} para ver o QR Code`);
  if (BAILEYS_API_KEY) {
    console.log(`🔐 API Key configurada e ativa para operações`);
  } else {
    console.log(`⚠️  Aviso: BAILEYS_API_KEY não configurada. Endpoints protegidos não funcionarão.`);
  }
});

// Função para iniciar o bot do WhatsApp
async function startBot() {
  try {
    // Usar persistência de autenticação
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false, // Desabilitar para usar na web
    });

    // Salvar credenciais quando atualizar
    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("📱 QR Code gerado. Escaneie na página web.");
        // Gerar imagem do QR Code e armazenar em memória
        currentQRCode = await generateQRImage(qr);
        whatsappConnected = false;
      }

      if (connection === "open") {
        console.log("✅ WhatsApp conectado com sucesso!");
        whatsappConnected = true;
        currentQRCode = null; // Limpar QR quando conectado
      } else if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== 401;
        console.log(
          `❌ Desconectado do WhatsApp. Reconectando: ${shouldReconnect}`
        );
        whatsappConnected = false;
        if (shouldReconnect) {
          setTimeout(() => startBot(), 5000);
        }
      }
    });

    // Listener para mensagens recebidas
    socket.ev.on("messages.upsert", async (m) => {
      const msg = m.messages[0];
      if (!msg.key.fromMe) {
        // Apenas mensagens recebidas
        const messageData = {
          id: msg.key.id,
          from: msg.key.remoteJid,
          fromName: msg.pushName || "Unknown",
          message: msg.message?.conversation || msg.message?.extendedTextMessage?.text || "[Arquivo/Mídia]",
          timestamp: new Date(msg.messageTimestamp * 1000).toISOString(),
          type: msg.type || "message",
        };
        messages.push(messageData);
        console.log("📨 Nova mensagem recebida de:", msg.key.remoteJid);
      }
    });
  } catch (error) {
    console.error("❌ Erro ao iniciar bot:", error.message);
    setTimeout(() => startBot(), 5000);
  }
}

// Iniciar o bot
startBot();

// Manter o processo ativo
process.on("SIGINT", () => {
  console.log("\n👋 Encerrando aplicação...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n👋 Encerrando aplicação...");
  server.close(() => {
    process.exit(0);
  });
});

