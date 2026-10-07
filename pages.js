import { api, submitSkill } from "./app/api.js";
import { configured } from "./app/config.js";
import { authState, onAuthChange, bindWalletButton, signIn, signOut } from "./app/auth.js";
import { payOrder, checkPayment, downloadSkill, savedSignature } from "./app/checkout.js";
import { CATEGORIES, FIELD_LIMITS, validateListing, validateSkillFile, formatLamports } from "./supabase/functions/_shared/validation.js";
import { transferDemoListing } from "./app/demo-draft.js";
import "./pages.css";

const brand = document.querySelector(".site-header .brand").innerHTML;
const arrow = '<svg aria-hidden="true"><use href="#icon-arrow" /></svg>';
const notice = '<p class="prototype-notice"><strong>Devnet demo — test SOL only.</strong> Prices and creator payments use free test funds. No real earnings.</p>';
const labels = { title: "Title", description: "Description", expected_input: "Expected input / public example", expected_output: "Expected output / public example", requirements: "Requirements", limitations: "Limitations", reuse_terms: "Reuse terms" };
let accountRevision = 0;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const options = () => CATEGORIES.map((category) => `<option>${escapeHtml(category)}</option>`).join("");

function shell(content, active) {
  document.body.removeAttribute("data-hero-mode");
  document.querySelector("#details-dialog")?.remove();
  document.querySelector(".page-shell").classList.add("inner-shell");
  document.querySelector(".page-shell").innerHTML = `<header class="site-header"><a class="brand" href="/" aria-label="Reusable Network home">${brand}</a><nav aria-label="Main navigation">${[["marketplace", "Marketplace"], ["submit", "Submit a skill"], ["account", "Account"]].map(([path, name]) => `<a href="/${path}" ${active === path ? 'aria-current="page"' : ""}>${name}</a>`).join("")}<a id="admin-link" href="/admin" hidden>Review</a></nav><button id="connect-wallet" class="wallet-button">Connect wallet</button></header><p id="wallet-status" class="wallet-status" role="status" aria-live="polite"></p><main id="main" class="content-page">${content}</main><footer class="site-footer"><a class="brand footer-brand" href="/">${brand}</a><p>One solution. New starting points.</p><span class="prototype-tag">Devnet demo · Test SOL only</span></footer>`;
  bindWalletButton(document.querySelector("#connect-wallet"), document.querySelector("#wallet-status"));
  onAuthChange((state) => { document.querySelector("#admin-link").hidden = !state.isAdmin; });
}

function showError(element, error, retry) {
  element.replaceChildren();
  const text = document.createElement("p");
  text.className = "prototype-notice error-notice";
  text.setAttribute("role", "alert");
  text.textContent = error.message;
  element.append(text);
  if (retry) {
    const button = document.createElement("button");
    button.className = "text-button";
    button.textContent = "Try again";
    button.onclick = retry;
    element.append(button);
  }
}

const card = (skill) => `<a class="market-card" href="/skill?id=${escapeHtml(skill.id)}"><div class="market-card-top"><span class="skill-art lavender-art"><svg aria-hidden="true"><use href="#icon-csv" /></svg></span><span class="sample-label">Reviewed · v${skill.version}</span></div><span class="skill-category">${escapeHtml(skill.category)}</span><h2>${escapeHtml(skill.title)}</h2><p>${escapeHtml(skill.description)}</p><div class="market-card-bottom"><span class="skill-price">${formatLamports(skill.price_lamports)}</span><span class="card-details">View skill ${arrow}</span></div></a>`;

async function marketplace() {
  document.title = "Marketplace — Reusable Network";
  shell(`<section class="page-intro"><p class="eyebrow"><span aria-hidden="true"></span>A better starting point</p><div class="page-title-row"><div><h1>A little less <span>from scratch.</span></h1><p class="page-description">Find a useful skill. Give your agent a head start.</p></div><a class="primary-button" href="/submit">Submit a skill ${arrow}</a></div>${notice}<p class="small-note">Only approved listings appear here. <a href="/examples">View illustrative examples</a>.</p></section><form class="market-filters" role="search"><div class="form-field search-field"><label for="skill-search">Search skills</label><input id="skill-search" type="search" maxlength="200" placeholder="Try Solana, CSV, or transactions…" /></div><div class="form-field category-field"><label for="category-filter">Category</label><select id="category-filter"><option value="">All categories</option>${options()}</select></div></form><div class="results-heading"><p id="results-count" role="status" aria-live="polite">Loading listings…</p><button id="clear-filters" class="text-button" hidden>Clear filters</button></div><div id="marketplace-results" class="market-grid"></div>`, "marketplace");
  const search = document.querySelector("#skill-search");
  const category = document.querySelector("#category-filter");
  const result = document.querySelector("#marketplace-results");
  const count = document.querySelector("#results-count");
  const params = new URLSearchParams(location.search);
  search.value = (params.get("q") || "").slice(0, 200);
  category.value = params.get("category") || "";
  let skills = [];
  function render() {
    const query = search.value.trim().toLowerCase();
    const matching = skills.filter((s) => `${s.title} ${s.description} ${s.category}`.toLowerCase().includes(query) && (!category.value || s.category === category.value));
    count.textContent = `${matching.length} skill${matching.length === 1 ? "" : "s"}`;
    result.innerHTML = matching.length ? matching.map(card).join("") : '<div class="empty-results"><h2>No matching skills.</h2><p>Try another search. Creators can submit skills for review.</p></div>';
    document.querySelector("#clear-filters").hidden = !query && !category.value;
    const filters = new URLSearchParams();
    if (search.value.trim()) filters.set("q", search.value.trim());
    if (category.value) filters.set("category", category.value);
    history.replaceState(null, "", "/marketplace" + (filters.size ? "?" + filters : ""));
  }
  document.querySelector(".market-filters").onsubmit = (event) => event.preventDefault();
  search.oninput = render;
  category.onchange = render;
  document.querySelector("#clear-filters").onclick = () => { search.value = ""; category.value = ""; render(); search.focus(); };
  async function load() {
    count.textContent = "Loading listings…";
    try { skills = (await api("list")).skills; render(); }
    catch (error) { count.textContent = "Listings unavailable"; showError(result, error, load); }
  }
  await load();
}

function metadata(skill) {
  return `<article class="skill-detail"><p class="eyebrow plain">${escapeHtml(skill.category)}</p><span class="sample-label">${skill.status === "pending" ? "Pending review ·" : "Reviewed"} version ${skill.version}</span><h1>${escapeHtml(skill.title)}</h1>${Object.entries(labels).filter(([name]) => name !== "title").map(([name, label]) => `<section class="detail-section"><h2>${label}</h2><pre class="detail-text">${escapeHtml(skill[name])}</pre></section>`).join("")}</article>`;
}

async function details(id) {
  shell('<div id="detail-container"><p role="status">Loading skill…</p></div>', "marketplace");
  const container = document.querySelector("#detail-container");
  try {
    const skill = (await api("details", { skill_id: id })).skill;
    document.title = `${skill.title} — Reusable Network`;
    container.innerHTML = `<a class="back-link" href="/marketplace">← Back to marketplace</a>${notice}<div class="detail-layout">${metadata(skill)}<aside class="purchase-panel"><p class="eyebrow plain">A reusable starting point</p><p class="purchase-price">${formatLamports(skill.price_lamports)}</p><dl class="skill-facts"><div><dt>Creator wallet</dt><dd>${escapeHtml(skill.creator_wallet)}</dd></div><div><dt>Version</dt><dd>${skill.version} · SKILL.md</dd></div><div><dt>Network fee</dt><dd>Separate from the skill price</dd></div></dl><button id="buy-skill" class="primary-button" disabled>Sign in to buy</button><button id="check-payment" class="primary-button" hidden>Check payment again</button><button id="download-skill" class="primary-button" hidden>Download SKILL.md</button><p id="purchase-notice" class="small-note" role="status" aria-live="polite">Checking ownership…</p><div id="payment-recovery" hidden><p class="small-note">Keep these references. Contact the site operator if unresolved before sending another payment.</p><pre id="payment-reference" class="detail-text"></pre></div></aside></div>`;
    const buy = document.querySelector("#buy-skill");
    const check = document.querySelector("#check-payment");
    const download = document.querySelector("#download-skill");
    const status = document.querySelector("#purchase-notice");
    let order = null;
    let busy = false;
    let paymentWallet = null;
    let ownershipRevision = 0;
    function orderState() {
      const signature = order && savedSignature(order);
      check.hidden = !signature;
      document.querySelector("#payment-recovery").hidden = !signature;
      document.querySelector("#payment-reference").textContent = signature ? `Order: ${order.id}\nSignature: ${signature}` : "";
      if (signature) { buy.hidden = true; status.textContent = "Signed payment saved. Check it again before paying again."; }
    }
    async function ownership(force = false) {
      const state = authState();
      if (busy && !force && state.wallet === paymentWallet) return;
      const revision = ++ownershipRevision;
      order = null;
      buy.hidden = false;
      buy.disabled = true;
      download.hidden = true;
      check.hidden = true;
      document.querySelector("#payment-recovery").hidden = true;
      if (!state.wallet) { buy.textContent = "Sign in to buy"; buy.disabled = !state.ready; status.textContent = "Sign in with a verified Phantom wallet to buy."; return; }
      try {
        const result = await api("ownership", { skill_id: id });
        if (revision !== ownershipRevision) return;
        buy.hidden = result.owned;
        download.hidden = !result.owned;
        buy.textContent = `Buy · ${formatLamports(skill.price_lamports)}`;
        buy.disabled = false;
        order = result.order;
        status.textContent = result.owned ? "Already owned. Download the exact reviewed version." : "Pay test SOL directly to the creator. A finalized payment unlocks this file.";
        if (!result.owned) orderState();
      } catch (error) { if (revision === ownershipRevision) status.textContent = error.message; }
    }
    onAuthChange(() => ownership());
    buy.onclick = async () => {
      if (busy) return;
      if (!authState().wallet) { try { await signIn(); } catch (error) { status.textContent = error.message; } return; }
      const buyerWallet = authState().wallet;
      paymentWallet = buyerWallet;
      busy = true;
      ++ownershipRevision;
      buy.disabled = true;
      try {
        const activeOrder = (await api("create_order", { skill_id: id })).order;
        if (authState().wallet !== buyerWallet) throw new Error("Wallet changed. Sign in with the original buyer to check its payment.");
        order = activeOrder;
        if (savedSignature(activeOrder)) { orderState(); return; }
        activeOrder.transaction_signature = await payOrder(activeOrder, (message) => { if (authState().wallet === buyerWallet) status.textContent = message; });
        if (authState().wallet !== buyerWallet) throw new Error("Wallet changed. Sign in with the original buyer to check its payment.");
        orderState();
        await checkPayment(activeOrder);
        if (authState().wallet === buyerWallet) await ownership(true);
      } catch (error) {
        if (authState().wallet === buyerWallet) { orderState(); buy.disabled = false; status.textContent = error.code === 4001 ? "Payment cancelled. No purchase was granted." : error.message; }
      } finally {
        busy = false;
        paymentWallet = null;
        if (authState().wallet !== buyerWallet) await ownership();
      }
    };
    check.onclick = async () => {
      if (!order || busy) return;
      const activeOrder = order;
      const buyerWallet = authState().wallet;
      paymentWallet = buyerWallet;
      busy = true;
      ++ownershipRevision;
      check.disabled = true;
      status.textContent = "Checking finalized Devnet payment…";
      try { await checkPayment(activeOrder); if (authState().wallet === buyerWallet) await ownership(true); }
      catch (error) { if (authState().wallet === buyerWallet) status.textContent = error.message; }
      finally { busy = false; paymentWallet = null; check.disabled = false; if (authState().wallet !== buyerWallet) await ownership(); }
    };
    bindDownload(download, id, status);
  } catch (error) { showError(container, error, () => location.reload()); }
}

const exportPrompt = "Create a standalone SKILL.md for the useful workflow I choose. Describe its purpose, when to use it, required tools, inputs, clear steps, expected output, a synthetic example, and limitations. Use placeholders for credentials and environment-specific values. Do not include chat logs, seed phrases, private keys, API tokens, personal data, private URLs, proprietary material I cannot share, or unrelated files. Show me the complete draft for review before I upload anything. Do not claim the workflow is tested unless we actually tested it.";

function submission() {
  document.title = "Submit a skill — Reusable Network";
  shell(`<section class="page-intro"><p class="eyebrow"><span aria-hidden="true"></span>Good work travels</p><h1>Package what <span>worked.</span></h1><p class="page-description">Submit a Markdown skill for admin review. Submitting is not a sale.</p>${notice}${!configured ? '<p class="prototype-notice">Supabase setup is incomplete. Local preview works; uploading is unavailable until setup is complete.</p>' : ""}</section><details class="export-help"><summary>Help your agent draft a safe SKILL.md</summary><p>Choose one workflow, then review the complete file. Suggested sections: purpose, prerequisites, inputs, steps, output, synthetic example, and limitations.</p><pre class="file-preview">${escapeHtml(exportPrompt)}</pre><button id="copy-prompt" class="text-button">Copy prompt</button><a class="text-link" href="/demo/transfer-records/SKILL.md" download="SKILL.md">Download the tested transfer-to-CSV demo</a><p class="small-note">This example is open demo content. Test new files yourself before claiming they are tested.</p></details><div class="submit-layout"><form id="skill-form" class="submit-form"><h2>Tell us about your skill.</h2><p class="small-note">Listing fields and examples become public after approval. Keep full instructions in the file.</p>${Object.entries(labels).map(([name, label]) => `<div class="form-field"><label for="submission-${name}">${label}</label>${name === "title" ? `<input id="submission-${name}" name="${name}" maxlength="${FIELD_LIMITS[name]}" required />` : `<textarea id="submission-${name}" name="${name}" maxlength="${FIELD_LIMITS[name]}" required>${name === "reuse_terms" ? "Use and modify for your own tasks. Do not resell the original file. No warranty." : ""}</textarea>`}</div>`).join("")}<div class="form-row"><div class="form-field"><label for="submission-category">Category</label><select id="submission-category" name="category" required><option value="">Choose a category</option>${options()}</select></div><div class="form-field"><label for="submission-price">Price in Devnet SOL</label><input id="submission-price" name="price" inputmode="decimal" placeholder="0.01" required /><p class="field-help">Greater than zero, maximum 10 SOL; up to 9 decimal places.</p></div></div><div class="form-field upload-field"><label for="skill-file">Upload one SKILL.md</label><p class="field-help">One UTF-8 Markdown file, maximum 100 KB. Previewed as plain text.</p><input id="skill-file" type="file" accept=".md,text/markdown,text/plain" required /><p id="file-error" class="field-error" role="alert" hidden></p></div><label class="checkbox-field"><input id="permission-confirmed" type="checkbox" required />I have permission to share and sell this file, and I removed private information and credentials.</label><p class="small-note">Basic secret checks can miss information. Review the entire file yourself. Uploaded instructions are untrusted and never executed by this website.</p><button id="preview-skill" class="primary-button" type="submit">Preview skill ${arrow}</button></form><aside class="submission-preview"><h2>Your skill, at a glance.</h2><p id="preview-status" class="small-note" role="status" aria-live="polite">Choose SKILL.md to see its contents.</p><section id="listing-preview" class="listing-preview" tabindex="-1" hidden><span class="sample-label">Local draft</span><h3 id="preview-title"></h3><p id="preview-description"></p><div class="preview-meta"><span id="preview-category"></span><strong id="preview-price"></strong></div></section><div class="file-preview-heading"><h3>SKILL.md · plain text</h3><span id="file-size"></span></div><pre id="file-preview" class="file-preview" tabindex="0">No file selected.</pre><button id="submit-skill" class="primary-button" disabled>Submit skill ${arrow}</button><p class="small-note">Submissions stay pending until the configured admin reviews this exact version. Approved files are frozen.</p></aside></div>`, "submit");
  const form = document.querySelector("#skill-form");
  const fileInput = document.querySelector("#skill-file");
  const status = document.querySelector("#preview-status");
  const submit = document.querySelector("#submit-skill");
  const demoHelp = document.createElement("section");
  demoHelp.className = "prototype-notice";
  demoHelp.innerHTML = '<strong>Try your first submission.</strong><p class="small-note">Load the tested transfer-to-CSV file and listing fields. Review the draft, confirm your sharing rights, then submit it for approval. This open demo costs 0.01 test SOL for checkout testing.</p><button id="load-demo" class="text-button" type="button">Use tested demo draft</button>';
  document.querySelector(".export-help").before(demoHelp);
  const demoButton = demoHelp.querySelector("button");
  let file = null;
  let draft = null;
  let readVersion = 0;
  let uploading = false;
  let loadingDemo = false;
  function updateSubmit() { submit.disabled = uploading || loadingDemo || !draft || !file || !authState().wallet || !configured; }
  onAuthChange(updateSubmit);
  document.querySelector("#copy-prompt").onclick = async (event) => {
    try { await navigator.clipboard.writeText(exportPrompt); event.target.textContent = "Prompt copied"; }
    catch { event.target.textContent = "Select and copy the prompt above"; }
  };
  form.oninput = (event) => { event.target.setCustomValidity?.(""); draft = null; document.querySelector("#listing-preview").hidden = true; updateSubmit(); };
  fileInput.onchange = async () => {
    const version = ++readVersion;
    file = null;
    draft = null;
    updateSubmit();
    const errorElement = document.querySelector("#file-error");
    const preview = document.querySelector("#file-preview");
    errorElement.hidden = true;
    fileInput.setCustomValidity("");
    document.querySelector("#listing-preview").hidden = true;
    document.querySelector("#file-size").textContent = "";
    const selected = fileInput.files[0];
    if (!selected) { preview.textContent = "No file selected."; return; }
    try {
      if (selected.size > 102400) throw new Error("SKILL.md must be 100 KB or smaller.");
      const bytes = new Uint8Array(await selected.arrayBuffer());
      if (version !== readVersion) return;
      preview.textContent = validateSkillFile(bytes, selected.name);
      file = selected;
      document.querySelector("#file-size").textContent = `${(bytes.length / 1024).toFixed(1)} KB`;
      status.textContent = "Plain-text file ready. Complete the form to preview your listing.";
    } catch (error) {
      if (version !== readVersion) return;
      fileInput.setCustomValidity(error.message);
      errorElement.textContent = error.message;
      errorElement.hidden = false;
      preview.textContent = "No valid SKILL.md selected.";
    }
  };
  demoButton.onclick = async () => {
    if (uploading || loadingDemo) return;
    loadingDemo = true;
    draft = null;
    document.querySelector("#listing-preview").hidden = true;
    document.querySelector("#permission-confirmed").checked = false;
    updateSubmit();
    demoButton.disabled = true;
    demoButton.textContent = "Loading demo…";
    for (const control of form.elements) control.disabled = true;
    try {
      const response = await fetch("/demo/transfer-records/SKILL.md", { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("The demo file could not load. Try again or choose your own SKILL.md.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      validateSkillFile(bytes, "SKILL.md");
      for (const [name, value] of Object.entries(transferDemoListing)) form.elements.namedItem(name).value = value;
      document.querySelector("#permission-confirmed").checked = false;
      const selected = new DataTransfer();
      selected.items.add(new File([bytes], "SKILL.md", { type: "text/markdown" }));
      fileInput.files = selected.files;
      await fileInput.onchange();
      status.textContent = "Demo draft loaded locally. Review the file and fields, check the sharing confirmation, then click Preview skill.";
    } catch (error) { status.textContent = error.message; }
    finally {
      loadingDemo = false;
      demoButton.disabled = false;
      demoButton.textContent = "Use tested demo draft";
      for (const control of form.elements) control.disabled = false;
      updateSubmit();
    }
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    if (!form.reportValidity() || !file) return;
    try {
      const input = Object.fromEntries(new FormData(form));
      input.permission_confirmed = document.querySelector("#permission-confirmed").checked;
      const listing = validateListing(input);
      draft = input;
      for (const name of ["title", "description", "category"]) document.querySelector(`#preview-${name}`).textContent = listing[name];
      document.querySelector("#preview-price").textContent = formatLamports(listing.price_lamports);
      document.querySelector("#listing-preview").hidden = false;
      document.querySelector("#listing-preview").focus();
      status.textContent = authState().wallet ? "Preview ready. Submit to pending review when satisfied." : "Local preview ready. Connect and sign in with Phantom to submit.";
      updateSubmit();
    } catch (error) { status.textContent = error.message; }
  };
  submit.onclick = async () => {
    if (!draft || !file || uploading) return;
    uploading = true;
    updateSubmit();
    status.textContent = "Uploading for review…";
    for (const control of form.elements) control.disabled = true;
    try {
      await submitSkill(draft, file);
      status.textContent = "Submitted. Status: pending review. View your submission in Account.";
      draft = null;
      const link = document.createElement("a");
      link.href = "/account";
      link.className = "text-link";
      link.textContent = "View my skills";
      status.after(link);
    } catch (error) { status.textContent = error.message; }
    finally { uploading = false; for (const control of form.elements) control.disabled = false; updateSubmit(); }
  };
}

function bindDownload(button, id, status) {
  button.onclick = async () => {
    button.disabled = true;
    status.textContent = "Preparing your reviewed SKILL.md…";
    try { await downloadSkill(id); status.textContent = "Download ready. Review instructions before using them in your agent."; }
    catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  };
}

function account() {
  document.title = "Account — Reusable Network";
  shell(`<section class="page-intro"><h1>Your reusable <span>work.</span></h1>${notice}<button id="sign-out" class="text-button" hidden>Sign out</button></section><div id="account-content"></div>`, "account");
  const content = document.querySelector("#account-content");
  document.querySelector("#sign-out").onclick = signOut;
  onAuthChange(async (state) => {
    const revision = ++accountRevision;
    document.querySelector("#sign-out").hidden = !state.wallet;
    content.innerHTML = `<p>${state.ready ? "Connect and sign in with Phantom to see your skills and purchases." : "Checking session…"}</p>`;
    if (!state.wallet) return;
    content.innerHTML = '<p role="status">Loading your account…</p>';
    try {
      const data = await api("account");
      if (revision !== accountRevision) return;
      content.innerHTML = `<section class="account-section"><h2>My skills</h2>${data.skills.length ? data.skills.map((s) => `<article class="account-card"><h3>${escapeHtml(s.title)}</h3><span class="sample-label">${escapeHtml(s.status)}</span><p>${escapeHtml(s.review_reason || "Reviewed versions are frozen. Pending versions await admin review.")}</p>${s.status === "approved" ? `<a class="text-link" href="/skill?id=${s.id}">View listing</a>` : ""}<button class="text-button" data-download="${s.id}">Download my file</button><p class="download-status small-note" role="status"></p></article>`).join("") : "<p>No submissions yet.</p>"}</section><section class="account-section"><h2>My purchases</h2>${data.purchases.length ? data.purchases.map((p) => `<article class="account-card"><h3>${escapeHtml(p.skills.title)}</h3><p>Purchased version ${p.version}</p><button class="primary-button" data-download="${p.skill_id}">Download SKILL.md</button><p class="download-status small-note" role="status"></p></article>`).join("") : "<p>No verified purchases yet.</p>"}</section><section class="account-section"><h2>Payments awaiting verification</h2><p class="small-note">Check again before sending another payment.</p>${data.orders.length ? data.orders.map((o) => `<article class="account-card"><pre class="detail-text">Order: ${o.id}\nSignature: ${escapeHtml(o.transaction_signature)}</pre><a class="text-link" href="/skill?id=${o.skill_id}">Check payment again</a></article>`).join("") : "<p>No saved pending payments.</p>"}</section>`;
      content.querySelectorAll("[data-download]").forEach((b) => bindDownload(b, b.dataset.download, b.parentElement.querySelector(".download-status")));
    } catch (error) { if (revision === accountRevision) showError(content, error, () => location.reload()); }
  });
}

function admin() {
  document.title = "Review — Reusable Network";
  shell(`<section class="page-intro"><h1>Review a <span>starting point.</span></h1>${notice}<p class="small-note">Instructions are untrusted. Read as text; never execute them. Approval publishes metadata and freezes the file.</p></section><div id="admin-content"></div><div id="admin-preview"></div>`, "admin");
  const content = document.querySelector("#admin-content");
  const preview = document.querySelector("#admin-preview");
  onAuthChange(async (state) => {
    const revision = ++accountRevision;
    preview.replaceChildren();
    content.innerHTML = "<p>Sign in with the explicitly configured admin wallet to review submissions.</p>";
    if (!state.isAdmin) return;
    try {
      const data = await api("admin_list");
      if (revision !== accountRevision) return;
      content.innerHTML = data.skills.length ? data.skills.map((s) => `<article class="account-card"><h2>${escapeHtml(s.title)}</h2><p>${escapeHtml(s.description)}</p><button class="text-button" data-review="${s.id}">Review exact file</button></article>`).join("") : "<p>No pending submissions.</p>";
      content.querySelectorAll("[data-review]").forEach((button) => { button.onclick = async () => {
        try {
          const result = await api("admin_preview", { skill_id: button.dataset.review });
          if (revision !== accountRevision || !authState().isAdmin) return;
          preview.innerHTML = `<article class="submission-preview">${metadata(result.skill)}<p class="small-note">Creator: ${escapeHtml(result.skill.creator_wallet)} · ${formatLamports(result.skill.price_lamports)}</p><h2>Exact SKILL.md</h2><p class="small-note">SHA-256: ${escapeHtml(result.file.content_hash)} · ${result.file.byte_size} bytes</p><pre id="admin-file" class="file-preview" tabindex="0"></pre><div class="form-field"><label for="review-reason">Review reason (required for rejection)</label><textarea id="review-reason" maxlength="1000"></textarea></div><label class="checkbox-field"><input id="review-confirm" type="checkbox" />I reviewed this exact file, examples, requirements, rights, and limitations.</label><div class="review-actions"><button id="approve" class="primary-button">Approve</button><button id="reject" class="primary-button">Reject</button></div><p id="review-status" role="status" class="small-note"></p></article>`;
          preview.querySelector("#admin-file").textContent = result.text;
          for (const [name, status] of [["approve", "approved"], ["reject", "rejected"]]) preview.querySelector(`#${name}`).onclick = async () => {
            const message = preview.querySelector("#review-status");
            if (!preview.querySelector("#review-confirm").checked) { message.textContent = "Confirm you reviewed the exact file first."; return; }
            preview.querySelectorAll("button").forEach((b) => { b.disabled = true; });
            try {
              await api("review", { skill_id: result.skill.id, status, reason: preview.querySelector("#review-reason").value, content_hash: result.file.content_hash });
              message.textContent = `Submission ${status}. Reload to review the next file.`;
              button.closest(".account-card").remove();
            } catch (error) { message.textContent = error.message; preview.querySelectorAll("button").forEach((b) => { b.disabled = false; }); }
          };
          preview.scrollIntoView({ behavior: "smooth" });
        } catch (error) { showError(preview, error); }
      }; });
    } catch (error) { if (revision === accountRevision) showError(content, error, () => location.reload()); }
  });
}

export async function showPage(path) {
  if (path === "/examples" || path.startsWith("/examples/") || path.startsWith("/marketplace/")) {
    const { showSamplePage } = await import("./sample-pages.js");
    return showSamplePage(path.replace("/marketplace/", "/examples/"));
  }
  if (path === "/marketplace") return marketplace();
  if (path === "/skill") return details(new URLSearchParams(location.search).get("id"));
  if (path === "/submit") return submission();
  if (path === "/account") return account();
  if (path === "/admin") return admin();
  document.title = "Page not found — Reusable Network";
  shell('<section class="page-intro not-found"><p class="eyebrow plain">Page not found</p><h1>Let’s find your <span>next skill.</span></h1><a class="primary-button" href="/marketplace">Explore skills</a></section>');
}
