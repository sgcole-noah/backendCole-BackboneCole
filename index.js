require("dotenv").config();
const express = require("express");
const Console = require("./ConsoleUtils");
const CryptoUtils = require("./CryptoUtils");
const cors = require('cors');
const SharedUtils = require("./SharedUtils");
const BotManager = require("./BotManager");
const TournamentManager = require("./TournamentManager");
const { checkMaintenance } = require("./MaintenanceMiddleware");

const {
  BackendUtils,
  UserModel,
  UserController,
  RoundController,
  BattlePassController,
  EconomyController,
  AnalyticsController,
  FriendsController,
  NewsController,
  MissionsController,
  TournamentXController,
  MatchmakingController,
  TournamentController,
  SocialController,
  EventsController,
  authenticate,
  errorControll,
  sendShared,
  OnlineCheck,
  VerifyPhoton
} = require("./BackendUtils");

const app = express();
const Title = "Stumble Born Backend " + process.env.version;
const PORT = process.env.PORT || 80;

app.use(express.json());
app.use(checkMaintenance);

// ===== ROTAS DO SISTEMA DE TORNEIOS (SEM AUTENTICAÇÃO) =====

// Servir página de torneios
app.get('/torneios-preview', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(__dirname + '/public/torneios-preview/index.html');
});

// Servir arquivos estáticos da pasta torneios-preview
app.use('/torneios-preview', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}, express.static('public/torneios-preview'));

// Buscar usuário por ID do MongoDB
app.get('/tournament/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return res.json({ success: false, error: 'Usuário não encontrado' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        deviceId: user.deviceId,
        stumbleId: user.stumbleId
      }
    });
  } catch (err) {
    Console.error('Tournament', `Erro ao buscar usuário: ${err.message}`);
    res.status(500).json({ success: false, error: 'Erro ao buscar usuário' });
  }
});

// Vincular ID do jogo com o site
app.post('/tournament/link', (req, res) => {
  try {
    const { userId, deviceId, username } = req.body;
    
    if (!userId || !deviceId || !username) {
      return res.status(400).json({ error: 'Campos obrigatórios: userId, deviceId, username' });
    }

    TournamentManager.linkPlayer(userId, deviceId, username);
    res.json({ success: true, message: 'ID vinculado com sucesso!' });
  } catch (err) {
    Console.error('Tournament', `Erro ao vincular: ${err.message}`);
    res.status(500).json({ error: 'Erro ao vincular ID' });
  }
});

// Verificar se ID está vinculado (por userId)
app.get('/tournament/link/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const link = TournamentManager.getPlayerLinkByUserId(userId);
    
    if (!link) {
      return res.json({ linked: false });
    }

    res.json({ linked: true, ...link });
  } catch (err) {
    Console.error('Tournament', `Erro ao verificar link: ${err.message}`);
    res.status(500).json({ error: 'Erro ao verificar link' });
  }
});

// Verificar se ID está vinculado
app.get('/tournament/link/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const link = TournamentManager.getPlayerLink(deviceId);
    
    if (!link) {
      return res.json({ linked: false });
    }

    res.json({ linked: true, ...link });
  } catch (err) {
    Console.error('Tournament', `Erro ao verificar link: ${err.message}`);
    res.status(500).json({ error: 'Erro ao verificar link' });
  }
});

// Listar torneios ativos
app.get('/tournament/active', (req, res) => {
  try {
    const tournaments = TournamentManager.getActiveTournaments();
    res.json({ success: true, tournaments });
  } catch (err) {
    Console.error('Tournament', `Erro ao listar torneios: ${err.message}`);
    res.status(500).json({ error: 'Erro ao listar torneios' });
  }
});

// Listar todos os torneios
app.get('/tournament/all', (req, res) => {
  try {
    const tournaments = TournamentManager.getAllTournaments();
    res.json({ success: true, tournaments });
  } catch (err) {
    Console.error('Tournament', `Erro ao listar torneios: ${err.message}`);
    res.status(500).json({ error: 'Erro ao listar torneios' });
  }
});

// Obter detalhes de um torneio
app.get('/tournament/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tournament = TournamentManager.getTournament(id);
    
    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' });
    }

    res.json({ success: true, tournament });
  } catch (err) {
    Console.error('Tournament', `Erro ao buscar torneio: ${err.message}`);
    res.status(500).json({ error: 'Erro ao buscar torneio' });
  }
});

// Inscrever jogador em torneio
app.post('/tournament/:id/register', (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId é obrigatório' });
    }

    const result = TournamentManager.registerPlayer(id, userId);
    
    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    Console.error('Tournament', `Erro ao registrar jogador: ${err.message}`);
    res.status(500).json({ error: 'Erro ao registrar jogador' });
  }
});

// Reportar vencedor de uma partida
app.post('/tournament/:tournamentId/match/:matchId/winner', (req, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { winnerDeviceId } = req.body;
    
    if (!winnerDeviceId) {
      return res.status(400).json({ error: 'winnerDeviceId é obrigatório' });
    }

    const result = TournamentManager.reportWinner(tournamentId, matchId, winnerDeviceId);
    
    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    Console.error('Tournament', `Erro ao reportar vencedor: ${err.message}`);
    res.status(500).json({ error: 'Erro ao reportar vencedor' });
  }
});

// Obter partidas de um jogador
app.get('/tournament/player/:userId/matches', (req, res) => {
  try {
    const { userId } = req.params;
    const matches = TournamentManager.getPlayerMatches(userId);
    res.json({ success: true, matches });
  } catch (err) {
    Console.error('Tournament', `Erro ao buscar partidas: ${err.message}`);
    res.status(500).json({ error: 'Erro ao buscar partidas' });
  }
});

// ===== ROTAS COM AUTENTICAÇÃO =====
app.use(authenticate);

class CrownController {
  static async updateScore(req, res) {
    try {
      const { deviceid, username, country } = req.body;
      if (!deviceid || !username) {
        return res.status(400).json({ error: "Missing fields" });
      }

      let user = await UserModel.findByDeviceId(deviceid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const newCrowns = (user.crowns || 0) + 1;
      await UserModel.update(user.stumbleId, { crowns: newCrowns });

      res.json({ success: true, crowns: newCrowns });
    } catch (err) {
      console.error("Error updating crowns:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async list(req, res) {
    try {
      const { country, start, count } = req.query;

      const data = await UserModel.GetHighscore(
        "crowns",
        country || "",
        start || 0,
        count || 50
      );

      res.json(data);
    } catch (err) {
      console.error("Error fetching crown highscores:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

app.post("/photon/auth", VerifyPhoton);
app.get("/onlinecheck", OnlineCheck);

app.get("/matchmaking/filter", MatchmakingController.getMatchmakingFilter);

app.post('/user/login', async (req, res) => {
  // Salvar a função send original
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Sobrescrever res.json para interceptar a resposta
  res.json = function(data) {
    // Restaurar as funções originais
    res.send = originalSend;
    res.json = originalJson;
    
    // Se a resposta foi bem-sucedida e contém dados do usuário, registrar cliente
    if (res.statusCode === 200 && data && data.User) {
      try {
        const { DeviceId, StumbleId } = req.body;
        const user = data.User;
        
        // Registrar com múltiplos IDs para permitir kick por qualquer um deles
        const ids = [
          DeviceId,                    // DeviceId
          user.id?.toString(),         // ID numérico do MongoDB
          user.stumbleId,              // StumbleId
          StumbleId                    // StumbleId do request
        ].filter(id => id); // Remove valores undefined/null
        
        const clientInfo = {
          connectedAt: new Date(),
          deviceId: DeviceId,
          stumbleId: user.stumbleId,
          userId: user.id,
          username: user.username,
          autoRegistered: true
        };
        
        // Registrar com todos os IDs possíveis
        ids.forEach(id => {
          BotManager.registerClient(id, clientInfo);
        });
        
        Console.log('AutoRegister', `Cliente registrado com múltiplos IDs:`);
        Console.log('AutoRegister', `  - DeviceId: ${DeviceId}`);
        Console.log('AutoRegister', `  - User ID: ${user.id}`);
        Console.log('AutoRegister', `  - StumbleId: ${user.stumbleId}`);
        Console.log('AutoRegister', `  - Username: ${user.username}`);
      } catch (err) {
        Console.log('AutoRegister', `Erro ao registrar automaticamente: ${err.message}`);
      }
    }
    
    // Enviar a resposta original
    return originalJson.call(this, data);
  };
  
  // Executar o login normal
  await UserController.login(req, res);
});
app.get('/user/config', sendShared);
app.get('/usersettings', UserController.getSettings);
app.post('/user/updateusername', UserController.updateUsername);

// Rota para atualização automática de username (sem validação extra)
app.post('/user/update-username', async (req, res) => {
  try {
    const { userId, newUsername } = req.body;
    
    if (!userId || !newUsername) {
      return res.status(400).json({ success: false, error: 'userId e newUsername são obrigatórios' });
    }
    
    // Atualizar no MongoDB
    const user = await UserModel.findByIdAndUpdate(
      userId,
      { username: newUsername },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    
    Console.log('Username', `Username atualizado: ${userId} -> ${newUsername}`);
    res.json({ success: true, username: newUsername });
  } catch (err) {
    Console.error('Username', `Erro ao atualizar: ${err.message}`);
    res.status(500).json({ success: false, error: 'Erro ao atualizar username' });
  }
});

app.get('/user/deleteaccount', UserController.deleteAccount);
app.post('/user/linkplatform', UserController.linkPlatform);
app.post('/user/unlinkplatform', UserController.unlinkPlatform);
app.get("/shared/:version/:type", sendShared);
app.post('/user/profile', UserController.getProfile);
app.post('/user-equipped-cosmetics/update', UserController.updateCosmetics);
app.post('/user/cosmetics/addskin', UserController.addSkin);
app.post('/user/cosmetics/setequipped', UserController.setEquippedCosmetic);

// Endpoints para gerenciamento de clientes conectados
app.post('/client/register', (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    Console.log('Register', `Requisição recebida - userId: ${userId}, deviceId: ${deviceId}`);
    
    if (!userId && !deviceId) {
      Console.log('Register', 'Erro: userId ou deviceId não fornecido');
      return res.status(400).json({ error: 'userId or deviceId required' });
    }
    
    const clientId = userId || deviceId;
    BotManager.registerClient(clientId, { 
      connectedAt: new Date(),
      deviceId: deviceId,
      userId: userId
    });
    
    Console.log('Register', `Cliente ${clientId} registrado com sucesso`);
    res.json({ success: true, message: 'Client registered', clientId: clientId });
  } catch (err) {
    Console.error('Register', `Erro ao registrar: ${err.message}`);
    res.status(500).json({ error: 'Failed to register client' });
  }
});

app.post('/client/unregister', (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    const clientId = userId || deviceId;
    
    BotManager.unregisterClient(clientId);
    res.json({ success: true, message: 'Client unregistered' });
  } catch (err) {
    Console.error('Unregister', `Erro: ${err.message}`);
    res.status(500).json({ error: 'Failed to unregister client' });
  }
});

app.get('/client/list', (req, res) => {
  try {
    const clients = BotManager.getConnectedClients();
    res.json({ 
      success: true, 
      count: clients.length,
      clients: clients 
    });
  } catch (err) {
    Console.error('ClientList', `Erro: ${err.message}`);
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

app.get('/client/kick/check/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    const shouldKick = BotManager.isKicked(userId);
    
    res.json({
      success: true,
      userId: userId,
      shouldKick: shouldKick
    });
  } catch (err) {
    Console.error('KickCheck', `Erro: ${err.message}`);
    res.status(500).json({ error: 'Failed to check kick status' });
  }
});

app.get('/round/finish/:round', RoundController.finishRound);
app.get('/round/finishv2/:round', RoundController.finishRound);
app.post('/round/finish/v4/:round', RoundController.finishRoundV4);
app.post('/round/eventfinish/v4/:round', RoundController.finishRoundV4);

app.get('/battlepass', BattlePassController.getBattlePass);
app.post('/battlepass/claimv3', BattlePassController.claimReward);
app.post('/battlepass/purchase', BattlePassController.purchaseBattlePass);
app.post('/battlepass/complete', BattlePassController.completeBattlePass);

app.get('/economy/purchase/:item', EconomyController.purchase); 
app.get('/economy/purchasegasha/:itemId/:count', EconomyController.purchaseGasha); 
app.get('/economy/purchaseluckyspin', EconomyController.purchaseLuckySpin); 
app.get('/economy/purchasedrop/:itemId/:count', EconomyController.purchaseLuckySpin); 
app.post('/economy/:currencyType/give/:amount', EconomyController.giveCurrency); 

app.get('/missions', MissionsController.getMissions);
app.post('/missions/:missionId/rewards/claim/v2', MissionsController.claimMissionReward);
app.post('/missions/objective/:objectiveId/:milestoneId/rewards/claim/v2', MissionsController.claimMilestoneReward);

app.post('/friends/request/accept', FriendsController.add);
app.delete('/friends/:UserId', FriendsController.remove);
app.get('/friends', FriendsController.list);
app.post('/friends/search', FriendsController.search);
app.post('/friends/request', FriendsController.request);
app.post('/friends/accept', FriendsController.accept);
app.post('/friends/request/decline', FriendsController.reject);
app.post('/friends/cancel', FriendsController.cancel);
app.get('/friends/request', FriendsController.pending);

app.get("/game-events/me", EventsController.getActive);

app.get("/news/getall", NewsController.GetNews);

app.post('/analytics', AnalyticsController.analytic);

app.post("/update-crown-score", CrownController.updateScore);
app.get("/highscore/crowns/list", CrownController.list);

app.get('/highscore/:type/list/', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { start = 0, count = 100, country = 'global' } = req.query;

    const startNum = parseInt(start, 10);
    const countNum = parseInt(count, 10);

    if (!type) {
      return res.status(400).json({ error: "O tipo é necessário" });
    }

    if (isNaN(startNum) || isNaN(countNum)) {
      return res.status(400).json({ error: "Os parâmetros start e count devem ser números" });
    }

    const result = await UserModel.GetHighscore(type, country, startNum, countNum);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

app.get("/social/interactions", SocialController.getInteractions);

app.get("/tournamentx/active", TournamentXController.getActive.bind(TournamentXController));
app.get("/tournamentx/active/v2", TournamentXController.getActive.bind(TournamentXController));
app.post("/tournamentx/:tournamentId/join/v2", TournamentXController.join.bind(TournamentXController));
app.post("/tournamentx/:tournamentId/leave", TournamentXController.leave.bind(TournamentXController));
app.post("/tournamentx/:tournamentId/finish", TournamentXController.finish.bind(TournamentXController));

app.get("/api/v1/ping", async (req, res) => {
  res.status(200).send("OK");
});
app.post("/api/v1/userLoginExternal", TournamentController.login);
app.get("/api/v1/tournaments", TournamentController.getActive);


// ===== ROTAS DE ADMINISTRAÇÃO =====
const UserIdCounter = require('./UserIdCounter');

// ===== ROTAS DE ADMINISTRAÇÃO - USER ID COUNTER =====

// Ver contador atual
app.get('/admin/userid/current', (req, res) => {
  try {
    const currentId = UserIdCounter.getCurrentId();
    res.json({
      success: true,
      currentId: currentId,
      message: `Próximo usuário receberá o ID ${currentId}`
    });
  } catch (err) {
    Console.error('Admin', `Erro ao obter ID atual: ${err.message}`);
    res.status(500).json({ error: 'Failed to get current ID' });
  }
});

// Definir próximo ID manualmente
app.post('/admin/userid/set', (req, res) => {
  try {
    const { nextId } = req.body;
    
    if (!nextId || isNaN(nextId)) {
      return res.status(400).json({ error: 'nextId (number) required' });
    }
    
    const success = UserIdCounter.setNextId(parseInt(nextId));
    
    if (!success) {
      return res.status(400).json({ error: 'ID must be >= 500' });
    }
    
    Console.log('Admin', `Próximo ID definido para ${nextId}`);
    
    res.json({
      success: true,
      message: `Next user ID set to ${nextId}`,
      nextId: parseInt(nextId)
    });
  } catch (err) {
    Console.error('Admin', `Erro ao definir ID: ${err.message}`);
    res.status(500).json({ error: 'Failed to set next ID' });
  }
});

// Resetar contador (apenas para testes!)
app.post('/admin/userid/reset', (req, res) => {
  try {
    UserIdCounter.reset();
    
    Console.warn('Admin', 'Contador de IDs resetado para 500!');
    
    res.json({
      success: true,
      message: 'User ID counter reset to 500',
      warning: 'This should only be used for testing!'
    });
  } catch (err) {
    Console.error('Admin', `Erro ao resetar contador: ${err.message}`);
    res.status(500).json({ error: 'Failed to reset counter' });
  }
});


app.use(errorControll);

app.listen(PORT, async () => {
  const currentDate = new Date().toLocaleString().replace(",", " |");
  console.clear();
  Console.log(
    "Server",
    `[${Title}] | ${currentDate} | ${CryptoUtils.SessionToken()}`
  );
  Console.log("Server", `Listening on port ${PORT}`);
  
  // Inicializar o bot Discord
  if (process.env.DISCORD_TOKEN && process.env.DISCORD_CLIENT_ID) {
    await BotManager.initialize();
  } else {
    Console.log("Bot", "Token do Discord não configurado. Bot não será iniciado.");
  }
});
