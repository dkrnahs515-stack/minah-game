import { CHAT_LIMITS, validateChatDraft } from "./chat-state.js";

export function chatKeyAction({ code, typing, running, exitOpen }) {
  if (code === "Escape" && typing) return "cancel";
  if (code === "Enter" && running && !typing && !exitOpen) return "open";
  return null;
}

export class ChatController {
  constructor({
    panel,
    list,
    form,
    input,
    status,
    onSend,
    onTypingChange,
    now = () => Date.now(),
    documentRef = document,
  }) {
    this.panel = panel;
    this.list = list;
    this.form = form;
    this.input = input;
    this.status = status;
    this.button = form.querySelector("button");
    this.onSend = onSend;
    this.onTypingChange = onTypingChange;
    this.now = now;
    this.documentRef = documentRef;
    this.previousText = "";
    this.lastSentAt = -Infinity;
    this.online = false;
    this.typing = false;
    this.sending = false;
    this.form.addEventListener("submit", event => {
      event.preventDefault();
      void this.submit();
    });
    this.input.addEventListener("focus", () => this.setTyping(true));
    this.input.addEventListener("blur", () => {
      if (!this.sending) this.setTyping(false);
    });
  }

  setTyping(active) {
    const next = Boolean(active) && this.online;
    if (this.typing === next) return;
    this.typing = next;
    this.onTypingChange?.(next);
  }

  isTyping() {
    return this.typing;
  }

  open() {
    if (!this.online || this.input.disabled || this.sending) return false;
    this.input.focus();
    this.setTyping(true);
    return true;
  }

  cancel() {
    const wasTyping = this.typing;
    this.input.value = "";
    this.typing = false;
    this.input.blur();
    if (wasTyping) this.onTypingChange?.(false);
    return wasTyping;
  }

  setSending(active) {
    this.sending = Boolean(active);
    this.input.disabled = !this.online || this.sending;
    this.button.disabled = !this.online || this.sending;
  }

  async submit() {
    if (this.sending || !this.online) return false;
    const draft = validateChatDraft(this.input.value, this.previousText);
    if (!draft.ok) {
      this.setStatus("error", draft.error);
      return false;
    }
    if (this.now() - this.lastSentAt < CHAT_LIMITS.cooldownMs) {
      this.setStatus("error", "메시지는 1초에 한 번 보낼 수 있습니다.");
      return false;
    }

    this.setSending(true);
    let result;
    try {
      result = await this.onSend(draft.text);
    } catch (error) {
      console.warn("채팅 전송 처리 실패", error);
      result = { ok: false, error: "메시지를 보내지 못했습니다." };
    }
    this.setSending(false);
    if (!result?.ok) {
      this.setStatus("error", result?.error || "메시지를 보내지 못했습니다.");
      if (this.online) this.input.focus();
      return false;
    }

    this.previousText = draft.text;
    this.lastSentAt = this.now();
    this.cancel();
    this.setMode("online", "전체 채팅");
    return true;
  }

  setStatus(mode, label) {
    this.status.className = `chat-status ${mode}`;
    this.status.textContent = label;
  }

  setMode(mode, label) {
    const online = mode === "online";
    if (!online) this.cancel();
    this.online = online;
    this.setSending(false);
    this.setStatus(mode, label);
  }

  renderMessages(messages) {
    const fragment = this.documentRef.createDocumentFragment();
    for (const message of messages || []) {
      const item = this.documentRef.createElement("li");
      const name = this.documentRef.createElement("b");
      const text = this.documentRef.createElement("span");
      name.textContent = message.name;
      text.textContent = message.text;
      item.append(name, text);
      fragment.append(item);
    }
    this.list.replaceChildren(fragment);
    this.list.scrollTop = this.list.scrollHeight;
  }

  reset() {
    this.previousText = "";
    this.lastSentAt = -Infinity;
    this.list.replaceChildren();
    this.input.value = "";
    this.setMode("offline", "오프라인");
  }
}
