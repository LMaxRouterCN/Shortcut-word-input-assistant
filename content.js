// 主内容脚本
let quickWordBox = null;
let isSelecting = false;
let selectedInput = null;
let isDragging = false;
let dragStartX, dragStartY, initialLeft, initialTop;

// 初始化
function init() {
  // 从存储中获取设置
  chrome.runtime.sendMessage({action: "getSettings"}, (settings) => {
    // 检查当前页面是否在白名单中
    const currentDomain = window.location.hostname;
    if (settings.whitelist.length > 0 && !settings.whitelist.includes(currentDomain)) {
      return; // 不在白名单中，不显示快捷词框
    }
    
    createQuickWordBox(settings);
  });
}

// 创建快捷词待选框
function createQuickWordBox(settings) {
  // 如果已存在，先移除
  if (quickWordBox) {
    quickWordBox.remove();
  }
  
  // 创建容器
  quickWordBox = document.createElement('div');
  quickWordBox.id = 'quick-word-box';
  
  // 应用样式
  Object.assign(quickWordBox.style, {
    position: 'fixed',
    width: `${settings.boxSize.width}px`,
    height: `${settings.boxSize.height}px`,
    left: `${settings.boxPosition.left}px`,
    top: `${settings.boxPosition.top}px`,
    backgroundColor: settings.boxColor,
    border: `1px solid ${settings.borderColor}`,
    borderRadius: `${settings.borderRadius}px`,
    opacity: settings.opacity,
    zIndex: 10000,
    padding: '10px',
    boxSizing: 'border-box',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    cursor: 'move',
    userSelect: 'none'
  });
  
  // 创建选择模式按钮
  const selectButton = document.createElement('button');
  selectButton.id = 'select-input-button';
  selectButton.textContent = '选择输入框';
  selectButton.addEventListener('click', toggleSelectMode);
  
  Object.assign(selectButton.style, {
    padding: '5px 10px',
    marginBottom: '10px',
    cursor: 'pointer',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '4px'
  });
  
  // 创建关键词容器
  const keywordsContainer = document.createElement('div');
  keywordsContainer.id = 'keywords-container';
  keywordsContainer.style.overflowY = 'auto';
  keywordsContainer.style.flexGrow = '1';
  keywordsContainer.style.cursor = 'default'; // 恢复默认光标
  
  // 添加关键词按钮
  settings.keywords.forEach(keyword => {
    const keywordButton = document.createElement('button');
    keywordButton.textContent = keyword;
    keywordButton.addEventListener('click', () => {
      if (selectedInput) {
        insertTextToInput(selectedInput, keyword);
      }
    });
    
    Object.assign(keywordButton.style, {
      display: 'block',
      width: '100%',
      padding: '8px',
      marginBottom: '5px',
      textAlign: 'left',
      cursor: 'pointer',
      backgroundColor: 'transparent',
      border: 'none',
      borderRadius: '4px'
    });
    
    keywordButton.addEventListener('mouseover', () => {
      keywordButton.style.backgroundColor = '#f0f0f0';
    });
    
    keywordButton.addEventListener('mouseout', () => {
      keywordButton.style.backgroundColor = 'transparent';
    });
    
    keywordsContainer.appendChild(keywordButton);
  });
  
  // 添加到容器
  quickWordBox.appendChild(selectButton);
  quickWordBox.appendChild(keywordsContainer);
  
  // 添加到页面
  document.body.appendChild(quickWordBox);
  
  // 添加拖拽功能 - 修改为整个容器可拖动
  setupDragging(quickWordBox);
  
  // 保存设置引用
  chrome.runtime.sendMessage({action: "getSettings"}, (settings) => {
    if (selectedInput && settings.hideButtonAfterSelect) {
      selectButton.style.display = 'none';
    } else {
      selectButton.style.display = 'block';
    }
  });
}

// 设置拖拽功能 - 修改为整个容器可拖动
function setupDragging(element) {
  // 为整个容器添加拖拽事件
  element.addEventListener('mousedown', (e) => {
    // 如果点击的是按钮或关键词按钮，不触发拖拽
    if (e.target.tagName === 'BUTTON' || isSelecting) {
      return;
    }
    
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialLeft = parseInt(window.getComputedStyle(element).left, 10);
    initialTop = parseInt(window.getComputedStyle(element).top, 10);
    
    // 改变光标样式
    element.style.cursor = 'grabbing';
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    
    element.style.left = `${initialLeft + dx}px`;
    element.style.top = `${initialTop + dy}px`;
  });
  
  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    
    isDragging = false;
    element.style.cursor = 'move';
    
    // 保存新位置
    const newPosition = {
      left: parseInt(element.style.left, 10),
      top: parseInt(element.style.top, 10)
    };
    
    chrome.storage.sync.get({boxPosition: {left: 50, top: 50}}, (data) => {
      const settings = data;
      settings.boxPosition = newPosition;
      chrome.storage.sync.set(settings);
    });
  });
}

// 切换选择模式
function toggleSelectMode(e) {
  // 防止拖拽时触发选择模式
  if (isDragging) {
    e.stopPropagation();
    return;
  }
  
  isSelecting = !isSelecting;
  const selectButton = document.getElementById('select-input-button');
  
  if (isSelecting) {
    selectButton.textContent = '取消选择';
    selectButton.style.backgroundColor = '#ffdddd';
    
    // 添加输入框高亮样式
    const style = document.createElement('style');
    style.id = 'input-highlight-style';
    style.textContent = `
      input:hover, textarea:hover {
        outline: 2px solid #4a90e2 !important;
        cursor: pointer !important;
      }
    `;
    document.head.appendChild(style);
    
    // 添加点击事件监听器
    document.addEventListener('click', handleInputSelection, true);
  } else {
    selectButton.textContent = '选择输入框';
    selectButton.style.backgroundColor = '#f0f0f0';
    
    // 移除高亮样式
    const style = document.getElementById('input-highlight-style');
    if (style) style.remove();
    
    // 移除点击事件监听器
    document.removeEventListener('click', handleInputSelection, true);
  }
  
  e.stopPropagation();
}

// 处理输入框选择
function handleInputSelection(e) {
  const target = e.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    e.preventDefault();
    e.stopPropagation();
    
    selectedInput = target;
    
    // 检查是否需要隐藏选择按钮
    chrome.runtime.sendMessage({action: "getSettings"}, (settings) => {
      const selectButton = document.getElementById('select-input-button');
      if (settings.hideButtonAfterSelect) {
        selectButton.style.display = 'none';
      }
    });
    
    toggleSelectMode(); // 退出选择模式
    
    // 短暂高亮选中的输入框
    const originalOutline = target.style.outline;
    target.style.outline = '2px solid #4a90e2';
    setTimeout(() => {
      target.style.outline = originalOutline;
    }, 1000);
    
    return false;
  }
}

// 显示选择按钮
function showSelectButton() {
  const selectButton = document.getElementById('select-input-button');
  if (selectButton) {
    selectButton.style.display = 'block';
  }
}

// 向输入框插入文本
function insertTextToInput(input, text) {
  // 先聚焦到输入框
  input.focus();
  
  // 根据不同情况插入文本
  if (input.type === 'textarea' || input.type === 'text' || 
      input.type === 'email' || input.type === 'password' || 
      input.type === 'search' || input.type === 'tel' || 
      input.type === 'url' || !input.type) {
    
    // 标准文本输入框
    const startPos = input.selectionStart;
    const endPos = input.selectionEnd;
    const value = input.value;
    
    input.value = value.substring(0, startPos) + text + value.substring(endPos, value.length);
    
    // 设置光标位置
    input.selectionStart = startPos + text.length;
    input.selectionEnd = startPos + text.length;
    
  } else if (input.isContentEditable) {
    // 可编辑区域（如富文本编辑器）
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  
  // 触发输入事件，确保React等框架能检测到变化
  const event = new Event('input', { bubbles: true });
  input.dispatchEvent(event);
}

// 初始化插件
init();

// 监听存储变化，实时更新
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    chrome.runtime.sendMessage({action: "getSettings"}, (settings) => {
      // 检查当前页面是否在白名单中
      const currentDomain = window.location.hostname;
      if (settings.whitelist.length > 0 && !settings.whitelist.includes(currentDomain)) {
        if (quickWordBox) {
          quickWordBox.style.display = 'none';
        }
        return;
      } else if (quickWordBox) {
        quickWordBox.style.display = 'flex';
      }
      
      if (quickWordBox) {
        createQuickWordBox(settings);
      }
      
      // 检查是否需要显示选择按钮
      if (changes.hideButtonAfterSelect) {
        if (!settings.hideButtonAfterSelect) {
          showSelectButton();
        } else if (selectedInput) {
          const selectButton = document.getElementById('select-input-button');
          if (selectButton) {
            selectButton.style.display = 'none';
          }
        }
      }
    });
  }
});