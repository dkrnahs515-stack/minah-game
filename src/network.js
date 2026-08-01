import { FIREBASE_CONFIG, GAME_CONFIG as C, ROOM_ID } from "./config.js";

const emptyAdapter = {
  mode: "offline",
  uid: "local-player",
  start: async () => ({ uid: "local-player", players: new Map() }),
  publish: () => {},
  stop: () => {},
};

export async function createNetworkAdapter(onPlayersChanged, onStatusChanged) {
  if (!FIREBASE_CONFIG?.apiKey || !FIREBASE_CONFIG?.databaseURL) {
    onStatusChanged?.("offline", "Firebase 설정 필요");
    return emptyAdapter;
  }

  onStatusChanged?.("connecting", "접속 중");

  try {
    const version = "12.16.0";
    const [{ initializeApp }, authModule, dbModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-database.js`),
    ]);

    const app = initializeApp(FIREBASE_CONFIG);
    const auth = authModule.getAuth(app);
    const credential = await authModule.signInAnonymously(auth);
    const uid = credential.user.uid;
    const db = dbModule.getDatabase(app);
    const playerRef = dbModule.ref(db, `rooms/${ROOM_ID}/players/${uid}`);
    const playersRef = dbModule.ref(db, `rooms/${ROOM_ID}/players`);
    const connectedRef = dbModule.ref(db, ".info/connected");

    const disconnect = dbModule.onDisconnect(playerRef);
    await disconnect.remove();

    let stopped = false;
    const unsubscribePlayers = dbModule.onValue(playersRef, snapshot => {
      const raw = snapshot.val() || {};
      const players = new Map();
      Object.entries(raw).forEach(([id, p]) => {
        if (id !== uid && Number.isFinite(p?.x) && Number.isFinite(p?.y)) players.set(id, p);
      });
      onPlayersChanged?.(players);
    });

    const unsubscribeConnected = dbModule.onValue(connectedRef, snapshot => {
      onStatusChanged?.(snapshot.val() === true ? "online" : "connecting", snapshot.val() === true ? "온라인" : "재연결 중");
    });

    let lastPublish = 0;
    const publish = state => {
      if (stopped) return;
      const now = performance.now();
      if (now - lastPublish < 1000 / C.NETWORK_SEND_HZ) return;
      lastPublish = now;
      dbModule.update(playerRef, {
        x: Math.round(state.x * 10) / 10,
        y: Math.round(state.y * 10) / 10,
        dir: state.dir,
        moving: state.moving,
        color: state.color,
        name: state.name,
        updatedAt: dbModule.serverTimestamp(),
      }).catch(error => console.warn("플레이어 위치 전송 실패", error));
    };

    return {
      mode: "firebase",
      uid,
      start: async () => ({ uid, players: new Map() }),
      publish,
      stop: () => {
        stopped = true;
        unsubscribePlayers();
        unsubscribeConnected();
        dbModule.remove(playerRef).catch(() => {});
      },
    };
  } catch (error) {
    console.error("Firebase 연결 실패", error);
    onStatusChanged?.("offline", "연결 실패");
    return emptyAdapter;
  }
}