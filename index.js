require("dotenv").config();
const express = require("express");
const cors = require('cors'); 
const Console = require("./ConsoleUtils");
const CryptoUtils = require("./CryptoUtils");
const SharedUtils = require("./SharedUtils");
const BotManager = require("./BotManager");
const TournamentManager = require("./TournamentManager");
const TourXManager = require("./TourXManager"); // Neu hinzugefügt
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

app.use(cors()); 
app.use(express.json());
app.use(checkMaintenance);

// ===== TOURX API ROUTEN (ÖFFENTLICH) =====
app.get("/tourx/status", (req, res) => {
  res.json(TourXManager.getActiveTourX());
});

app.get("/tourx/ranking", (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  res.json({ success: true, ranking: TourXManager.getRanking(limit) });
});

app.get("/tourx/matches", (req, res) => {
  res.json({ success: true, matches: TourXManager.getActiveMatches() });
});

// ===== DEINE ORIGINAL ROUTEN =====

app.get('/torneios-preview', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(__dirname + '/public/torneios-preview/index.html');
});

app.use('/torneios-preview', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}, express.static('public/torneios-preview'));

app.get('/tournament/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    if (!user) return res.json({ success: false, error: 'Usuário não encontrado' });
    res.json({
      success: true,
      user: { id: user.id, username: user.username, deviceId: user.deviceId, stumbleId: user.stumbleId }
    });
  } catch (err) {
    Console.error('Tournament', `Erro: ${err.message}`);
    res.status(500).json({ success: false, error: 'Erro ao buscar usuário' });
  }
});

app.post('/tournament/link', (req, res) => {
  try {
    const { userId, deviceId, username } = req.body;
    if (!userId || !deviceId || !username) return res.status(400).json({ error: 'Campos obrigatórios' });
    TournamentManager.linkPlayer(userId, deviceId, username);
    res.json({ success: true, message: 'ID vinculado com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao vincular ID' });
  }
});

app.get('/tournament/link/user/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const link = TournamentManager.getPlayerLinkByUserId(userId);
    if (!link) return res.json({ linked: false });
    res.json({ linked: true, ...link });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar link' });
  }
});

app.get('/tournament/link/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const link = TournamentManager.getPlayerLink(deviceId);
    if (!link) return res.json({ linked: false });
    res.json({ linked: true, ...link });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar link' });
  }
});

app.get('/tournament/active', (req, res) => {
  try {
    const tournaments = TournamentManager.getActiveTournaments();
    res.json({ success: true, tournaments });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar torneios' });
  }
});

app.get('/tournament/all', (req, res) => {
  try {
    const tournaments = TournamentManager.getAllTournaments();
    res.json({ success: true, tournaments });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar torneios' });
  }
});

app.get('/tournament/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tournament = TournamentManager.getTournament(id);
    if (!tournament) return res.status(404).json({ error: 'Torneio não encontrado' });
    res.json({ success: true, tournament });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar torneio' });
  }
});

app.post('/tournament/:id/register', (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId é obrigatório' });
    const result = TournamentManager.registerPlayer(id, userId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar jogador' });
  }
});

app.post('/tournament/:tournamentId/match/:matchId/winner', (req, res) => {
  try {
    const { tournamentId, matchId } = req.params;
    const { winnerDeviceId } = req.body;
    if (!winnerDeviceId) return res.status(400).json({ error: 'winnerDeviceId é obrigatório' });
    const result = TournamentManager.reportWinner(tournamentId, matchId, winnerDeviceId);
    if (result.error) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao reportar vencedor' });
  }
});

app.get('/tournament/player/:userId/matches', (req, res) => {
  try {
    const { userId } = req.params;
    const matches = TournamentManager.getPlayerMatches(userId);
    res.json({ success: true, matches });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar partidas' });
  }
});

app.use(authenticate);

class CrownController {
  static async updateScore(req, res) {
    try {
      const { deviceid, username, country } = req.body;
      if (!deviceid || !username) return res.status(400).json({ error: "Missing fields" });
      let user = await UserModel.findByDeviceId(deviceid);
      if (!user) return res.status(404).json({ error: "User not found" });
      const newCrowns = (user.crowns || 0) + 1;
      await UserModel.update(user.stumbleId, { crowns: newCrowns });
      res.json({ success: true, crowns: newCrowns });
    } catch (err) { res.status(500).json({ error: "Internal server error" }); }
  }
  static async list(req, res) {
    try {
      const { country, start, count } = req.query;
      const data = await UserModel.GetHighscore("crowns", country || "", start || 0, count || 50);
      res.json(data);
    } catch (err) { res.status(500).json({ error: "Internal server error" }); }
  }
}

app.post("/photon/auth", VerifyPhoton);
app.get("/onlinecheck", OnlineCheck);
app.get("/matchmaking/filter", MatchmakingController.getMatchmakingFilter);

app.post('/user/login', async (req, res) => {
  const originalJson = res.json;
  res.json = function(data) {
    if (res.statusCode === 200 && data && data.User) {
      try {
        const { DeviceId, StumbleId } = req.body;
        const user = data.User;

        // --- TOURX AUTO REGISTER START ---
        TourXManager.autoRegisterPlayer(user.id.toString(), user.username, user.stumbleId || StumbleId);
        // --- TOURX AUTO REGISTER END ---

        const ids = [DeviceId, user.id?.toString(), user.stumbleId, StumbleId].filter(id => id);
        ids.forEach(id => BotManager.registerClient(id, { deviceId: DeviceId, stumbleId: user.stumbleId, userId: user.id, username: user.username }));
      } catch (err) { Console.log('AutoRegister', err.message); }
    }
    return originalJson.call(this, data);
  };
  await UserController.login(req, res);
});

app.get('/user/config', sendShared);
app.get('/usersettings', UserController.getSettings);
app.post('/user/updateusername', UserController.updateUsername);

app.post('/user/update-username', async (req, res) => {
  try {
    const { userId, newUsername } = req.body;
    if (!userId || !newUsername) return res.status(400).json({ success: false, error: 'Campos obrigatórios' });
    const user = await UserModel.findByIdAndUpdate(userId, { username: newUsername }, { new: true });
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    res.json({ success: true, username: newUsername });
  } catch (err) { res.status(500).json({ success: false, error: 'Erro' }); }
});

app.get('/user/deleteaccount', UserController.deleteAccount);
app.post('/user/linkplatform', UserController.linkPlatform);
app.post('/user/unlinkplatform', UserController.unlinkPlatform);
app.get("/shared/:version/:type", sendShared);
app.post('/user/profile', UserController.getProfile);
app.post('/user-equipped-cosmetics/update', UserController.updateCosmetics);
app.post('/user/cosmetics/addskin', UserController.addSkin);
app.post('/user/cosmetics/setequipped', UserController.setEquippedCosmetic);

app.post('/client/register', (req, res) => {
  try {
    const { userId, deviceId } = req.body;
    const clientId = userId || deviceId;
    BotManager.registerClient(clientId, { connectedAt: new Date(), deviceId: deviceId, userId: userId });
    res.json({ success: true, clientId: clientId });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/client/unregister', (req, res) => {
  const clientId = req.body.userId || req.body.deviceId;
  BotManager.unregisterClient(clientId);
  res.json({ success: true });
});

app.get('/client/list', (req, res) => {
  res.json({ success: true, clients: BotManager.getConnectedClients() });
});

app.get('/client/kick/check/:userId', (req, res) => {
  res.json({ success: true, shouldKick: BotManager.isKicked(req.params.userId) });
});

app.get('/round/finish/:round', RoundController.finishRound);
app.get('/round/finishv2/:round', RoundController.finishRound);
app.post('/round/finish/v4/:round', RoundController.finishRoundV4);

app.get('/battlepass', BattlePassController.getBattlePass);
app.post('/battlepass/claimv3', BattlePassController.claimReward);
app.post('/battlepass/purchase', BattlePassController.purchaseBattlePass);

app.get('/economy/purchase/:item', EconomyController.purchase); 
app.post('/economy/:currencyType/give/:amount', EconomyController.giveCurrency); 

app.get('/missions', MissionsController.getMissions);
app.post('/missions/:missionId/rewards/claim/v2', MissionsController.claimMissionReward);

app.post('/friends/request', FriendsController.request);
app.get('/friends', FriendsController.list);
app.delete('/friends/:UserId', FriendsController.remove);

app.get("/game-events/me", EventsController.getActive);
app.get("/news/getall", NewsController.GetNews);
app.post('/analytics', AnalyticsController.analytic);

app.post("/update-crown-score", CrownController.updateScore);
app.get("/highscore/crowns/list", CrownController.list);

app.get('/highscore/:type/list/', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { start = 0, count = 100, country = 'global' } = req.query;
    const result = await UserModel.GetHighscore(type, country, parseInt(start), parseInt(count));
    res.json(result);
  } catch (err) { next(err); }
});

app.get("/social/interactions", SocialController.getInteractions);
app.get("/tournamentx/active", TournamentXController.getActive.bind(TournamentXController));
app.post("/tournamentx/:tournamentId/join/v2", TournamentXController.join.bind(TournamentXController));

// NEU: TourX Winner Report API
app.post("/tourx/report-winner", (req, res) => {
  const { matchId, winnerUserId } = req.body;
  res.json(TourXManager.reportWinner(matchId, winnerUserId));
});

app.get("/api/v1/ping", async (req, res) => res.status(200).send("OK"));
app.post("/api/v1/userLoginExternal", TournamentController.login);
app.get("/api/v1/tournaments", TournamentController.getActive);

const UserIdCounter = require('./UserIdCounter');
app.get('/admin/userid/current', (req, res) => {
  res.json({ success: true, currentId: UserIdCounter.getCurrentId() });
});
app.post('/admin/userid/set', (req, res) => {
  UserIdCounter.setNextId(parseInt(req.body.nextId));
  res.json({ success: true });
});

app.use(errorControll);

app.listen(PORT, async () => {
  const currentDate = new Date().toLocaleString().replace(",", " |");
  console.clear();
  Console.log("Server", `[${Title}] | ${currentDate} | ${CryptoUtils.SessionToken()}`);
  Console.log("Server", `Listening on port ${PORT}`);
  if (process.env.DISCORD_TOKEN) await BotManager.initialize();
});