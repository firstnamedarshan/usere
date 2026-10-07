import { skillExamples, skillCategories } from "./skills.js";
import "./pages.css";

const sampleSkills = Object.values(skillExamples);
const brandContent = document.querySelector(".site-header .brand").innerHTML;
const arrowIcon = '<svg aria-hidden="true"><use href="#icon-arrow" /></svg>';

// Only sample data is inserted into page templates. Uploaded text and form
// values are displayed with textContent, so they cannot become HTML.
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatPrice(price) {
  return price.toLocaleString("en-US", { maximumFractionDigits: 3 }) + " SOL";
}

function categoryOptions() {
  return skillCategories.map((category) =>
    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`,
  ).join("");
}

function showShell(content, activePage) {
  document.body.removeAttribute("data-hero-mode");
  document.querySelector("#details-dialog").remove();
  document.querySelector(".page-shell").classList.add("inner-shell");
  document.querySelector(".page-shell").innerHTML = `
    <header class="site-header">
      <a class="brand" href="/" aria-label="Reusable Network home">${brandContent}</a>
      <nav aria-label="Main navigation">
        <a href="/examples" ${activePage === "marketplace" ? 'aria-current="page"' : ""}>Marketplace</a>
        <a href="/submit" ${activePage === "submit" ? 'aria-current="page"' : ""}>Submit a skill</a>
        <a href="/#how-it-works">How it works</a>
      </nav>
      <span class="wallet-button preview-label"><span class="wallet-dot" aria-hidden="true"></span>Frontend preview</span>
    </header>
    <main id="main" class="content-page">${content}</main>
    <footer class="site-footer">
      <a class="brand footer-brand" href="/">${brandContent}</a>
      <p>One solution. New starting points.</p>
      <span class="prototype-tag">Frontend prototype</span>
    </footer>`;
}

function skillCard(skill) {
  return `
    <a class="market-card" href="/examples/${skill.slug}">
      <div class="market-card-top">
        <span class="skill-art ${skill.color}-art"><svg aria-hidden="true"><use href="#icon-${skill.icon}" /></svg></span>
        <span class="sample-label">Sample skill</span>
      </div>
      <span class="skill-category">${escapeHtml(skill.category)}</span>
      <h2>${escapeHtml(skill.title)}</h2>
      <p>${escapeHtml(skill.summary)}</p>
      <div class="market-card-bottom">
        <span class="skill-price">${formatPrice(skill.price)}</span>
        <span class="card-details">View skill ${arrowIcon}</span>
      </div>
    </a>`;
}

function showMarketplace() {
  document.title = "Marketplace — Reusable Network";
  showShell(`
    <section class="page-intro" aria-labelledby="page-title">
      <p class="eyebrow"><span aria-hidden="true"></span>A better starting point</p>
      <div class="page-title-row">
        <div>
          <h1 id="page-title">A little less <span>from scratch.</span></h1>
          <p class="page-description">Find a useful skill. Give your agent a head start.</p>
        </div>
        <a class="primary-button" href="/submit">Submit a skill ${arrowIcon}</a>
      </div>
      <p class="prototype-notice"><strong>Sample marketplace.</strong> All skills, creators and SOL prices are illustrative. Purchases are not available.</p>
    </section>
    <section aria-label="Browse sample skills">
      <form class="market-filters" role="search">
        <div class="form-field search-field">
          <label for="skill-search">Search skills</label>
          <div class="search-control">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <input id="skill-search" type="search" placeholder="Try CSV, API, or wallet…" maxlength="200" />
          </div>
        </div>
        <div class="form-field category-field">
          <label for="category-filter">Category</label>
          <select id="category-filter"><option value="">All categories</option>${categoryOptions()}</select>
        </div>
      </form>
      <div class="results-heading">
        <p id="results-count" role="status" aria-live="polite" aria-atomic="true"></p>
        <button id="clear-filters" class="text-button" type="button" hidden>Clear filters</button>
      </div>
      <div id="marketplace-results" class="market-grid"></div>
    </section>`, "marketplace");

  const searchInput = document.querySelector("#skill-search");
  const categoryFilter = document.querySelector("#category-filter");
  const query = new URLSearchParams(window.location.search);
  searchInput.value = (query.get("q") || "").slice(0, 200);
  categoryFilter.value = skillCategories.includes(query.get("category")) ? query.get("category") : "";

  function updateResults() {
    const search = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    const matchingSkills = sampleSkills.filter((skill) => {
      const searchableText = `${skill.title} ${skill.summary} ${skill.description} ${skill.category}`.toLowerCase();
      return searchableText.includes(search) && (!category || skill.category === category);
    });
    document.querySelector("#results-count").textContent = `${matchingSkills.length} sample skill${matchingSkills.length === 1 ? "" : "s"}`;
    document.querySelector("#marketplace-results").innerHTML = matchingSkills.length
      ? matchingSkills.map(skillCard).join("")
      : '<div class="empty-results"><h2>No matching skills.</h2><p>Try another search or clear your filters.</p></div>';
    document.querySelector("#clear-filters").hidden = !search && !category;

    // Keep filters in the URL so reload and browser Back restore the view.
    const filters = new URLSearchParams();
    if (searchInput.value.trim()) filters.set("q", searchInput.value.trim());
    if (category) filters.set("category", category);
    const filterQuery = filters.toString();
    window.history.replaceState(null, "", "/examples" + (filterQuery ? "?" + filterQuery : ""));
  }

  document.querySelector(".market-filters").addEventListener("submit", (event) => event.preventDefault());
  searchInput.addEventListener("input", updateResults);
  categoryFilter.addEventListener("change", updateResults);
  document.querySelector("#clear-filters").addEventListener("click", () => {
    searchInput.value = "";
    categoryFilter.value = "";
    updateResults();
    searchInput.focus();
  });
  updateResults();
}

function bulletList(items) {
  return `<ul class="detail-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function showSkillDetails(skill) {
  document.title = `${skill.title} — Reusable Network`;
  showShell(`
    <a class="back-link" href="/examples"><span aria-hidden="true">←</span> Back to marketplace</a>
    <div class="detail-layout">
      <article class="skill-detail">
        <header class="detail-heading">
          <span class="skill-art ${skill.color}-art"><svg aria-hidden="true"><use href="#icon-${skill.icon}" /></svg></span>
          <div><p class="eyebrow plain">${escapeHtml(skill.category)}</p><span class="sample-label">Sample skill</span></div>
        </header>
        <h1 id="page-title">${escapeHtml(skill.title)}</h1>
        <p class="page-description">${escapeHtml(skill.summary)}</p>
        <section class="detail-section" aria-labelledby="description-heading">
          <h2 id="description-heading">Description</h2>
          <p>${escapeHtml(skill.description)}</p>
        </section>
        <section class="detail-section" aria-labelledby="does-heading">
          <h2 id="does-heading">What it does</h2>${bulletList(skill.whatItDoes)}
        </section>
        <section class="detail-section" aria-labelledby="examples-heading">
          <h2 id="examples-heading">Example input &amp; output</h2>
          <p class="small-note">Illustrative examples, provided with this sample.</p>
          <div class="example-block"><h3>Input</h3><pre>${escapeHtml(skill.exampleInput)}</pre></div>
          <div class="example-block"><h3>Output</h3><pre>${escapeHtml(skill.exampleOutput)}</pre></div>
        </section>
        <section class="detail-section" aria-labelledby="requirements-heading">
          <h2 id="requirements-heading">Requirements</h2>${bulletList(skill.requirements)}
        </section>
      </article>
      <aside class="purchase-panel" aria-label="Sample skill price and creator">
        <p class="eyebrow plain">A reusable starting point</p>
        <p class="purchase-price">${formatPrice(skill.price)}</p>
        <p class="small-note">Sample price</p>
        <dl class="skill-facts">
          <div><dt>Creator <span>(sample)</span></dt><dd>${escapeHtml(skill.creator)}</dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(skill.category)}</dd></div>
          <div><dt>Package format</dt><dd>Markdown instructions</dd></div>
        </dl>
        <button class="primary-button" type="button" disabled aria-describedby="purchase-notice">Buy ${arrowIcon}</button>
        <p id="purchase-notice" class="small-note">Frontend preview only. Purchases and payments are not connected. This sample skill cannot be bought.</p>
        <a class="text-link" href="/examples">Explore more skills <span aria-hidden="true">↗</span></a>
      </aside>
    </div>`, "marketplace");
}

function showNotFound() {
  document.title = "Page not found — Reusable Network";
  showShell(`
    <section class="page-intro not-found">
      <p class="eyebrow plain">Page not found</p>
      <h1>Let’s find your <span>next skill.</span></h1>
      <p class="page-description">This page isn’t part of the sample marketplace.</p>
      <a class="primary-button" href="/examples">Explore skills ${arrowIcon}</a>
    </section>`, "");
}

export function showSamplePage(pagePath) {
  if (pagePath === "/examples") return showMarketplace();

  const skill = sampleSkills.find((sample) => pagePath === `/examples/${sample.slug}`);
  if (skill) return showSkillDetails(skill);
  showNotFound();
}
