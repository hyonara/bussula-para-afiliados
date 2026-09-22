const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const http = require("http");
const path = require("path");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

// Diretório para armazenar credenciais
const authDir = path.join(__dirname, "baileys_auth");

// Criar diretório se não existir
if (!fs.existsSync(authDir)) {
  fs.mkdirSync(authDir, { recursive: true });
}

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Bússola para Afiliados está online");
});

// Iniciar servidor HTTP
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP rodando na porta ${PORT}`);
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

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("📱 QR Code gerado. Leia-o com seu WhatsApp para autenticar.");
      }

      if (connection === "open") {
        console.log("✅ WhatsApp conectado com sucesso!");
      } else if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== 401;
        console.log(
          `❌ Desconectado do WhatsApp. Reconectando: ${shouldReconnect}`
        );
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

