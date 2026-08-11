chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "captureTab") {
    try {
      chrome.tabs.captureVisibleTab({ format: "png" }, function(dataUrl) {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (!dataUrl) {
          sendResponse({ success: false, error: "捕获的图像数据为空" });
          return;
        }
        sendResponse({ success: true, dataUrl: dataUrl });
      });
    } catch (err) {
      sendResponse({ success: false, error: "捕获异常：" + err.toString() });
    }
    return true;
  }

  if (request.action === "uploadToGAS") {
    try {
      fetch(request.gasUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.payload)
      })
      .then(function(response) { return response.json(); })
      .then(function(data) { sendResponse(data); })
      .catch(function(err) { sendResponse({ status: "error", message: err.toString() }); });
    } catch (err) {
      sendResponse({ status: "error", message: "发送网络请求异常：" + err.toString() });
    }
    return true;
  }
});
