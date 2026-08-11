// 保证在页面上只执行一次
if (!window.fbsHasRun) {
  window.fbsHasRun = true;
  console.log("=== 智能截图助手 Pro v2.0 成功加载！===");
  initScreenshotTool();
}

function initScreenshotTool() {
  createFloatingBar();
}

// ── 检测当前平台 ─────────────────────────────────────────────────────────────
function detectPlatform() {
  const h = location.hostname;
  if (h.includes("facebook.com"))   return { name: "Facebook",   icon: "📘", color: "#1877f2" };
  if (h.includes("youtube.com"))    return { name: "YouTube",    icon: "▶️",  color: "#ff0000" };
  if (h.includes("instagram.com"))  return { name: "Instagram",  icon: "📷", color: "#e1306c" };
  if (h.includes("tiktok.com"))     return { name: "TikTok",     icon: "🎵", color: "#010101" };
  if (h.includes("pinterest.com"))  return { name: "Pinterest",  icon: "📌", color: "#e60023" };
  if (h.includes("behance.net"))    return { name: "Behance",    icon: "🎨", color: "#1769ff" };
  if (h.includes("dribbble.com"))   return { name: "Dribbble",   icon: "🏀", color: "#ea4c89" };
  if (h.includes("flickr.com"))     return { name: "Flickr",     icon: "🌄", color: "#ff0084" };
  return { name: "Web", icon: "🌐", color: "#555" };
}

// ── 动态创建悬浮窗 ────────────────────────────────────────────────────────────
function createFloatingBar() {
  if (document.getElementById("fbs-float-bar")) return;

  const platform = detectPlatform();

  const bar = document.createElement("div");
  bar.id = "fbs-float-bar";

  // 平台标识小徽标
  const badge = document.createElement("div");
  badge.id = "fbs-platform-badge";
  badge.title = platform.name;
  badge.textContent = platform.icon;
  badge.style.cssText = "font-size:14px;text-align:center;padding:2px 0 4px 0;cursor:default;";
  bar.appendChild(badge);

  const handle = document.createElement("div");
  handle.id = "fbs-drag-handle";
  const line1 = document.createElement("div");
  line1.classList.add("fbs-drag-line");
  handle.appendChild(line1);
  const line2 = document.createElement("div");
  line2.classList.add("fbs-drag-line");
  handle.appendChild(line2);
  bar.appendChild(handle);

  const btnVideo = document.createElement("button");
  btnVideo.className = "fbs-float-btn";
  btnVideo.textContent = "🎥";
  const tooltipV = document.createElement("span");
  tooltipV.className = "fbs-tooltip";
  tooltipV.textContent = "截取当前视频";
  btnVideo.appendChild(tooltipV);
  btnVideo.addEventListener("click", handleVideoCapture);
  bar.appendChild(btnVideo);

  const btnArea = document.createElement("button");
  btnArea.className = "fbs-float-btn";
  btnArea.textContent = "✂️";
  const tooltipA = document.createElement("span");
  tooltipA.className = "fbs-tooltip";
  tooltipA.textContent = "自由框选截图";
  btnArea.appendChild(tooltipA);
  btnArea.addEventListener("click", handleAreaCapture);
  bar.appendChild(btnArea);

  document.body.appendChild(bar);
  makeElementDraggable(bar, handle);
}

// ── 拖拽引擎 ──────────────────────────────────────────────────────────────────
function makeElementDraggable(elm, handle) {
  let pos2 = 0, pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos2 = pos4 - e.clientY;
    pos4 = e.clientY;
    let newTop = elm.offsetTop - pos2;
    newTop = Math.max(10, Math.min(newTop, window.innerHeight - 150));
    elm.style.top = newTop + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// ── 多平台视频查找 ────────────────────────────────────────────────────────────
function findActiveVideo() {
  const videos = Array.from(document.querySelectorAll("video"));
  if (videos.length === 0) return null;

  // 优先：视口内 + 正在播放
  for (const v of videos) {
    const r = v.getBoundingClientRect();
    const inView = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
    if (inView && !v.paused) return v;
  }
  // 其次：任意播放中
  for (const v of videos) {
    if (!v.paused) return v;
  }
  // 最后：视口内最大的
  let best = null, bestArea = 0;
  for (const v of videos) {
    const r = v.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const area = r.width * r.height;
      if (area > bestArea) { bestArea = area; best = v; }
    }
  }
  return best;
}

// ── 获取来源标题（多平台适配）────────────────────────────────────────────────
function getPageTitle() {
  // YouTube: <yt-formatted-string> 优先
  const ytTitle = document.querySelector("h1.ytd-video-primary-info-renderer, yt-formatted-string.ytd-video-primary-info-renderer");
  if (ytTitle) return ytTitle.textContent.trim();
  // TikTok
  const ttTitle = document.querySelector("[data-e2e='browse-video-desc'], .video-meta-title");
  if (ttTitle) return ttTitle.textContent.trim();
  return document.title || "截图";
}

// ── 视频截图 ──────────────────────────────────────────────────────────────────
function handleVideoCapture() {
  const video = findActiveVideo();
  if (!video) {
    alert("❌ 页面上未检测到视频，将切换为手动框选截图！");
    handleAreaCapture();
    return;
  }

  const rect = video.getBoundingClientRect();
  const info = {
    title: getPageTitle(),
    url: window.location.href,
    platform: detectPlatform().name,
    rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  };
  requestCropAndShowUI(info, "video");
}

// ── 框选截图 ──────────────────────────────────────────────────────────────────
function handleAreaCapture() {
  startAreaSelection(function(rect) {
    const info = {
      title: getPageTitle(),
      url: window.location.href,
      platform: detectPlatform().name,
      rect: rect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
    requestCropAndShowUI(info, "area");
  });
}

// ── 框选画布 ──────────────────────────────────────────────────────────────────
function startAreaSelection(callback) {
  const overlay = document.createElement("div");
  overlay.id = "fbs-select-overlay";
  const box = document.createElement("div");
  box.id = "fbs-select-box";
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let startX = 0, startY = 0, isDrawing = false;

  overlay.addEventListener("mousedown", e => {
    isDrawing = true;
    startX = e.clientX; startY = e.clientY;
    box.style.cssText = "display:block;left:" + startX + "px;top:" + startY + "px;width:0;height:0;";
  });
  overlay.addEventListener("mousemove", e => {
    if (!isDrawing) return;
    box.style.width  = Math.abs(e.clientX - startX) + "px";
    box.style.height = Math.abs(e.clientY - startY) + "px";
    box.style.left   = Math.min(e.clientX, startX) + "px";
    box.style.top    = Math.min(e.clientY, startY) + "px";
  });
  overlay.addEventListener("mouseup", e => {
    if (!isDrawing) return;
    isDrawing = false;
    const rect = {
      x: Math.min(startX, e.clientX), y: Math.min(startY, e.clientY),
      width: Math.abs(startX - e.clientX), height: Math.abs(startY - e.clientY)
    };
    overlay.remove();
    if (rect.width > 10 && rect.height > 10) callback(rect);
  });
}

// ── 裁剪与捕获 ────────────────────────────────────────────────────────────────
function requestCropAndShowUI(info, sourceType) {
  chrome.runtime.sendMessage({ action: "captureTab" }, function(response) {
    if (!response || !response.success) {
      alert("❌ 无法捕获页面截图，请刷新页面后重试！");
      return;
    }

    const img = new Image();
    img.src = response.dataUrl;
    img.onload = function() {
      const canvas = document.createElement("canvas");
      canvas.width  = info.rect.width;
      canvas.height = info.rect.height;
      const ctx = canvas.getContext("2d");
      const scaleX = img.width  / info.viewportWidth;
      const scaleY = img.height / info.viewportHeight;
      ctx.drawImage(img,
        info.rect.x * scaleX, info.rect.y * scaleY,
        info.rect.width * scaleX, info.rect.height * scaleY,
        0, 0, info.rect.width, info.rect.height
      );
      showSaveModal(canvas.toDataURL("image/jpeg", 0.9), info.url, info.title, info.platform, sourceType);
    };
  });
}

// ── Toast 提示 ────────────────────────────────────────────────────────────────
function showToast(text, color) {
  let toast = document.getElementById("fbs-toast");
  if (!toast) { toast = document.createElement("div"); toast.id = "fbs-toast"; }
  toast.textContent = text;
  toast.className = "fbs-toast-show";
  toast.style.backgroundColor = color || "rgba(0,0,0,0.85)";
  if (!toast.parentNode) document.body.appendChild(toast);
  if (window.fbsToastTimeout) clearTimeout(window.fbsToastTimeout);
  window.fbsToastTimeout = setTimeout(() => {
    toast.className = "fbs-toast-hide";
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
  }, 3000);
}

// ── 保存确认弹窗（主 UI）─────────────────────────────────────────────────────
function showSaveModal(base64, videoUrl, videoTitle, platform, sourceType) {
  const existing = document.getElementById("fbs-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "fbs-modal";

  // 标题栏
  const titleBar = document.createElement("div");
  titleBar.className = "fbs-modal-title";
  const titleSpan = document.createElement("span");
  titleSpan.textContent = "💡 截图保存 · " + (platform || "Web");
  const closeBtn = document.createElement("span");
  closeBtn.className = "fbs-modal-close";
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => modal.remove());
  titleBar.appendChild(titleSpan);
  titleBar.appendChild(closeBtn);
  modal.appendChild(titleBar);

  // 预览图
  const previewCont = document.createElement("div");
  previewCont.className = "fbs-preview-container";
  const previewImg = document.createElement("img");
  previewImg.className = "fbs-preview-img";
  previewImg.src = base64;
  previewCont.appendChild(previewImg);
  modal.appendChild(previewCont);

  // 类别选择
  const catLabel = document.createElement("div");
  catLabel.className = "fbs-label";
  catLabel.textContent = "选择类别";
  modal.appendChild(catLabel);

  const catRow = document.createElement("div");
  catRow.style.cssText = "display:flex;gap:6px;margin-bottom:10px;";
  const selectCat = document.createElement("select");
  selectCat.id = "fbs-cat";
  selectCat.className = "fbs-input";
  selectCat.style.cssText = "margin-bottom:0!important;flex:1;";
  const addCatBtn = document.createElement("button");
  addCatBtn.className = "fbs-btn fbs-btn-sec";
  addCatBtn.style.cssText = "padding:0 12px!important;margin-right:0!important;";
  addCatBtn.textContent = "+";
  catRow.appendChild(selectCat);
  catRow.appendChild(addCatBtn);
  modal.appendChild(catRow);

  // 随手记（按开关决定是否显示）
  const notesLabel = document.createElement("div");
  notesLabel.className = "fbs-label";
  notesLabel.textContent = "随手记（记录当下的灵感）";
  const notesText = document.createElement("textarea");
  notesText.id = "fbs-notes";
  notesText.className = "fbs-input";
  notesText.rows = 3;
  notesText.placeholder = "写点灵感脑洞吧...";

  // 按钮行
  const btnRow = document.createElement("div");
  btnRow.className = "fbs-btn-row";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "fbs-btn fbs-btn-sec";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => modal.remove());
  const continueBtn = document.createElement("button");
  continueBtn.className = "fbs-btn fbs-btn-green";
  continueBtn.textContent = "💾 保存并继续";
  const submitBtn = document.createElement("button");
  submitBtn.className = "fbs-btn";
  submitBtn.textContent = "上传";
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(continueBtn);
  btnRow.appendChild(submitBtn);

  const stateDiv = document.createElement("div");
  stateDiv.id = "fbs-state";

  // 按配置开关决定渲染哪些字段
  chrome.storage.local.get(["optNotes", "categories", "lastSelectedCategory", "lastNotes"], function(data) {
    if (data.optNotes !== false) {
      modal.appendChild(notesLabel);
      modal.appendChild(notesText);
      if (data.lastNotes) notesText.value = data.lastNotes;
    }

    modal.appendChild(btnRow);
    modal.appendChild(stateDiv);
    document.body.appendChild(modal);

    // 加载分类
    const list = data.categories || ["默认", "灵感素材", "竞品分析", "视频剪辑"];
    selectCat.innerHTML = "";
    for (const c of list) {
      const opt = document.createElement("option");
      opt.value = c; opt.textContent = c;
      selectCat.appendChild(opt);
    }
    const activeCat = data.lastSelectedCategory;
    if (activeCat && list.includes(activeCat)) selectCat.value = activeCat;
    else chrome.storage.local.set({ lastSelectedCategory: selectCat.value });

    selectCat.addEventListener("change", () => chrome.storage.local.set({ lastSelectedCategory: selectCat.value }));
    notesText.addEventListener("input",  () => chrome.storage.local.set({ lastNotes: notesText.value }));

    addCatBtn.addEventListener("click", () => {
      const val = prompt("请输入新分类名称：");
      if (val && val.trim()) {
        const trimmed = val.trim();
        chrome.storage.local.get(["categories"], d => {
          let l = d.categories || [];
          if (!l.includes(trimmed)) {
            l.push(trimmed);
            chrome.storage.local.set({ categories: l, lastSelectedCategory: trimmed }, () => {
              const o = document.createElement("option");
              o.value = trimmed; o.textContent = trimmed;
              selectCat.appendChild(o);
              selectCat.value = trimmed;
            });
          } else {
            chrome.storage.local.set({ lastSelectedCategory: trimmed });
            selectCat.value = trimmed;
          }
        });
      }
    });
  });

  // ── 构建 payload（含字段开关）────────────────────────────────────────────
  function preparePayload(callback) {
    chrome.storage.local.get(["gasUrl", "sheetId", "folderId", "sheetName",
      "optDownload", "optFolder", "optNotes", "optUrl", "layoutMode"], function(config) {
      if (!config.gasUrl || !config.sheetId || !config.folderId) {
        callback(null, "❌ 请点击插件图标完成配置后再上传！");
        return;
      }

      const today = new Date();
      const dateStr = today.getFullYear() + "-"
        + String(today.getMonth() + 1).padStart(2, "0") + "-"
        + String(today.getDate()).padStart(2, "0");

      // 从 URL 提取视频 ID（多平台）
      let videoId = "";
      const patterns = [
        /reels\/(\d+)/,          // Facebook Reels
        /[?&]v=([\w-]+)/,        // YouTube
        /\/video\/(\d+)/,        // TikTok
        /\/reel\/([\w-]+)/,      // Instagram Reel
        /\/p\/([\w-]+)/,         // Instagram Post
        /\/pin\/(\d+)/,          // Pinterest
      ];
      for (const p of patterns) {
        const m = videoUrl.match(p);
        if (m) { videoId = m[1]; break; }
      }
      if (!videoId) {
        let hash = 0;
        for (let i = 0; i < videoUrl.length; i++) {
          hash = (hash << 5) - hash + videoUrl.charCodeAt(i);
          hash |= 0;
        }
        videoId = "id_" + Math.abs(hash);
      }

      const cleanTitle = (videoTitle || "截图").replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s_-]/g, "").substring(0, 30).trim();
      const folderName = "[" + videoId + "] " + cleanTitle;

      const data = {
        imgBase64:    base64,
        videoUrl:     videoUrl,
        videoTitle:   videoTitle,
        platform:     platform || "Web",
        date:         dateStr,
        category:     selectCat.value,
        notes:        (config.optNotes !== false) ? notesText.value.trim() : "",
        sheetId:      config.sheetId,
        folderId:     config.folderId,
        sheetName:    (config.sheetName && typeof config.sheetName === "string") ? config.sheetName.trim() : "",
        folderName:   folderName,
        // 字段开关（传给 GAS 决定写哪些列）
        optDownload:  config.optDownload !== false,
        optFolder:    config.optFolder   !== false,
        optNotes:     config.optNotes    !== false,
        optUrl:       config.optUrl      !== false,
        // 排列模式
        layoutMode:   config.layoutMode || "horizontal"
      };

      callback({ gasUrl: config.gasUrl, data: data }, null);
    });
  }

  function doUpload(payload, onSuccess) {
    chrome.runtime.sendMessage({
      action: "uploadToGAS",
      gasUrl: payload.gasUrl,
      payload: payload.data
    }, function(res) {
      if (res && res.status === "success") onSuccess();
      else {
        const msg = "❌ 失败：" + (res?.message || "网络故障或部署无效");
        stateDiv.style.display  = "block";
        stateDiv.style.color    = "red";
        stateDiv.textContent    = msg;
        submitBtn.disabled = false;
        continueBtn.disabled = false;
      }
    });
  }

  submitBtn.addEventListener("click", function() {
    stateDiv.style.display = "block";
    stateDiv.style.color   = "#1877f2";
    stateDiv.textContent   = "⏳ 正在保存至谷歌网盘及表格...";
    submitBtn.disabled = true;
    continueBtn.disabled = true;

    preparePayload(function(payload, err) {
      if (err) {
        stateDiv.style.color = "red";
        stateDiv.textContent = err;
        submitBtn.disabled = false;
        continueBtn.disabled = false;
        return;
      }
      doUpload(payload, function() {
        stateDiv.style.color = "green";
        stateDiv.textContent = "✅ 上传成功！";
        submitBtn.disabled = false;
        continueBtn.disabled = false;
      });
    });
  });

  continueBtn.addEventListener("click", function() {
    preparePayload(function(payload, err) {
      if (err) { alert(err); return; }
      modal.remove();
      showToast("📤 正在后台上传截图...", "#1877f2");
      doUpload(payload, function() {
        showToast("✅ 截图已上传完成！", "#24b263");
      });
      setTimeout(function() {
        if (sourceType === "video") handleVideoCapture();
        else handleAreaCapture();
      }, 100);
    });
  });
}
