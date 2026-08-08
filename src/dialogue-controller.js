export class DialogueController {
  constructor({ overlay, title, body, actionButton, onAction }) {
    this.overlay = overlay;
    this.title = title;
    this.body = body;
    this.actionButton = actionButton;
    this.onAction = onAction;
    this.action = null;

    this.actionButton.addEventListener("click", () => {
      if (this.action) this.onAction?.(this.action);
    });
  }

  open(model) {
    this.title.textContent = model.title;
    this.body.textContent = model.body;
    this.actionButton.textContent = model.actionLabel;
    this.action = model.action;
    this.overlay.hidden = false;
  }

  close() {
    this.overlay.hidden = true;
  }
}
