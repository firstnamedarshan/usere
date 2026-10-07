// All cinematic timings are normalized scroll positions, not delays or timers.
export const storySettings = {
  chapters: [0, 0.25, 0.5, 0.8],
  motion: {
    responseSpeed: 18,
    settleThreshold: 0.0001,
    maxFrameGap: 0.25,
  },
  scroll: {
    end: 0.8,
    desktopLead: 2.2,
    mobileLead: 1.4,
  },
  assembly: {
    appear: 0.23,
    exploded: 0.29,
    joinStart: 0.34,
    joinEnd: 0.49,
    layerSpacing: 1.03,
    layerFrontOffset: 0.9,
    layerLift: 0.4,
    desktopOffset: [0, 0.4, 0.55],
    mobileOffset: [0, 0.4, 0.35],
  },
  transfers: {
    first: 0.55,
    second: 0.59,
    duration: 0.15,
    settle: 0.04,
    fadeStart: 0.75,
    fadeEnd: 0.8,
  },
  camera: {
    desktop: {
      position: [0, 5.8, 12],
      target: [0, 0.6, 0.5],
      width: 15.8,
      center: 0.72,
    },
    mobile: {
      position: [0, 6.3, 12],
      target: [0, 0.6, 0.5],
      width: 6.8,
      center: 0.5,
      compactThreshold: 760,
      compactHeightRange: 160,
      compactZoom: 0.28,
    },
  },
};

export function getStoryScrollOffset(section, progress) {
  const lead = innerHeight * (innerWidth <= 760
    ? storySettings.scroll.mobileLead : storySettings.scroll.desktopLead);
  return Math.max(0, Math.min(storySettings.scroll.end, progress)) * lead;
}

export function getStoryProgress(section) {
  const bounds = section.getBoundingClientRect();
  const lead = innerHeight * (innerWidth <= 760
    ? storySettings.scroll.mobileLead : storySettings.scroll.desktopLead);
  const offset = Math.max(0, -bounds.top);
  let progress = Math.min(storySettings.scroll.end, offset / lead);
  // Browser scrolling is rounded to pixels. Snap within one pixel of a chapter edge.
  for (const boundary of storySettings.chapters) {
    if (Math.abs(getStoryScrollOffset(section, boundary) - offset) < 1) progress = boundary;
  }
  return progress;
}

export function createScrollStory(container, callbacks) {
  const section = document.querySelector("#scroll-story");
  const slot = document.querySelector("#story-canvas-slot");
  const heroParent = container.parentElement;
  const bridgeLayer = document.createElement("div");
  bridgeLayer.className = "scene-bridge-layer";
  document.querySelector(".page-shell").append(bridgeLayer);
  const chapters = Array.from(section.querySelectorAll(".story-chapter"));
  const navigation = Array.from(section.querySelectorAll("[data-story-jump]"));
  const layerLabels = document.querySelector("#story-layer-labels");
  const skillControls = document.querySelector("#story-skill-controls");
  const copy = section.querySelector(".story-copy");
  const motionPreference = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const compactViewport = window.matchMedia(
    "(max-height: 620px), (max-width: 760px) and (max-height: 700px)",
  );
  let available = true;
  let active = false;
  let chapterIndex = -1;
  let targetProgress = 0;
  let displayedProgress = 0;
  let simpleFlow = false;
  let measuredWidth = 0;

  function measureChapterLayout() {
    if (simpleFlow || copy.clientWidth === measuredWidth) return;
    measuredWidth = copy.clientWidth;
    let height = 0;
    for (const chapter of chapters) {
      const measure = chapter.cloneNode(true);
      measure.hidden = false;
      measure.inert = true;
      measure.setAttribute("aria-hidden", "true");
      Object.assign(measure.style, {
        position: "absolute", width: "100%", visibility: "hidden", pointerEvents: "none",
      });
      copy.append(measure);
      height = Math.max(height, measure.offsetHeight);
      measure.remove();
    }
    section.style.setProperty("--story-copy-height", height + "px");
  }

  // A static composition covers module loading only. The live hero agents
  // travel through the bridge; no second set of stations replaces them.
  const loadingComposition = section.querySelector(".static-repeat").cloneNode(true);
  loadingComposition.className = "story-loading-composition static-repeat";
  loadingComposition.setAttribute("aria-hidden", "true");
  slot.append(loadingComposition);

  function updateChapterText(progress, simpleFlow) {
    let nextChapter = 0;
    for (let index = 0; index < storySettings.chapters.length; index += 1) {
      if (progress >= storySettings.chapters[index]) nextChapter = index;
    }
    if (nextChapter !== chapterIndex || simpleFlow) for (let index = 0; index < chapters.length; index += 1) {
      const visible = simpleFlow || index === nextChapter;
      chapters[index].hidden = !visible;
      chapters[index].inert = !visible;
      chapters[index].setAttribute("aria-hidden", String(!visible));
      navigation[index].setAttribute(
        "aria-current",
        index === nextChapter ? "step" : "false",
      );
    }
    if (chapterIndex !== nextChapter) {
      section.dataset.chapter = String(nextChapter);
      if (active) container.setAttribute("aria-label",
        chapters[nextChapter].querySelector("h2").textContent.trim(),
      );
      chapterIndex = nextChapter;
    }
    layerLabels.hidden = simpleFlow || progress < 0.27 || progress > 0.455;
    skillControls.hidden = !simpleFlow;
    section.style.setProperty("--story-progress", String(progress / storySettings.scroll.end));
  }

  function renderStory(progress, rendered = false) {
    displayedProgress = Math.max(0, Math.min(storySettings.scroll.end, progress));
    section.dataset.progress = displayedProgress.toFixed(4);
    section.classList.toggle("story-rendered", active && rendered);
    updateChapterText(displayedProgress, simpleFlow);
  }

  function updateScrollStory(event) {
    const wasSimple = simpleFlow;
    simpleFlow = motionPreference.matches || compactViewport.matches || !available;
    if (wasSimple !== simpleFlow) {
      chapterIndex = -1;
      measuredWidth = 0;
    }
    // Measure in the destination layout: static illustrations must not inflate
    // the reserved copy area when returning to the animated story.
    document.body.classList.toggle("story-enhanced", !simpleFlow);
    document.body.classList.toggle("story-static", simpleFlow);
    measureChapterLayout();
    const bounds = section.getBoundingClientRect();
    targetProgress = getStoryProgress(section);
    const heroBounds = heroParent.getBoundingClientRect();
    const storyTop = bounds.top + scrollY;
    const bridgeStart = Math.max(0,
      heroBounds.top + scrollY + heroBounds.height / 2 - innerHeight * 0.48);
    const bridgeProgress = Math.max(0, Math.min(1,
      (scrollY - bridgeStart) / Math.max(1, storyTop - bridgeStart)));
    const bridge = !simpleFlow && bridgeProgress > 0 && bounds.top > 0;
    const nextActive =
      !simpleFlow &&
      bounds.top <= 0 &&
      bounds.bottom > 0;
    const modeChanged = active !== nextActive;
    active = nextActive;
    const parent = bridge ? bridgeLayer : active ? slot : heroParent;
    if (container.parentElement !== parent) parent.appendChild(container);
    if (bridge) {
      const stageBounds = slot.getBoundingClientRect();
      const blend = bridgeProgress * bridgeProgress * (3 - 2 * bridgeProgress);
      const lerp = (from, to) => from + (to - from) * blend;
      Object.assign(container.style, {
        left: lerp(heroBounds.left, stageBounds.left) + "px",
        top: lerp(heroBounds.top + scrollY - bridgeStart, 0) + "px",
        width: lerp(heroBounds.width, stageBounds.width) + "px",
        height: lerp(heroBounds.height, slot.clientHeight) + "px",
      });
    } else {
      for (const property of ["left", "top", "width", "height"])
        container.style.removeProperty(property);
    }
    section.dataset.bridge = bridgeProgress.toFixed(4);
    section.classList.toggle("story-copy-ready", simpleFlow ||
      bounds.top <= innerHeight * (innerWidth <= 760 ? 0.2 : 0.75));
    document.body.style.setProperty("--hero-exit-opacity",
      String(simpleFlow ? 1 : 1 - Math.min(1, bridgeProgress * 5)));
    document.body.classList.toggle("scene-bridging", bridge);
    document.body.classList.toggle("story-active", active);
    section.dataset.targetProgress = targetProgress.toFixed(4);
    const immediate = modeChanged || wasSimple !== simpleFlow ||
      !event || ["resize", "pageshow", "visibilitychange"].includes(event.type);
    if (immediate || !active || simpleFlow) renderStory(targetProgress);
    callbacks.onProgress(targetProgress, active, modeChanged, {
      immediate, bridge: bridge ? bridgeProgress : active ? 1 : 0,
    });
  }

  function jumpToChapter(event) {
    const index = Number(event.currentTarget.dataset.storyJump);
    const bounds = section.getBoundingClientRect();
    const top = bounds.top + scrollY;
    // This uses native scrolling. Wheel and touch input can interrupt it normally.
    window.scrollTo({
      top: top + getStoryScrollOffset(section, storySettings.chapters[index] + 0.004),
      behavior: "smooth",
    });
  }

  function setAvailable(enabled) {
    available = enabled;
    document.body.classList.toggle("webgl-unavailable", !enabled);
    updateScrollStory();
  }

  for (const button of navigation)
    button.addEventListener("click", jumpToChapter);
  window.addEventListener("scroll", updateScrollStory, { passive: true });
  window.addEventListener("resize", updateScrollStory, { passive: true });
  window.addEventListener("pageshow", updateScrollStory);
  function onVisibilityChange(event) {
    if (!document.hidden) updateScrollStory(event);
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  motionPreference.addEventListener("change", updateScrollStory);
  compactViewport.addEventListener("change", updateScrollStory);
  const resizeObserver = new ResizeObserver(updateScrollStory);
  resizeObserver.observe(section);
  document.fonts.ready.then(() => { measuredWidth = 0; updateScrollStory(); });
  updateScrollStory();

  function disposeStory() {
    for (const button of navigation)
      button.removeEventListener("click", jumpToChapter);
    window.removeEventListener("scroll", updateScrollStory);
    window.removeEventListener("resize", updateScrollStory);
    window.removeEventListener("pageshow", updateScrollStory);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    motionPreference.removeEventListener("change", updateScrollStory);
    compactViewport.removeEventListener("change", updateScrollStory);
    resizeObserver.disconnect();
    loadingComposition.remove();
    heroParent.appendChild(container);
    bridgeLayer.remove();
  }
  return { updateScrollStory, renderStory, setAvailable, disposeStory };
}
