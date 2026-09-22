const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const http = require("http");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");

const PORT = process.env.PORT || 3000;

// Diretório para armazenar credenciais
const authDir = path.join(__dirname, "baileys_auth");

// Variáveis globais
let currentQRCode = null;
let whatsappConnected = false;

// Criar diretório se não existir
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
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
    
    ${!connected ? `
      <div class="qr-container ${!qrImage ? 'empty' : ''}">
        ${qrImage ? `<img src="${qrImage}" alt="QR Code">` : '<p>Gerando QR Code...</p>'}
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
    ` : `
      <div style="padding: 40px; color: #28a745; font-size: 18px;">
        <p>Seu WhatsApp está conectado e pronto para usar! 🎉</p>
        <p style="font-size: 14px; color: #666; margin-top: 15px;">
          O bot está rodando e pode receber mensagens.
        </p>
      </div>
    `}
    
    <div class="footer">
      Bússola para Afiliados © 2026
    </div>
  </div>
</body>
</html>
`;

// Criar servidor HTTP
const server = http.createServer(async (req, res) => {
  // Rota para a página principal
  if (req.url === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(htmlPage(currentQRCode, whatsappConnected));
  }
  // Rota para status em JSON (opcional, para outros usos)
  else if (req.url === "/status" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        connected: whatsappConnected,
        hasQR: currentQRCode !== null,
      })
    );
  }
  // Outras requisições
  else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Página não encontrada");
  }
});

// Iniciar servidor HTTP
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
  console.log(`📱 Acesse http://localhost:${PORT} para ver o QR Code`);
});

// Função para iniciar o bot do WhatsApp
async function startBot() {
  try {
    // Usar persistência de autenticação
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    // Salvar credenciais quando atualizar
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
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

    sock.ev.on("messages.upsert", async (m) => {
      console.log("📨 Nova mensagem recebida de:", m.messages[0]?.key?.remoteJid);
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

