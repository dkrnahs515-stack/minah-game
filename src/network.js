import { FIREBASE_CONFIG, GAME_CONFIG as C, ROOM_ID } from "./config.js";
import { createFirebaseChatAdapter, createOfflineChatAdapter } from "./chat-network.js";
import { filterPlayersForMap, serializePlayerState } from "./network-state.js";

function createOfflineNetworkAdapter() {
  return {
    mode: "offline",
    uid: "local-player",
    publish: () => {},
    chat: createOfflineChatAdapter(),
    stop: async () => {},
  };
}

async function defaultFirebaseModuleLoader() {
  const version = "12.16.0";
  const [appModule, authModule, dbModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-database.js`),
  ]);
  return { appModule, authModule, dbModule };
}

export async function createNetworkAdapter(callbacks = {}, dependencies = {}) {
  if (typeof callbacks === "function") {
    callbacks = {
      onPlayersChanged: callbacks,
      onStatusChanged: typeof dependencies === "function" ? dependencies : undefined,
    };
    dependencies = {};
  }
  const {
    onPlayersChanged,
    onStatusChanged,
    onChatMessagesChanged,
  } = callbacks;
  const firebaseConfig = dependencies.firebaseConfig ?? FIREBASE_CONFIG;
  const loadFirebaseModules = dependencies.loadFirebaseModules ?? defaultFirebaseModuleLoader;

  if (!firebaseConfig?.apiKey || !firebaseConfig?.databaseURL) {
    onStatusChanged?.("offline", "Firebase 설정 필요");
    return createOfflineNetworkAdapter();
  }

  onStatusChanged?.("connecting", "접속 중");

  try {
    const { appModule, authModule, dbModule } = await loadFirebaseModules();

    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(firebaseConfig);
    const auth = authModule.getAuth(app);
    const user = auth.currentUser || (await authModule.signInAnonymously(auth)).user;
    const uid = user.uid;
    const db = dbModule.getDatabase(app);
    const playerRef = dbModule.ref(db, `rooms/${ROOM_ID}/players/${uid}`);
    const playersRef = dbModule.ref(db, `rooms/${ROOM_ID}/players`);
    const connectedRef = dbModule.ref(db, ".info/connected");

    let stopped = false;
    let playerDisconnect = null;
    let activeMapId = "village";
    let rawPlayers = {};
    const emitVisiblePlayers = () => {
      onPlayersChanged?.(filterPlayersForMap(rawPlayers, uid, activeMapId));
    };
    const unsubscribePlayers = dbModule.onValue(playersRef, snapshot => {
      rawPlayers = snapshot.val() || {};
      emitVisiblePlayers();
    });

    const chat = await createFirebaseChatAdapter({
      dbModule,
      db,
      uid,
      roomId: ROOM_ID,
      onMessagesChanged: onChatMessagesChanged,
    });

    const unsubscribeConnected = dbModule.onValue(connectedRef, async snapshot => {
      const online = snapshot.val() === true;
      if (!online) {
        onStatusChanged?.("connecting", "재연결 중");
        return;
      }
      try {
        playerDisconnect = dbModule.onDisconnect(playerRef);
        await Promise.all([playerDisconnect.remove(), chat.armDisconnect()]);
        if (!stopped) onStatusChanged?.("online", "온라인");
      } catch (error) {
        console.warn("접속 종료 자동 정리 예약 실패", error);
        if (!stopped) onStatusChanged?.("connecting", "재연결 중");
      }
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
      chat,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        unsubscribePlayers();
        unsubscribeConnected();
        await chat.stop();
        try {
          await playerDisconnect?.cancel();
          await dbModule.remove(playerRef);
        } catch (error) {
          console.warn("플레이어 퇴장 정보 정리 실패", error);
        }
      },
    };
  } catch (error) {
    console.error("Firebase 연결 실패", error);
    onStatusChanged?.("offline", "연결 실패");
    return createOfflineNetworkAdapter();
  }
}
