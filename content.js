if (!window.fbsHasRun) {
  window.fbsHasRun = true;
  initScreenshotTool();
}

function initScreenshotTool() {
  createFloatingBar();
}

// ── 平台检测 ──────────────────────────────────────────────────
function detectPlatform() {
  const h = location.hostname;
  if (h.includes("facebook.com"))  return { name: "Facebook",  icon: "📘" };
  if (h.includes("youtube.com"))   return { name: "YouTube",   icon: "▶️"  };
  if (h.includes("instagram.com")) return { name: "Instagram", icon: "📷" };
  if (h.includes("tiktok.com"))    return { name: "TikTok",    icon: "🎵" };
  if (h.includes("pinterest.com")) return { name: "Pinterest", icon: "📌" };
  if (h.includes("behance.net"))   return { name: "Behance",   icon: "🎨" };
  if (h.includes("dribbble.com"))  return { name: "Dribbble",  icon: "🏀" };
  if (h.includes("flickr.com"))    return { name: "Flickr",    icon: "🌄" };
  return { name: "Web", icon: "🌐" };
}

// ── 悬浮工具栏 ────────────────────────────────────────────────
function createFloatingBar() {
  if (document.getElementById("fbs-float-bar")) return;
  const platform = detectPlatform();

  const bar = document.createElement("div");
  bar.id = "fbs-float-bar";

  const badge = document.createElement("div");
  badge.textContent = platform.icon;
  badge.style.cssText = "font-size:14px;text-align:center;padding:2px 0 4px 0;cursor:default;";
  bar.appendChild(badge);

  const handle = document.createElement("div");
  handle.id = "fbs-drag-handle";
  [1,2].forEach(() => { const l = document.createElement("div"); l.className = "fbs-drag-line"; handle.appendChild(l); });
  bar.appendChild(handle);

  const btnVideo = createBarBtn("🎥", "截取当前视频", handleVideoCapture);
  const btnArea  = createBarBtn("✂️", "自由框选截图",  handleAreaCapture);
  bar.appendChild(btnVideo);
  bar.appendChild(btnArea);

  document.body.appendChild(bar);
  makeElementDraggable(bar, handle);
}

function createBarBtn(icon, tip, handler) {
  const btn = document.createElement("button");
  btn.className = "fbs-float-btn";
  btn.textContent = icon;
  const tooltip = document.createElement("span");
  tooltip.className = "fbs-tooltip";
  tooltip.textContent = tip;
  btn.appendChild(tooltip);
  btn.addEventListener("click", handler);
  return btn;
}

// ── 拖拽 ──────────────────────────────────────────────────────
function makeElementDraggable(elm, handle) {
  let pos2 = 0, pos4 = 0;
  handle.onmousedown = function(e) {
    e.preventDefault();
    pos4 = e.clientY;
    document.onmouseup   = () => { document.onmouseup = null; document.onmousemove = null; };
    document.onmousemove = function(e) {
      e.preventDefault();
      pos2 = pos4 - e.clientY; pos4 = e.clientY;
      let t = Math.max(10, Math.min(elm.offsetTop - pos2, window.innerHeight - 150));
      elm.style.top = t + "px";
    };
  };
}

// ── 视频查找 ──────────────────────────────────────────────────
function findActiveVideo() {
  const videos = Array.from(document.querySelectorAll("video"));
  if (!videos.length) return null;
  for (const v of videos) {
    const r = v.getBoundingClientRect();
    const inView = r.top >= 0 && r.bottom <= window.innerHeight && r.width > 0;
    if (inView && !v.paused) return v;
  }
  for (const v of videos) { if (!v.paused) return v; }
  return videos.reduce((best, v) => {
    const r = v.getBoundingClientRect();
    const a = r.width * r.height;
    return a > (best ? best.getBoundingClientRect().width * best.getBoundingClientRect().height : 0) ? v : best;
  }, null);
}

// ── 页面标题 ──────────────────────────────────────────────────
function getPageTitle() {
  const sel = [
    "h1.ytd-video-primary-info-renderer",
    "yt-formatted-string.ytd-video-primary-info-renderer",
    "[data-e2e='browse-video-desc']",
    ".video-meta-title"
  ];
  for (const s of sel) {
    const el = document.querySelector(s);
    if (el) return el.textContent.trim();
  }
  return document.title || "截图";
}

// ── 视频截图 ──────────────────────────────────────────────────
function handleVideoCapture() {
  const video = findActiveVideo();
  if (!video) { alert("❌ 未检测到视频，切换为框选截图"); handleAreaCapture(); return; }
  const rect = video.getBoundingClientRect();
  captureAndShow({ title: getPageTitle(), url: location.href, platform: detectPlatform().name,
    rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    vw: window.innerWidth, vh: window.innerHeight }, handleVideoCapture);
}

// ── 框选截图 ──────────────────────────────────────────────────
function handleAreaCapture() {
  const overlay = document.createElement("div");
  overlay.id = "fbs-select-overlay";
  const box = document.createElement("div");
  box.id = "fbs-select-box";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let sx = 0, sy = 0, drawing = false;
  overlay.addEventListener("mousedown", e => {
    drawing = true; sx = e.clientX; sy = e.clientY;
    box.style.cssText = "display:block;left:"+sx+"px;top:"+sy+"px;width:0;height:0;";
  });
  overlay.addEventListener("mousemove", e => {
    if (!drawing) return;
    box.style.width  = Math.abs(e.clientX - sx) + "px";
    box.style.height = Math.abs(e.clientY - sy) + "px";
    box.style.left   = Math.min(e.clientX, sx) + "px";
    box.style.top    = Math.min(e.clientY, sy) + "px";
  });
  overlay.addEventListener("mouseup", e => {
    if (!drawing) return; drawing = false;
    const rect = { x: Math.min(sx, e.clientX), y: Math.min(sy, e.clientY),
                   width: Math.abs(sx - e.clientX), height: Math.abs(sy - e.clientY) };
    overlay.remove();
    if (rect.width > 10 && rect.height > 10) {
      captureAndShow({ title: getPageTitle(), url: location.href,
        platform: detectPlatform().name, rect, vw: window.innerWidth, vh: window.innerHeight },
        handleAreaCapture);
    }
  });
}

// ── 截图裁剪 ──────────────────────────────────────────────────
function captureAndShow(info, captureAgain) {
  chrome.runtime.sendMessage({ action: "captureTab" }, (res) => {
    if (!res || !res.success) { alert("❌ 截图失败，请刷新页面重试"); return; }
    const img = new Image();
    img.src = res.dataUrl;
    img.onload = function() {
      const canvas = document.createElement("canvas");
      canvas.width = info.rect.width; canvas.height = info.rect.height;
      const ctx = canvas.getContext("2d");
      const sx = img.width  / info.vw;
      const sy = img.height / info.vh;
      ctx.drawImage(img, info.rect.x * sx, info.rect.y * sy,
        info.rect.width * sx, info.rect.height * sy, 0, 0, info.rect.width, info.rect.height);
      showSaveModal(canvas.toDataURL("image/jpeg", 0.9), info, captureAgain);
    };
  });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(text, color) {
  let t = document.getElementById("fbs-toast");
  if (!t) { t = document.createElement("div"); t.id = "fbs-toast"; document.body.appendChild(t); }
  t.textContent = text;
  t.className = "fbs-toast-show";
  t.style.backgroundColor = color || "rgba(0,0,0,0.85)";
  if (window._fbsToast) clearTimeout(window._fbsToast);
  window._fbsToast = setTimeout(() => {
    t.className = "fbs-toast-hide";
    setTimeout(() => t.remove(), 400);
  }, 3000);
}

// ── 保存弹窗 ──────────────────────────────────────────────────
function showSaveModal(base64, info, captureAgain) {
  const existing = document.getElementById("fbs-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "fbs-modal";

  // 标题栏
  const titleBar = document.createElement("div");
  titleBar.className = "fbs-modal-title";
  titleBar.innerHTML = "<span>💡 截图保存 · " + (info.platform || "Web") + "</span>";
  const closeBtn = document.createElement("span");
  closeBtn.className = "fbs-modal-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => modal.remove());
  titleBar.appendChild(closeBtn);
  modal.appendChild(titleBar);

  // 预览图
  const preview = document.createElement("div");
  preview.className = "fbs-preview-container";
  const img = document.createElement("img");
  img.className = "fbs-preview-img";
  img.src = base64;
  preview.appendChild(img);
  modal.appendChild(preview);

  // 分类选择
  const catLabel = document.createElement("div");
  catLabel.className = "fbs-label";
  catLabel.textContent = "选择类别";
  modal.appendChild(catLabel);

  const catRow = document.createElement("div");
  catRow.style.cssText = "display:flex;gap:6px;margin-bottom:10px;";
  const selectCat = document.createElement("select");
  selectCat.className = "fbs-input";
  selectCat.style.cssText = "margin-bottom:0!important;flex:1;";
  const addCatInline = document.createElement("button");
  addCatInline.className = "fbs-btn fbs-btn-sec";
  addCatInline.style.cssText = "padding:0 12px!important;";
  addCatInline.textContent = "+";
  catRow.appendChild(selectCat);
  catRow.appendChild(addCatInline);
  modal.appendChild(catRow);

  // 备注（按开关）
  const notesLabel = document.createElement("div");
  notesLabel.className = "fbs-label";
  notesLabel.textContent = "随手记";
  const notesText = document.createElement("textarea");
  notesText.className = "fbs-input";
  notesText.rows = 3;
  notesText.placeholder = "写点灵感...";

  // 按钮
  const btnRow = document.createElement("div");
  btnRow.className = "fbs-btn-row";
  const cancelBtn   = document.createElement("button");
  cancelBtn.className = "fbs-btn fbs-btn-sec";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => modal.remove());
  const continueBtn = document.createElement("button");
  continueBtn.className = "fbs-btn fbs-btn-green";
  continueBtn.textContent = "💾 保存并继续截图";
  const submitBtn   = document.createElement("button");
  submitBtn.className = "fbs-btn";
  submitBtn.textContent = "上传";
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(continueBtn);
  btnRow.appendChild(submitBtn);

  const stateDiv = document.createElement("div");
  stateDiv.id = "fbs-state";

  // OCR 识别文字开关
  const ocrRow      = document.createElement("div");
  ocrRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:8px;";
  const ocrCheck    = document.createElement("input");
  ocrCheck.type     = "checkbox";
  ocrCheck.id       = "fbs-ocr-check";
  ocrCheck.style.cssText = "width:14px;height:14px;cursor:pointer;accent-color:#1877f2;flex-shrink:0;";
  const ocrLbl      = document.createElement("label");
  ocrLbl.htmlFor    = "fbs-ocr-check";
  ocrLbl.style.cssText = "font-size:12px;color:#1c1e21;cursor:pointer;flex:1;";
  ocrLbl.textContent = "🔍 识别图片文字（自动填入备注）";
  const ocrSpin     = document.createElement("span");
  ocrSpin.style.cssText = "font-size:11px;color:#1877f2;display:none;";
  ocrSpin.textContent   = "识别中...";
  ocrRow.appendChild(ocrCheck);
  ocrRow.appendChild(ocrLbl);
  ocrRow.appendChild(ocrSpin);

  // 根据 optNotes 开关决定是否显示备注框
  chrome.storage.local.get(["optNotes", "categories", "lastSelectedCategory", "catDateMode",
    "visionKey", "ocrUsed", "ocrLimit", "ocrMonth", "ocrAutoCheck", "groqKey"], (data) => {
    if (data.optNotes !== false) {
      modal.appendChild(notesLabel);

      // 始终显示 OCR 开关（无 Key 时自动使用 helloworld 公共测试 Key）
      const monthKey = new Date().getFullYear() + "-" +
        String(new Date().getMonth() + 1).padStart(2, "0");
      const used  = (data.ocrMonth === monthKey) ? (data.ocrUsed || 0) : 0;
      const limit = data.ocrLimit || 25000;

      if (used < limit) {
        modal.appendChild(ocrRow);
        ocrCheck.addEventListener("change", () => {
          if (!ocrCheck.checked) { ocrLbl.textContent = "🔍 识别图片文字（自动填入备注）"; return; }
          ocrSpin.style.display = "inline";
          ocrCheck.disabled = true;
          // 无 Key 时传空字符串，background.js 会自动 fallback 到 helloworld
          const apiKey = (data.visionKey && data.visionKey.trim()) ? data.visionKey.trim() : "";
          chrome.runtime.sendMessage({
            action: "recognizeText", imageBase64: base64, apiKey
          }, (res) => {
            ocrSpin.style.display = "none";
            ocrCheck.disabled = false;
            if (res && res.success) {
              if (res.empty) {
                ocrLbl.textContent = "🔍 未识别到文字";
              } else {
                notesText.value = res.text;
                const groqKey = (data.groqKey || "").trim();
                // 总是尝试翻译：无 Key → Google Translate（免费），有 Key → Groq（AI 翻译）
                ocrLbl.textContent = "🔄 翻译中...";
                chrome.runtime.sendMessage({ action: "translateText", text: res.text, groqKey }, (tr) => {
                  if (tr && tr.success && tr.zh) {
                    notesText.value = tr.zh + "\n----------\n" + res.text;
                    ocrLbl.textContent = "✅ 识别+翻译完成（本月剩余 " + res.ocrRemain + " 次）";
                  } else {
                    // 翻译失败时只显示原文
                    ocrLbl.textContent = "✅ 识别完成（本月剩余 " + res.ocrRemain + " 次）";
                  }
                });
              }
            } else {
              ocrLbl.textContent = "❌ " + (res?.error || "识别失败");
              ocrCheck.checked   = false;
            }
          });
        });
        // 默认勾选 OCR 并自动触发识别（可在「选项」中关闭）
        if (data.ocrAutoCheck !== false) {
          ocrCheck.checked = true;
          ocrCheck.dispatchEvent(new Event("change"));
        }
      } else {
        const tip = document.createElement("div");
        tip.style.cssText = "font-size:11px;color:#d93025;margin-bottom:6px;";
        tip.textContent = "⚠️ 本月 OCR 额度已用完（" + used + "/" + limit + " 次）";
        modal.appendChild(tip);
      }

      modal.appendChild(notesText);
    }
    modal.appendChild(btnRow);
    modal.appendChild(stateDiv);
    document.body.appendChild(modal);

    // ── 加载分类下拉 ────────────────────────────────────────
    // catDateMode=true(默认): 以今天日期为默认分类
    // catDateMode=false: 以上次选中的分类为默认
    const todayStr = new Date().toISOString().slice(0, 10);
    const useDateMode = data.catDateMode !== false;

    // 构建今天日期选项（如果不是 category 模式，放在第一位）
    const todayOpt = document.createElement("option");
    todayOpt.value = todayStr;
    todayOpt.textContent = "📅 " + todayStr + "（今天）";

    const list = data.categories || ["默认", "灵感素材", "竞品分析", "视频剪辑"];

    if (useDateMode) {
      // 日期模式：今天日期在最前，默认选中
      selectCat.appendChild(todayOpt);
      list.filter(c => c !== todayStr).forEach(c => {
        const opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        selectCat.appendChild(opt);
      });
      selectCat.value = todayStr;
    } else {
      // 分类模式：已有分类在前，今天日期在后，默认选上次使用的分类
      list.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        selectCat.appendChild(opt);
      });
      if (!list.includes(todayStr)) {
        selectCat.appendChild(todayOpt); // 今天日期附在末尾备选
      }
      // 恢复上次选择
      if (data.lastSelectedCategory && [...selectCat.options].some(o => o.value === data.lastSelectedCategory)) {
        selectCat.value = data.lastSelectedCategory;
      }
    }

    // 切换时保存 lastSelectedCategory
    selectCat.addEventListener("change", () =>
      chrome.storage.local.set({ lastSelectedCategory: selectCat.value }));

    addCatInline.addEventListener("click", () => {
      const val = prompt("请输入新分类名称：");
      if (!val || !val.trim()) return;
      const trimmed = val.trim();
      chrome.storage.local.get(["categories"], d => {
        let l = d.categories || [];
        if (!l.includes(trimmed)) l.push(trimmed);
        chrome.storage.local.set({ categories: l, lastSelectedCategory: trimmed }, () => {
          const o = document.createElement("option");
          o.value = trimmed; o.textContent = trimmed;
          selectCat.insertBefore(o, useDateMode ? selectCat.options[1] : selectCat.options[0]);
          selectCat.value = trimmed;
        });
      });
    });
  });

  // ── 构建 payload ─────────────────────────────────────────
  function buildPayload(cb) {
    chrome.storage.local.get(
      ["gasUrl", "sheetId", "folderId", "sheetName", "optDownload", "optFolder",
       "optNotes", "optUrl", "layoutMode"], (cfg) => {
      if (!cfg.gasUrl) {
        cb(null, null, "❌ 请在插件弹窗「配置」标签填写 GAS 部署链接");
        return;
      }
      if (!cfg.sheetId || !cfg.folderId) {
        cb(null, null, "❌ 请在插件弹窗「配置」标签填写表格和网盘 ID");
        return;
      }
      const today = new Date();
      const dateStr = today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

      // 提取视频 ID
      let videoId = "";
      const patterns = [/reels\/(\d+)/, /[?&]v=([\w-]+)/, /\/video\/(\d+)/,
                        /\/reel\/([\w-]+)/, /\/p\/([\w-]+)/, /\/pin\/(\d+)/];
      for (const p of patterns) {
        const m = info.url.match(p);
        if (m) { videoId = m[1]; break; }
      }
      if (!videoId) {
        let hash = 0;
        for (let i = 0; i < info.url.length; i++) { hash = (hash << 5) - hash + info.url.charCodeAt(i); hash |= 0; }
        videoId = "id_" + Math.abs(hash);
      }

      const cleanTitle = (info.title || "截图").replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s_-]/g, "").substring(0, 30).trim();
      const folderName = "[" + videoId + "] " + cleanTitle;

      cb({
        imgBase64:   base64,
        videoUrl:    info.url,
        videoTitle:  info.title,
        platform:    info.platform || "Web",
        date:        dateStr,
        category:    selectCat.value,
        notes:       (cfg.optNotes !== false) ? notesText.value.trim() : "",
        sheetId:     cfg.sheetId,
        folderId:    cfg.folderId,
        sheetName:   (cfg.sheetName && typeof cfg.sheetName === "string") ? cfg.sheetName.trim() : "",
        folderName,
        optDownload: cfg.optDownload !== false,
        optFolder:   cfg.optFolder   !== false,
        optNotes:    cfg.optNotes    !== false,
        optUrl:      cfg.optUrl      !== false,
        layoutMode:  cfg.layoutMode  || "horizontal"
      }, cfg.gasUrl, null);
    });
  }

  // ── 执行上传 ─────────────────────────────────────────────
  function doUpload(gasUrl, payload, onSuccess, onFail) {
    chrome.runtime.sendMessage({ action: "uploadToGAS", gasUrl, payload }, (res) => {
      if (res && (res.status === "success" || res.success)) onSuccess();
      else onFail(res?.message || res?.error || "上传失败，请检查配置");
    });
  }

  submitBtn.addEventListener("click", () => {
    stateDiv.style.display = "block";
    stateDiv.style.color   = "#1877f2";
    stateDiv.textContent   = "⏳ 正在上传到谷歌网盘...";
    submitBtn.disabled = true; continueBtn.disabled = true;

    buildPayload((payload, gasUrl, err) => {
      if (err) { stateDiv.style.color = "red"; stateDiv.textContent = err; submitBtn.disabled = false; continueBtn.disabled = false; return; }
      doUpload(gasUrl, payload,
        () => { stateDiv.style.color = "green"; stateDiv.textContent = "✅ 上传成功！"; submitBtn.disabled = false; continueBtn.disabled = false; },
        (e)  => { stateDiv.style.color = "red"; stateDiv.textContent = "❌ " + e; submitBtn.disabled = false; continueBtn.disabled = false; }
      );
    });
  });

  continueBtn.addEventListener("click", () => {
    buildPayload((payload, gasUrl, err) => {
      if (err) { alert(err); return; }
      modal.remove();
      showToast("📤 后台上传中...", "#1877f2");
      doUpload(gasUrl, payload,
        () => showToast("✅ 上传成功！", "#24b263"),
        (e)  => showToast("❌ " + e, "#d93025")
      );
      // 自动触发下一次截图（连续截图模式）
      if (captureAgain) captureAgain();
    });
  });
}
