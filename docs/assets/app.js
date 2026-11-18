"use strict";
/**
 * Public ATLAS UI only. It intentionally does not include regional fee data,
 * per-procedure counts, full code tables, credentials, or private API tokens.
 *
 * Future protected API contract (outside GitHub Pages):
 *   GET /v1/regions?pref=13
 *   GET /v1/areas/{area_code}/summary?scope=include
 *   GET /v1/procedures?q=D215
 * Backend MUST authorize each request, return only allowed fields, rate limit,
 * and set Cache-Control: private, no-store. A browser password alone isn't protection.
 */
const categories = [
  ["A", "基本診療料"],
  ["B", "医学管理等"],
  ["C", "在宅医療"],
  ["D", "検査"],
  ["E", "画像診断"],
  ["F", "投薬"],
  ["G", "注射"],
  ["H", "リハビリテーション"],
  ["I", "精神科専門療法"],
  ["J", "処置"],
  ["K", "手術"],
  ["K2", "輸血料"],
  ["L", "麻酔"],
  ["M", "放射線治療"],
  ["N", "病理診断"],
  ["O", "その他"]
];

function byId(id) { return document.getElementById(id); }
function formatNumber(n) {
  return typeof n === "number" && Number.isSafeInteger(n)
    ? n.toLocaleString("ja-JP") : "—";
}

async function loadPublicManifest() {
  try {
    const response = await fetch("./assets/public-manifest.json", {cache:"no-cache"});
    if (!response.ok) throw new Error("Failed to fetch overview metadata");
    const data = await response.json();
    if (data.type !== "public-overview" || data.includes_protected_data !== false) {
      throw new Error("Invalid published manifest");
    }
    byId("meta-codes").textContent = formatNumber(data.procedure_code_count);
    byId("meta-areas").textContent = formatNumber(data.secondary_area_count);
    byId("meta-fy").textContent = typeof data.fiscal_year === "number"
      ? String(data.fiscal_year) + "年度" : "—";
    byId("api-status").textContent = "DATA LAYER: PROTECTED / SEPARATE SITE";
  } catch (error) {
    console.warn("Could not load public metadata", error);
    byId("api-status").textContent = "PUBLIC METADATA: NOT AVAILABLE";
  }
}

const panels = new Set(["region", "procedure", "compare", "sources"]);
function setTab(tab, setHash = true) {
  if (!panels.has(tab)) tab = "region";
  document.querySelectorAll(".tab").forEach(b => {
    if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  for (const name of panels) {
    byId("panel-" + name).hidden = name !== tab;
  }
  if (setHash) history.replaceState(null, "", "#" + tab);
}

function renderCategories() {
  const grid = byId("category-grid");
  const select = byId("category-select");
  for (const [key, title] of categories) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = (key === "K2" ? "K" : key) + "｜" + title;
    select.append(opt);

    const button = document.createElement("button");
    button.className = "category-btn";
    button.type = "button";
    button.dataset.category = key;
    const headline = document.createElement("strong");
    headline.textContent = key === "K2" ? "K" : key;
    const text = document.createElement("span");
    text.textContent = title;
    const small = document.createElement("small");
    small.textContent = "分類を選択";
    button.append(headline, text, small);
    button.addEventListener("click", () => {
      select.value = key;
      onCategoryChanged();
    });
    grid.append(button);
  }
  select.addEventListener("change", onCategoryChanged);
}

function onCategoryChanged() {
  const select = byId("category-select");
  const chosen = categories.find(x => x[0] === select.value);
  byId("category-hint").textContent = "現在の選択：" +
    (chosen ? chosen[1] : "全区分") + "（詳細金額は認証API接続後に表示）";
  document.querySelectorAll(".category-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.category === select.value);
    b.setAttribute("aria-pressed", String(b.dataset.category === select.value));
  });
}

function searchProcedure() {
  const query = byId("procedure-query").value.trim();
  const feedback = byId("procedure-feedback");
  feedback.textContent = query
    ? "「" + query + "」の明細は非公開です。現在は検索用APIが未接続のため、データを返していません。"
    : "コードまたは診療行為名を入力してください。";
}

function init() {
  for (const button of document.querySelectorAll(".tab")) {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  }
  renderCategories();
  byId("procedure-search").addEventListener("click", searchProcedure);
  byId("procedure-query").addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchProcedure();
  });
  window.addEventListener("hashchange", () => setTab(location.hash.slice(1), false));
  setTab(location.hash.slice(1), false);
  loadPublicManifest();
}
document.addEventListener("DOMContentLoaded", init);
