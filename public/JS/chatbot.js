(() => {
  "use strict";

  const root = document.querySelector(".dynastay-chatbot");
  if (!root) return;

  const panel = root.querySelector("#dynastay-chat-panel");
  const launcher = root.querySelector(".dynastay-chat-launcher");
  const closeButton = root.querySelector(".dynastay-chat-close");
  const form = root.querySelector("#dynastay-chat-form");
  const input = root.querySelector("#dynastay-chat-input");
  const messages = root.querySelector("#dynastay-chat-messages");
  const sendButton = form.querySelector('button[type="submit"]');
  const endpoint = root.dataset.chatEndpoint;

  function setOpen(isOpen) {
    panel.hidden = !isOpen;
    panel.setAttribute("aria-hidden", String(!isOpen));
    launcher.setAttribute("aria-expanded", String(isOpen));
    launcher.setAttribute("aria-label", isOpen ? "Close DynaStay assistant" : "Open DynaStay assistant");
    if (isOpen) input.focus();
  }

  function addMessage(text, sender) {
    const wrapper = document.createElement("div");
    wrapper.className = "dynastay-chat-message " + sender;
    const bubble = document.createElement("div");
    bubble.className = "dynastay-chat-bubble";
    // Use textContent: model output must never be interpreted as HTML.
    bubble.textContent = text;
    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
    return wrapper;
  }

  function setSending(isSending) {
    input.disabled = isSending;
    sendButton.disabled = isSending;
    sendButton.innerHTML = isSending
      ? '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i>';
    sendButton.setAttribute("aria-label", isSending ? "Sending message" : "Send message");
  }

  launcher.addEventListener("click", () => {
    const isOpen = launcher.getAttribute("aria-expanded") !== "true";
    setOpen(isOpen);
  });

  closeButton.addEventListener("click", () => {
    setOpen(false);
    launcher.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || message.length > 2000 || sendButton.disabled) return;

    addMessage(message, "user");
    input.value = "";
    setSending(true);
    const pending = addMessage("Thinking...", "assistant pending");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ message })
      });

      const data = await response.json().catch(() => ({}));
      pending.remove();

      if (!response.ok || !data.success) {
        const errorMessage = response.status === 401
          ? "Your session has expired. Please log in again."
          : response.status === 429
            ? "You've reached the chat limit. Please try again later."
            : (data.message || "The assistant is temporarily unavailable. Please try again.");
        addMessage(errorMessage, "assistant error");
        return;
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        addMessage("I didn't receive a usable response. Please try again.", "assistant error");
        return;
      }

      addMessage(data.reply.trim(), "assistant");
    } catch (_error) {
      pending.remove();
      addMessage("Couldn't connect to the assistant. Check your connection and try again.", "assistant error");
    } finally {
      setSending(false);
      input.focus();
    }
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
})();
