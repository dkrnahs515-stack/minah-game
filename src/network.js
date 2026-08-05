import { FIREBASE_CONFIG, GAME_CONFIG as C, ROOM_ID } from "./config.js";
import { filterPlayersForMap, serializePlayerState } from "./network-state.js";

const emptyAdapter = {
  mode: "offline",
  uid: "local-player",
  publish: () => {},
  stop: async () => {},
};

export async function createNetworkAdapter(onPlayersChanged, onStatusChanged) {
  if (!FIREBASE_CONFIG?.apiKey || !FIREBASE_CONFIG?.databaseURL) {
    onStatusChanged?.("offline", "Firebase 설정 필요");
    return emptyAdapter;
  }

  onStatusChanged?.("connecting", "접속 중");

  try {
    const version = "12.16.0";
    const [appModule, authModule, dbModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-database.js`),
    ]);

    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(FIREBASE_CONFIG);
    const auth = authModule.getAuth(app);
    const user = auth.currentUser || (await authModule.signInAnonymously(auth)).user;
    const uid = user.uid;
    const db = dbModule.getDatabase(app);
    const playerRef = dbModule.ref(db, `rooms/${ROOM_ID}/players/${uid}`);
    const playersRef = dbModule.ref(db, `rooms/${ROOM_ID}/players`);
    const connectedRef = dbModule.ref(db, ".info/connected");

    const disconnect = dbModule.onDisconnect(playerRef);
    await disconnect.remove();

    let stopped = false;
    let activeMapId = "village";
    let rawPlayers = {};
    const emitVisiblePlayers = () => {
      onPlayersChanged?.(filterPlayersForMap(rawPlayers, uid, activeMapId));
    };
    const unsubscribePlayers = dbModule.onValue(playersRef, snapshot => {
      rawPlayers = snapshot.val() || {};
      emitVisiblePlayers();
    });

    const unsubscribeConnected = dbModule.onValue(connectedRef, snapshot => {
      const online = snapshot.val() === true;
      onStatusChanged?.(online ? "online" : "connecting", online ? "온라인" : "재연결 중");
    });

    let lastPublish = 0;
    const publish = (state, mapId = "village") => {
      if (stopped) return;
      if (mapId !== activeMapId) {
        activeMapId = mapId;
        emitVisiblePlayers();
      }
      const now = performance.now();
      if (now - lastPublish < 1000 / C.NETWORK_SEND_HZ) return;
      lastPublish = now;
      dbModule.update(playerRef, {
        ...serializePlayerState(state, activeMapId),
        updatedAt: dbModule.serverTimestamp(),
      }).catch(error => console.warn("플레이어 위치 전송 실패", error));
    };

    return {
      mode: "firebase",
      uid,
      publish,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        unsubscribePlayers();
        unsubscribeConnected();
        try {
          await dbModule.remove(playerRef);
          await disconnect.cancel();
        } catch (error) {
          console.warn("플레이어 퇴장 정보 정리 실패", error);
        }
      },
    };
  } catch (error) {
    console.error("Firebase 연결 실패", error);
    onStatusChanged?.("offline", "연결 실패");
    return emptyAdapter;
  }
}
