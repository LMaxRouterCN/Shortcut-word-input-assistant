// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "settings",
      title: "设置",
      contexts: ["action"]
    });
    
    chrome.contextMenus.create({
      id: "addToWhitelist",
      title: "把当前页面加入白名单",
      contexts: ["action"]
    });
    
    chrome.contextMenus.create({
      id: "removeFromWhitelist",
      title: "把当前页面移出白名单",
      contexts: ["action"]
    });
  });
  
  // 处理右键菜单点击
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "settings") {
      // 打开设置页面
      chrome.tabs.create({ url: chrome.runtime.getURL("settings/settings.html") });
    } else if (info.menuItemId === "addToWhitelist") {
      // 获取当前网址并加入白名单
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;
        
        chrome.storage.sync.get({whitelist: []}, (data) => {
          const whitelist = data.whitelist;
          if (!whitelist.includes(domain)) {
            whitelist.push(domain);
            chrome.storage.sync.set({whitelist});
          }
        });
      });
    } else if (info.menuItemId === "removeFromWhitelist") {
      // 获取当前网址并从白名单移除
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const url = new URL(tabs[0].url);
        const domain = url.hostname;
        
        chrome.storage.sync.get({whitelist: []}, (data) => {
          const whitelist = data.whitelist.filter(item => item !== domain);
          chrome.storage.sync.set({whitelist});
        });
      });
    }
  });
  
  // 监听来自内容脚本的消息
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getSettings") {
      chrome.storage.sync.get({
        keywords: ["谢谢", "请稍等", "我会尽快回复您", "您好"],
        boxSize: {width: 200, height: 300},
        boxPosition: {left: 50, top: 50},
        boxColor: "#ffffff",
        borderColor: "#cccccc",
        borderRadius: 8,
        opacity: 0.9,
        whitelist: [],
        hideButtonAfterSelect: true
      }, (data) => {
        sendResponse(data);
      });
      return true; // 保持消息通道开放，用于异步响应
    }
  });