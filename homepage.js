import { skillExamples } from "./skills.js";
import { createScrollStory } from "./story.js";
import { bindWalletButton } from "./app/auth.js";

const heroModeInputs = document.querySelectorAll('input[name="hero-mode"]');
const heroAction = document.querySelector("#hero-action");
const sceneContainer = document.querySelector("#scene-container");
const caption = document.querySelector("#scene-caption");
const explanation = document.querySelector("#scene-explanation");
const announcement = document.querySelector("#state-announcement");
const dialog = document.querySelector("#details-dialog");
const closeButton = document.querySelector("#dialog-close");
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

let heroMode = "sell";
let scene = null;
let previousFocus = null;
let scrollStory = null;

function updateHeroStory() {
  const selling = heroMode === "sell";
  caption.textContent = selling
    ? "Package your work. Let other agents reuse it."
    : "Give your agent a skill worth reusing.";
  explanation.textContent = selling
    ? "Your agent packages a skill. Copies travel outward to the other agents while your agent keeps the original."
    : "A skill from another agent arrives and settles into your agent’s platform. The source agent keeps the original.";
  // The shared canvas has its own accessible description during the scroll story.
  if (sceneContainer.dataset.mode !== "story")
    sceneContainer.setAttribute("aria-label", explanation.textContent);
  document.querySelector(".fallback-creator b").textContent = selling ? "Your agent" : "Skill creator";
  document.querySelector(".fallback-a b").textContent = selling ? "Agent A" : "Your agent";
}

function setHeroMode(value) {
  if (value !== "sell" && value !== "buy") return;
  heroMode = value;
  document.body.dataset.heroMode = heroMode;
  for (const input of heroModeInputs) input.checked = input.value === heroMode;
  for (const copy of document.querySelectorAll("[data-mode-copy]"))
    copy.setAttribute("aria-hidden", String(copy.dataset.modeCopy !== heroMode));
  document.querySelector("#hero-action-label").textContent = heroMode === "sell" ? "Sell" : "Buy";
  heroAction.setAttribute("href", heroMode === "sell" ? "/submit" : "/marketplace");
  updateHeroStory();
  if (scene) scene.setHeroMode(heroMode);
  announcement.textContent = heroMode === "sell" ? "Sell mode selected." : "Buy mode selected.";
}

function openDetails() {
  previousFocus = document.activeElement;
  dialog.showModal();
  document.body.classList.add("dialog-open");
  closeButton.focus({ preventScroll: true });
}

function selectSkill(skillId) {
  const skill = skillExamples[skillId];
  if (!skill) return;
  document.querySelector("#dialog-title").textContent = skill.title;
  document.querySelector("#dialog-category").textContent = skill.category;
  document.querySelector("#dialog-description").textContent = skill.description;
  document.querySelector("#dialog-input").textContent = skill.input;
  document.querySelector("#dialog-output").textContent = skill.output;
  document
    .querySelector("#dialog-icon")
    .setAttribute("href", "#icon-" + skill.icon);
  document.querySelector("#dialog-art").className =
    "dialog-art " + skill.color + "-art";
  document.querySelector("#dialog-fields").hidden = false;
  document.querySelector("#dialog-notice").textContent =
    "Example package — not available for purchase in this prototype.";
  openDetails();
}

for (const input of heroModeInputs)
  input.addEventListener("change", () => setHeroMode(input.value));
document.querySelectorAll("[data-skill]").forEach((button) => {
  button.addEventListener("click", () => selectSkill(button.dataset.skill));
});
const walletStatus = document.createElement("p");
walletStatus.setAttribute("role", "status");
walletStatus.className = "homepage-wallet-status";
document.querySelector(".site-header").after(walletStatus);
bindWalletButton(document.querySelector("#connect-wallet"), walletStatus);
closeButton.addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  ) {
    dialog.close();
  }
});
dialog.addEventListener("close", () => {
  if (dialog.open) return;
  document.body.classList.remove("dialog-open");
  const activeElement = document.activeElement;
  if (previousFocus && previousFocus.isConnected &&
      (activeElement === document.body || dialog.contains(activeElement)))
    previousFocus.focus({ preventScroll: true });
});

// HTML is already visible. Load the larger 3D module separately so it never blocks the headline.
async function loadScene() {
  try {
    const { createScene } = await import("./scene.js");
    scene = createScene(sceneContainer, {
      onSelectSkill: selectSkill,
      onUnavailable: () => {
        sceneContainer.classList.remove("scene-ready");
        scrollStory.setAvailable(false);
        updateHeroStory();
      },
      onAvailable: () => scrollStory.setAvailable(true),
      onStoryFrame: (progress, rendered) => scrollStory.renderStory(progress, rendered),
      reducedMotion: motionPreference.matches,
    });
    scene.setHeroMode(heroMode);
    scrollStory.updateScrollStory();
  } catch (error) {
    // The CSS stations stay visible if WebGL or module loading is unavailable.
    sceneContainer.classList.remove("scene-ready");
    sceneContainer.dataset.scene = "fallback";
    scrollStory.setAvailable(false);
    updateHeroStory();
    console.warn(
      "The 3D demo is unavailable; the accessible illustration is active.",
      error.message,
    );
  }
}

function updateMotionPreference() {
  if (scene) scene.setReducedMotion(motionPreference.matches);
}
motionPreference.addEventListener("change", updateMotionPreference);
window.addEventListener("pagehide", (event) => {
  if (!event.persisted) {
    if (scene) scene.disposeScene();
    scrollStory.disposeStory();
  }
});

scrollStory = createScrollStory(sceneContainer, {
  onProgress: (progress, active, modeChanged, state) => {
    if (scene) scene.setStoryProgress(active ? progress : null, state);
    if (modeChanged && !active) updateHeroStory();
  },
});
setHeroMode(heroMode);
loadScene();
