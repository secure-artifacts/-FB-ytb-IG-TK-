document.addEventListener("DOMContentLoaded", () => {
  // ── 元素引用 ──────────────────────────────────────────────────────────────
  const gasInput      = document.getElementById("gas-url");
  const sheetInput    = document.getElementById("sheet-id");
  const folderInput   = document.getElementById("folder-id");
  const sheetNameInput= document.getElementById("sheet-name");
  const catContainer  = document.getElementById("cat-container");
  const catCsv        = document.getElementById("cat-csv");
  const newCatInput   = document.getElementById("new-cat-input");
  const addCatBtn     = document.getElementById("add-cat-btn");
  const copyCatsBtn   = document.getElementById("copy-cats-btn");
  const statusMsg     = document.getElementById("status-msg");

  const optDownload   = document.getElementById("opt-download");
  const optFolder     = document.getElementById("opt-folder");
  const optNotes      = document.getElementById("opt-notes");
  const optUrl        = document.getElementById("opt-url");

  const exportBtn     = document.getElementById("export-btn");
  const copyConfigBtn = document.getElementById("copy-config-btn");
  const exportArea    = document.getElementById("export-area");
  const importArea    = document.getElementById("import-area");
  const importBtn     = document.getElementById("import-btn");
  const clearImportBtn= document.getElementById("clear-import-btn");

  // ── Tab 切换 ──────────────────────────────────────────────────────────────
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  // ── 所有 storage key 列表 ─────────────────────────────────────────────────
  const ALL_KEYS = ["gasUrl", "sheetId", "folderId", "sheetName", "categories", "layoutMode",
                    "optDownload", "optFolder", "optNotes", "optUrl"];

  // ── 初始化加载 ────────────────────────────────────────────────────────────
  chrome.storage.local.get(ALL_KEYS, (data) => {
    if (data.gasUrl)    gasInput.value       = data.gasUrl;
    if (data.sheetId)   sheetInput.value     = data.sheetId;
    if (data.folderId)  folderInput.value    = data.folderId;
    if (data.sheetName) sheetNameInput.value = data.sheetName;

    // 字段开关（默认全开）
    optDownload.checked = data.optDownload !== false;
    optFolder.checked   = data.optFolder   !== false;
    optNotes.checked    = data.optNotes    !== false;
    optUrl.checked      = data.optUrl      !== false;

    // 排列方向
    setLayout(data.layoutMode || "horizontal", false);

    // 分类
    const categories = data.categories || ["默认", "灵感素材", "竞品分析", "视频剪辑"];
    renderCategories(categories);
  });

  // ── 通用提示 ──────────────────────────────────────────────────────────────
  function showStatus(text, color = "green") {
    statusMsg.textContent = text;
    statusMsg.style.color = color;
    setTimeout(() => { if (statusMsg.textContent === text) statusMsg.textContent = ""; }, 2000);
  }

  // ── 基础配置实时保存 ──────────────────────────────────────────────────────
  gasInput.addEventListener("input",       e => chrome.storage.local.set({ gasUrl:    e.target.value.trim() }, () => showStatus("⚡ 已保存")));
  sheetInput.addEventListener("input",     e => chrome.storage.local.set({ sheetId:   e.target.value.trim() }, () => showStatus("⚡ 已保存")));
  folderInput.addEventListener("input",    e => chrome.storage.local.set({ folderId:  e.target.value.trim() }, () => showStatus("⚡ 已保存")));
  sheetNameInput.addEventListener("input", e => chrome.storage.local.set({ sheetName: e.target.value.trim() }, () => showStatus("⚡ 已保存")));

  // ── 字段开关保存 ──────────────────────────────────────────────────────────
  optDownload.addEventListener("change", e => chrome.storage.local.set({ optDownload: e.target.checked }, () => showStatus("⚡ 已保存")));
  optFolder.addEventListener("change",   e => chrome.storage.local.set({ optFolder:   e.target.checked }, () => showStatus("⚡ 已保存")));
  optNotes.addEventListener("change",    e => chrome.storage.local.set({ optNotes:    e.target.checked }, () => showStatus("⚡ 已保存")));
  optUrl.addEventListener("change",      e => chrome.storage.local.set({ optUrl:      e.target.checked }, () => showStatus("⚡ 已保存")));

  // ── 排列方向 ──────────────────────────────────────────────────────────────
  function setLayout(mode, save) {
    document.getElementById("layout-horizontal").classList.toggle("active", mode === "horizontal");
    document.getElementById("layout-vertical").classList.toggle("active", mode === "vertical");
    if (save !== false) {
      chrome.storage.local.set({ layoutMode: mode }, () => showStatus("⚡ 已切换为" + (mode === "horizontal" ? "横排" : "竖排") + "模式"));
    }
  }

  // 绑定布局按钮（不用 inline onclick，避免扩展 CSP 拦截）
  document.querySelectorAll(".layout-btn").forEach(btn => {
    btn.addEventListener("click", () => setLayout(btn.dataset.layout));
  });

  // ── 分类渲染 ──────────────────────────────────────────────────────────────
  function renderCategories(list) {
    catContainer.innerHTML = "";
    list.forEach((cat, index) => {
      const tag = document.createElement("div");
      tag.className = "cat-tag";
      tag.textContent = cat;

      const del = document.createElement("span");
      del.className = "cat-del";
      del.innerHTML = "&times;";
      del.title = "删除";
      del.addEventListener("click", () => removeCategory(index));
      tag.appendChild(del);
      catContainer.appendChild(tag);
    });

    // 更新逗号分隔文本框
    catCsv.value = list.join(", ");
  }

  // 复制分类列表
  copyCatsBtn.addEventListener("click", () => {
    catCsv.select();
    document.execCommand("copy");
    showStatus("✅ 分类列表已复制！");
    copyCatsBtn.textContent = "✓ 已复制";
    setTimeout(() => { copyCatsBtn.textContent = "复制"; }, 1500);
  });

  // 新增分类
  addCatBtn.addEventListener("click", addCategory);
  newCatInput.addEventListener("keydown", e => { if (e.key === "Enter") addCategory(); });

  function addCategory() {
    const val = newCatInput.value.trim();
    if (!val) return;

    chrome.storage.local.get(["categories"], (data) => {
      let list = data.categories || ["默认", "灵感素材", "竞品分析", "视频剪辑"];
      if (!list.includes(val)) {
        list.push(val);
        chrome.storage.local.set({ categories: list }, () => {
          renderCategories(list);
          newCatInput.value = "";
          showStatus("✅ 已添加：" + val);
        });
      } else {
        showStatus("⚠️ 该分类已存在", "#d93025");
      }
    });
  }

  function removeCategory(index) {
    chrome.storage.local.get(["categories"], (data) => {
      let list = data.categories || ["默认", "灵感素材", "竞品分析", "视频剪辑"];
      list.splice(index, 1);
      chrome.storage.local.set({ categories: list }, () => {
        renderCategories(list);
        showStatus("🗑️ 已删除", "#d93025");
      });
    });
  }

  // ── 导出配置 ──────────────────────────────────────────────────────────────
  exportBtn.addEventListener("click", () => {
    chrome.storage.local.get(ALL_KEYS, (data) => {
      const config = {
        _note: "智能截图助手 Pro v2.0 配置文件 — 导出时间：" + new Date().toLocaleString("zh-CN"),
        gasUrl:      data.gasUrl || "",
        sheetId:     data.sheetId || "",
        folderId:    data.folderId || "",
        sheetName:   data.sheetName || "",
        categories:  data.categories || ["默认", "灵感素材", "竞品分析", "视频剪辑"],
        layoutMode:  data.layoutMode || "horizontal",
        optDownload: data.optDownload !== false,
        optFolder:   data.optFolder   !== false,
        optNotes:    data.optNotes    !== false,
        optUrl:      data.optUrl      !== false
      };
      exportArea.value = JSON.stringify(config, null, 2);
      exportArea.removeAttribute("readonly");
      showStatus("✅ 配置已生成，点击「复制配置」分享给他人");
    });
  });

  copyConfigBtn.addEventListener("click", () => {
    if (!exportArea.value) {
      exportBtn.click();
      setTimeout(() => doCopyConfig(), 300);
    } else {
      doCopyConfig();
    }
  });

  function doCopyConfig() {
    exportArea.select();
    document.execCommand("copy");
    showStatus("✅ 配置已复制到剪贴板！");
    copyConfigBtn.textContent = "✓ 已复制";
    setTimeout(() => { copyConfigBtn.textContent = "⚡ 复制配置"; }, 1500);
  }

  // ── 导入配置 ──────────────────────────────────────────────────────────────
  clearImportBtn.addEventListener("click", () => { importArea.value = ""; });

  importBtn.addEventListener("click", () => {
    const raw = importArea.value.trim();
    if (!raw) {
      showStatus("⚠️ 请先粘贴配置 JSON", "#d93025");
      return;
    }
    let config;
    try {
      config = JSON.parse(raw);
    } catch (e) {
      showStatus("❌ JSON 格式错误，请检查", "#d93025");
      return;
    }

    const toSave = {};
    if (config.gasUrl)      toSave.gasUrl      = config.gasUrl;
    if (config.sheetId)     toSave.sheetId     = config.sheetId;
    if (config.folderId)    toSave.folderId    = config.folderId;
    if (config.sheetName !== undefined) toSave.sheetName = config.sheetName;
    if (config.categories)  toSave.categories  = config.categories;
    if (config.layoutMode)  toSave.layoutMode  = config.layoutMode;
    if (typeof config.optDownload === "boolean") toSave.optDownload = config.optDownload;
    if (typeof config.optFolder   === "boolean") toSave.optFolder   = config.optFolder;
    if (typeof config.optNotes    === "boolean") toSave.optNotes    = config.optNotes;
    if (typeof config.optUrl      === "boolean") toSave.optUrl      = config.optUrl;

    chrome.storage.local.set(toSave, () => {
      // 刷新界面
      if (toSave.gasUrl)       gasInput.value       = toSave.gasUrl;
      if (toSave.sheetId)      sheetInput.value     = toSave.sheetId;
      if (toSave.folderId)     folderInput.value    = toSave.folderId;
      if (toSave.sheetName !== undefined) sheetNameInput.value = toSave.sheetName;
      if (toSave.categories)  renderCategories(toSave.categories);
      if (toSave.layoutMode)  setLayout(toSave.layoutMode, false);
      if (typeof toSave.optDownload === "boolean") optDownload.checked = toSave.optDownload;
      if (typeof toSave.optFolder   === "boolean") optFolder.checked   = toSave.optFolder;
      if (typeof toSave.optNotes    === "boolean") optNotes.checked    = toSave.optNotes;
      if (typeof toSave.optUrl      === "boolean") optUrl.checked      = toSave.optUrl;

      importArea.value = "";
      showStatus("✅ 配置导入成功！请刷新目标网页生效");
    });
  });
});
