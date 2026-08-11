// ============================================================
//  智能截图助手 Pro v2.0 — Google Apps Script
//  修复：横排分类索引、多 Sheet 支持、字段开关、横/竖排模式
// ============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    // ── 提取 ID ──────────────────────────────────────────────
    var sheetId        = extractId(data.sheetId);
    var parentFolderId = extractId(data.folderId);

    if (!parentFolderId) throw new Error("网盘根文件夹 ID 不能为空");
    if (!sheetId)        throw new Error("谷歌表格 ID 不能为空");

    // ── 基础字段 ─────────────────────────────────────────────
    var base64Data = data.imgBase64;
    if (base64Data.indexOf("base64,") !== -1) {
      base64Data = base64Data.split("base64,").pop();
    }

    var videoUrl   = data.videoUrl   || "";
    var videoTitle = data.videoTitle || "未命名";
    var platform   = data.platform   || "Web";
    var dateStr    = data.date;
    var category   = data.category   || "默认";
    var notes      = data.notes      || "";
    var folderName = data.folderName || "截图";
    var sheetName  = data.sheetName  || "";   // ← 新增：指定 Sheet 名称

    // ── 字段开关（默认全开）──────────────────────────────────
    var optDownload = (data.optDownload !== false);
    var optFolder   = (data.optFolder   !== false);
    var optNotes    = (data.optNotes    !== false);
    var optUrl      = (data.optUrl      !== false);

    // ── 排列模式 ─────────────────────────────────────────────
    var layoutMode = data.layoutMode || "horizontal";

    // ── 1. 网盘根文件夹 ──────────────────────────────────────
    var rootFolder;
    try {
      rootFolder = DriveApp.getFolderById(parentFolderId);
    } catch(err) {
      throw new Error("无法打开网盘文件夹：" + err.message);
    }

    // ── 2. 日期文件夹 ────────────────────────────────────────
    var dateFolders = rootFolder.getFoldersByName(dateStr);
    var dateFolder  = dateFolders.hasNext() ? dateFolders.next() : rootFolder.createFolder(dateStr);

    // ── 3. 视频专属文件夹 ────────────────────────────────────
    var videoFolders = dateFolder.getFoldersByName(folderName);
    var videoFolder  = videoFolders.hasNext() ? videoFolders.next() : dateFolder.createFolder(folderName);

    // ── 4. 保存图片 ──────────────────────────────────────────
    var decodedImg = Utilities.base64Decode(base64Data);
    var timestamp  = Utilities.formatDate(new Date(), "GMT+8", "HH-mm-ss");
    var fileName   = platform + "_截图_" + timestamp + ".jpg";
    var file       = videoFolder.createFile(
      Utilities.newBlob(decodedImg, "image/jpeg", fileName)
    );

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(shareErr) {
      console.log("分享权限受限：" + shareErr.message);
    }

    var fileId           = file.getId();
    var imageUrlForSheet = "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w400";
    var downloadUrl      = "https://drive.google.com/uc?export=download&id=" + fileId;
    var folderUrl        = "https://drive.google.com/drive/folders/" + videoFolder.getId();

    // ── 5. 打开表格，精确定位 Sheet ──────────────────────────
    var ss;
    try {
      ss = SpreadsheetApp.openById(sheetId);
    } catch(err) {
      throw new Error("无法打开谷歌表格：" + err.message);
    }

    var sheet = null;

    // 优先按名称查找
    if (sheetName && sheetName.trim() !== "") {
      sheet = ss.getSheetByName(sheetName.trim());
      if (!sheet) {
        throw new Error("找不到名为「" + sheetName + "」的 Sheet，请检查名称是否一致（区分大小写）");
      }
    } else {
      // 没填名称则取第一个 Sheet
      sheet = ss.getSheets().shift();
    }

    // ── 6. 路由写入 ──────────────────────────────────────────
    if (layoutMode === "vertical") {
      writeVertical(sheet, category, dateStr, videoUrl, imageUrlForSheet,
                    downloadUrl, folderUrl, notes,
                    optDownload, optFolder, optNotes, optUrl);
    } else {
      writeHorizontal(sheet, category, dateStr, videoUrl, imageUrlForSheet,
                      downloadUrl, folderUrl, notes,
                      optDownload, optFolder, optNotes, optUrl);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", message: "上传成功" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ============================================================
//  横排模式
//
//  表格结构：
//    第 1 行（A 列起）= 隐藏索引行，格式：「分类名|起始行号」
//      —— 用于快速定位分类所在行，彻底避免插列后扫描错位
//    第 2 行起 = 实际数据区
//
//  每个分类占一个"行区段"，内部结构（R = 分类起始行）：
//    R+0  日期（加粗）
//    R+1  图片（含超链接）
//    R+2  下载链接        [optDownload]
//    R+3  打开位置        [optFolder]
//    R+4  备注            [optNotes]
//    R+5  来源链接        [optUrl]
//
//  A 列第 R 行：分类标签（加粗，供肉眼识别）
//  新内容始终插入 D 列（列 4），旧内容自动右移
// ============================================================
function writeHorizontal(sheet, category, dateStr, videoUrl, imageUrlForSheet,
                         downloadUrl, folderUrl, notes,
                         optDownload, optFolder, optNotes, optUrl) {

  var TRACK_ROWS = calcTrackRows(optDownload, optFolder, optNotes, optUrl);

  // ── 读取索引行（第 1 行）────────────────────────────────
  //    每个有分类的列在 A 列对应索引格里存 "分类名|行号"
  //    索引存在 A1 单元格，用换行分隔多条记录
  var INDEX_CELL = sheet.getRange(1, 1);
  var indexRaw   = INDEX_CELL.getValue().toString();
  var indexMap   = {};  // { "分类名": 起始行号 }

  if (indexRaw.trim() !== "") {
    indexRaw.split("\n").forEach(function(line) {
      var parts = line.split("|");
      if (parts.length === 2) {
        var catName = parts[0].trim();
        var rowNum  = parseInt(parts[1].trim(), 10);
        if (catName && !isNaN(rowNum)) {
          indexMap[catName] = rowNum;
        }
      }
    });
  }

  var R;

  if (indexMap[category] !== undefined) {
    // ── 已有分类：在 D 列（列 4）对应行区段插入一列 ────────
    R = indexMap[category];
    sheet.getRange(R, 4, TRACK_ROWS, 1).insertCells(SpreadsheetApp.Dimension.COLUMNS);

  } else {
    // ── 新分类：追加到数据区末尾 ────────────────────────────
    //    先找当前数据区最后一行（跳过索引行第 1 行）
    var lastDataRow = getLastDataRow(sheet);
    R = (lastDataRow < 2) ? 2 : lastDataRow + 2;  // 留 1 行空行间隔

    // A 列写分类名（供肉眼识别）
    sheet.getRange(R, 1).setValue(category).setFontWeight("bold");
    // A1 隐去显示（字体设白色，不影响功能）
    INDEX_CELL.setFontColor("#ffffff");

    // 设置行高
    var rowOffset = 0;
    sheet.setRowHeight(R + rowOffset, 25);   rowOffset++; // 日期
    sheet.setRowHeight(R + rowOffset, 160);  rowOffset++; // 图片
    if (optDownload) { sheet.setRowHeight(R + rowOffset, 25);  rowOffset++; }
    if (optFolder)   { sheet.setRowHeight(R + rowOffset, 25);  rowOffset++; }
    if (optNotes)    { sheet.setRowHeight(R + rowOffset, 40);  rowOffset++; }
    if (optUrl)      { sheet.setRowHeight(R + rowOffset, 25);  rowOffset++; }
    sheet.setRowHeight(R + rowOffset, 16); // 间隔行

    // 更新索引
    indexMap[category] = R;
    saveIndex(INDEX_CELL, indexMap);
  }

  // ── 写入卡片数据到 D 列（列 4）──────────────────────────
  writeSingleCard(sheet, R, 4, dateStr, videoUrl, imageUrlForSheet,
                  downloadUrl, folderUrl, notes,
                  optDownload, optFolder, optNotes, optUrl);
}


// ============================================================
//  竖排模式
//
//  表格结构：
//    第 1 行 = 分类标题行，每个分类起始列写分类名
//    第 2 行起 = 数据行，新数据插入第 2 行，旧数据下移
//
//  每个分类占一个"列区段"（C = 起始列）：
//    C+0  日期
//    C+1  图片
//    C+2  下载链接     [optDownload]
//    C+3  打开位置     [optFolder]
//    C+4  备注         [optNotes]
//    C+5  来源链接     [optUrl]
// ============================================================
function writeVertical(sheet, category, dateStr, videoUrl, imageUrlForSheet,
                       downloadUrl, folderUrl, notes,
                       optDownload, optFolder, optNotes, optUrl) {

  var TRACK_COLS = calcTrackCols(optDownload, optFolder, optNotes, optUrl);

  // 扫描第 1 行，查找分类起始列
  var lastCol  = Math.max(sheet.getLastColumn(), 1);
  var row1vals = sheet.getRange(1, 1, 1, lastCol).getValues().shift();
  var foundCol = -1;

  for (var i = 0; i < row1vals.length; i++) {
    if (row1vals[i].toString().trim() === category) {
      foundCol = i + 1;
      break;
    }
  }

  var C;

  if (foundCol !== -1) {
    // ── 已有分类：第 2 行对应列区段插入新行 ────────────────
    C = foundCol;
    sheet.getRange(2, C, 1, TRACK_COLS).insertCells(SpreadsheetApp.Dimension.ROWS);

  } else {
    // ── 新分类：追加到右侧，留 1 列空列隔开 ────────────────
    C = (lastCol >= 1 && row1vals.some(function(v){ return v !== ""; }))
        ? lastCol + 2
        : 1;

    // 第 1 行写分类名
    sheet.getRange(1, C).setValue(category).setFontWeight("bold");

    // 设置列宽
    var colOffset = 0;
    sheet.setColumnWidth(C + colOffset, 90);  colOffset++; // 日期
    sheet.setColumnWidth(C + colOffset, 160); colOffset++; // 图片
    if (optDownload) { sheet.setColumnWidth(C + colOffset, 110); colOffset++; }
    if (optFolder)   { sheet.setColumnWidth(C + colOffset, 110); colOffset++; }
    if (optNotes)    { sheet.setColumnWidth(C + colOffset, 160); colOffset++; }
    if (optUrl)      { sheet.setColumnWidth(C + colOffset, 110); colOffset++; }
  }

  // 第 2 行新插入行设置行高
  sheet.setRowHeight(2, 160);

  // ── 写入数据到第 2 行 ────────────────────────────────────
  writeSingleRow(sheet, 2, C, dateStr, videoUrl, imageUrlForSheet,
                 downloadUrl, folderUrl, notes,
                 optDownload, optFolder, optNotes, optUrl);
}


// ============================================================
//  横排写入：一列多行
// ============================================================
function writeSingleCard(sheet, startRow, col, dateStr, videoUrl, imageUrlForSheet,
                         downloadUrl, folderUrl, notes,
                         optDownload, optFolder, optNotes, optUrl) {
  var row = startRow;

  sheet.getRange(row, col).setValue(dateStr).setFontWeight("bold");
  row++;

  sheet.getRange(row, col)
    .setFormula('=HYPERLINK("' + videoUrl + '",IMAGE("' + imageUrlForSheet + '"))');
  row++;

  if (optDownload) {
    sheet.getRange(row, col).setFormula('=HYPERLINK("' + downloadUrl + '","📥 下载图片")');
    row++;
  }
  if (optFolder) {
    sheet.getRange(row, col).setFormula('=HYPERLINK("' + folderUrl + '","📂 打开位置")');
    row++;
  }
  if (optNotes) {
    sheet.getRange(row, col).setValue(notes);
    row++;
  }
  if (optUrl) {
    sheet.getRange(row, col).setFormula('=HYPERLINK("' + videoUrl + '","🔗 来源链接")');
  }
}


// ============================================================
//  竖排写入：一行多列
// ============================================================
function writeSingleRow(sheet, row, startCol, dateStr, videoUrl, imageUrlForSheet,
                        downloadUrl, folderUrl, notes,
                        optDownload, optFolder, optNotes, optUrl) {
  var col = startCol;

  sheet.getRange(row, col).setValue(dateStr).setFontWeight("bold");
  col++;

  sheet.getRange(row, col)
    .setFormula('=HYPERLINK("' + videoUrl + '",IMAGE("' + imageUrlForSheet + '"))');
  col++;

  if (optDownload) {
    sheet.getRange(row, col).setFormula('=HYPERLINK("' + downloadUrl + '","📥 下载图片")');
    col++;
  }
  if (optFolder) {
    sheet.getRange(row, col).setFormula('=HYPERLINK("' + folderUrl + '","📂 打开位置")');
    col++;
  }
  if (optNotes) {
    sheet.getRange(row, col).setValue(notes);
    col++;
  }
  if (optUrl) {
    sheet.getRange(row, col).setFormula('=HYPERLINK("' + videoUrl + '","🔗 来源链接")');
  }
}


// ============================================================
//  索引行读写（横排专用）
//  格式：A1 单元格存 "分类A|行号\n分类B|行号\n..."
// ============================================================
function saveIndex(cell, indexMap) {
  var lines = [];
  Object.keys(indexMap).forEach(function(key) {
    lines.push(key + "|" + indexMap[key]);
  });
  cell.setValue(lines.join("\n"));
  // 保持白色隐藏
  cell.setFontColor("#ffffff").setFontSize(7);
}


// ============================================================
//  找数据区最后一行（横排用，跳过第 1 行索引行）
// ============================================================
function getLastDataRow(sheet) {
  var lastRow = sheet.getLastRow();
  return (lastRow < 2) ? 1 : lastRow;
}


// ============================================================
//  辅助：行数计算（横排）
// ============================================================
function calcTrackRows(optDownload, optFolder, optNotes, optUrl) {
  var n = 2; // 日期 + 图片
  if (optDownload) n++;
  if (optFolder)   n++;
  if (optNotes)    n++;
  if (optUrl)      n++;
  return n;
}


// ============================================================
//  辅助：列数计算（竖排）
// ============================================================
function calcTrackCols(optDownload, optFolder, optNotes, optUrl) {
  var n = 2;
  if (optDownload) n++;
  if (optFolder)   n++;
  if (optNotes)    n++;
  if (optUrl)      n++;
  return n;
}


// ============================================================
//  智能 ID 提取（支持完整链接或纯 ID）
// ============================================================
function extractId(input) {
  if (!input) return "";
  input = input.trim();

  if (input.indexOf("http") === 0) {
    var parts   = input.split("/");
    var foundId = "";
    parts.forEach(function(item) {
      var clean = item.split("?").shift();
      if (clean.length >= 25 && clean.length <= 50) {
        foundId = clean;
      }
    });
    if (foundId) return foundId;
  }

  return input.split("?").shift();
}
