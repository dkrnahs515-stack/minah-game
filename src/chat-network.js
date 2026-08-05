import {
  CHAT_LIMITS,
  flattenChatMessages,
  messageIdsToPrune,
  normalizeChatText,
  splitGraphemes,
  validateChatDraft,
} from "./chat-state.js";
import { WORLD_IDS } from "./world-data.js";

export function createOfflineChatAdapter() {
  return {
    mode: "offline",
    send: async () => ({ ok: false, error: "채팅 서버가 오프라인입니다." }),
    armDisconnect: async () => {},
    stop: async () => {},
  };
}

export async function createFirebaseChatAdapter({ dbModule, db, uid, roomId, onMessagesChanged }) {
  const rootRef = dbModule.ref(db, `rooms/${roomId}/chat`);
  const userRef = dbModule.ref(db, `rooms/${roomId}/chat/${uid}`);
  let disconnectOperation = null;
  let stopped = false;

  const unsubscribe = dbModule.onValue(rootRef, snapshot => {
    onMessagesChanged?.(flattenChatMessages(snapshot.val() || {}));
  }, error => {
    console.warn("채팅 메시지 수신 실패", error);
    onMessagesChanged?.([]);
  });

  const armDisconnect = async () => {
    if (stopped) return;
    disconnectOperation = dbModule.onDisconnect(userRef);
    await disconnectOperation.remove();
  };

  return {
    mode: "firebase",
    armDisconnect,
    send: async ({ text, name, mapId }) => {
      if (stopped) return { ok: false, error: "채팅 연결이 종료되었습니다." };
      const draft = validateChatDraft(text, "");
      const normalizedName = normalizeChatText(name);
      if (!draft.ok) return draft;
      if (!normalizedName || splitGraphemes(normalizedName).length > 12 || normalizedName.length > 16) {
        return { ok: false, error: "닉네임 정보가 올바르지 않습니다." };
      }
      if (!WORLD_IDS.includes(mapId)) return { ok: false, error: "현재 지역 정보가 올바르지 않습니다." };

      try {
        const snapshot = await dbModule.get(userRef);
        const ids = messageIdsToPrune(snapshot.val() || {}, CHAT_LIMITS.messagesPerPlayer - 1);
        const messageRef = dbModule.push(userRef);
        const updates = Object.fromEntries(ids.map(id => [id, null]));
        updates[messageRef.key] = {
          text: draft.text,
          name: normalizedName,
          mapId,
          createdAt: dbModule.serverTimestamp(),
        };
        await dbModule.update(userRef, updates);
        return { ok: true, error: "" };
      } catch (error) {
        console.warn("채팅 메시지 전송 실패", error);
        return { ok: false, error: "메시지를 보내지 못했습니다." };
      }
    },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      try {
        await disconnectOperation?.cancel();
      } catch (error) {
        console.warn("채팅 자동 삭제 예약 취소 실패", error);
      }
      try {
        await dbModule.remove(userRef);
      } catch (error) {
        console.warn("채팅 종료 정보 정리 실패", error);
      }
    },
  };
}
