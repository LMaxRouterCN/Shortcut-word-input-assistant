// 设置页面脚本
document.addEventListener('DOMContentLoaded', loadSettings);

// 加载设置
function loadSettings() {
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
  }, (settings) => {
    // 填充关键词
    document.getElementById('keywords-input').value = settings.keywords.join('\n');
    
    // 填充尺寸
    document.getElementById('box-width-range').value = settings.boxSize.width;
    document.getElementById('box-width').value = settings.boxSize.width;
    document.getElementById('box-height-range').value = settings.boxSize.height;
    document.getElementById('box-height').value = settings.boxSize.height;
    
    // 填充颜色
    document.getElementById('box-color').value = settings.boxColor;
    document.getElementById('border-color').value = settings.borderColor;
    
    // 填充圆角和透明度
    document.getElementById('border-radius').value = settings.borderRadius;
    document.getElementById('border-radius-value').textContent = `${settings.borderRadius}px`;
    document.getElementById('opacity').value = settings.opacity;
    document.getElementById('opacity-value').textContent = `${Math.round(settings.opacity * 100)}%`;
    
    // 填充隐藏按钮开关
    document.getElementById('hide-button').checked = settings.hideButtonAfterSelect;
    
    // 填充白名单
    renderWhitelist(settings.whitelist);
  });
  
  // 添加事件监听器
  document.getElementById('save').addEventListener('click', saveSettings);
  document.getElementById('reset').addEventListener('click', resetSettings);
  document.getElementById('add-whitelist').addEventListener('click', addToWhitelist);
  
  // 宽度滑条和输入框同步
  document.getElementById('box-width-range').addEventListener('input', function() {
    document.getElementById('box-width').value = this.value;
  });
  
  document.getElementById('box-width').addEventListener('input', function() {
    document.getElementById('box-width-range').value = this.value;
  });
  
  // 高度滑条和输入框同步
  document.getElementById('box-height-range').addEventListener('input', function() {
    document.getElementById('box-height').value = this.value;
  });
  
  document.getElementById('box-height').addEventListener('input', function() {
    document.getElementById('box-height-range').value = this.value;
  });
  
  // 范围输入事件
  document.getElementById('border-radius').addEventListener('input', function() {
    document.getElementById('border-radius-value').textContent = `${this.value}px`;
  });
  
  document.getElementById('opacity').addEventListener('input', function() {
    document.getElementById('opacity-value').textContent = `${Math.round(this.value * 100)}%`;
  });
}

// 保存设置
function saveSettings() {
  const keywords = document.getElementById('keywords-input').value
    .split('\n')
    .map(k => k.trim())
    .filter(k => k.length > 0);
  
  const settings = {
    keywords,
    boxSize: {
      width: parseInt(document.getElementById('box-width').value),
      height: parseInt(document.getElementById('box-height').value)
    },
    boxColor: document.getElementById('box-color').value,
    borderColor: document.getElementById('border-color').value,
    borderRadius: parseInt(document.getElementById('border-radius').value),
    opacity: parseFloat(document.getElementById('opacity').value),
    hideButtonAfterSelect: document.getElementById('hide-button').checked
  };
  
  // 获取现有的白名单
  chrome.storage.sync.get(['whitelist', 'boxPosition'], (data) => {
    settings.whitelist = data.whitelist || [];
    settings.boxPosition = data.boxPosition || {left: 50, top: 50};
    
    chrome.storage.sync.set(settings, () => {
      alert('设置已保存！');
    });
  });
}

// 重置设置
function resetSettings() {
  if (confirm('确定要恢复默认设置吗？')) {
    chrome.storage.sync.set({
      keywords: ["谢谢", "请稍等", "我会尽快回复您", "您好"],
      boxSize: {width: 200, height: 300},
      boxPosition: {left: 50, top: 50},
      boxColor: "#ffffff",
      borderColor: "#cccccc",
      borderRadius: 8,
      opacity: 0.9,
      whitelist: [],
      hideButtonAfterSelect: true
    }, () => {
      alert('已恢复默认设置！');
      loadSettings();
    });
  }
}

// 添加网址到白名单
function addToWhitelist() {
  const input = document.getElementById('whitelist-input');
  const url = input.value.trim();
  
  if (url) {
    chrome.storage.sync.get({whitelist: []}, (data) => {
      const whitelist = data.whitelist;
      if (!whitelist.includes(url)) {
        whitelist.push(url);
        chrome.storage.sync.set({whitelist}, () => {
          input.value = '';
          renderWhitelist(whitelist);
        });
      }
    });
  }
}

// 从白名单移除网址
function removeFromWhitelist(url) {
  chrome.storage.sync.get({whitelist: []}, (data) => {
    const whitelist = data.whitelist.filter(item => item !== url);
    chrome.storage.sync.set({whitelist}, () => {
      renderWhitelist(whitelist);
    });
  });
}

// 渲染白名单
function renderWhitelist(whitelist) {
  const list = document.getElementById('whitelist');
  list.innerHTML = '';
  
  whitelist.forEach(url => {
    const li = document.createElement('li');
    
    const span = document.createElement('span');
    span.textContent = url;
    
    const button = document.createElement('button');
    button.textContent = '删除';
    button.addEventListener('click', () => removeFromWhitelist(url));
    
    li.appendChild(span);
    li.appendChild(button);
    list.appendChild(li);
  });
}