// 主内容脚本
let quickWordBox = null;
let isSelecting = false;
let selectedInput = null;
let isDragging = false;
let dragStartX, dragStartY, initialLeft, initialTop;
let currentSettings = null; // 缓存设置
let sidebarVisible = false; // 侧边栏可见状态

// 初始化
function init() {
  // 从存储中获取设置
  chrome.runtime.sendMessage({action: "getSettings"}, (settings) => {
    currentSettings = settings; // 缓存设置
    
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
  quickWordBox.className = 'quick-word-box';
  
  // 应用样式
  applyBoxStyles(quickWordBox, settings);
  
  // 创建选择模式按钮
  const selectButton = createSelectButton();
  
  // 创建关键词容器
  const keywordsContainer = createKeywordsContainer(settings);
  
  // 创建侧边栏
  const sidebar = createSidebar(settings);
  
  // 创建侧边栏触发器
  const sidebarTrigger = createSidebarTrigger();
  
  // 添加到容器
  quickWordBox.appendChild(selectButton);
  quickWordBox.appendChild(keywordsContainer);
  quickWordBox.appendChild(sidebar);
  quickWordBox.appendChild(sidebarTrigger);
  
  // 添加到页面
  document.body.appendChild(quickWordBox);
  
  // 添加拖拽功能
  setupDragging(quickWordBox);
  
  // 根据设置决定是否显示选择按钮
  updateSelectButtonVisibility(selectedInput, settings.hideButtonAfterSelect);
  
  // 设置侧边栏交互
  setupSidebarInteraction(quickWordBox, sidebar, sidebarTrigger);
}

// 创建侧边栏
function createSidebar(settings) {
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  
  // 侧边栏内容
  sidebar.innerHTML = `
    <div class="sidebar-title">设置</div>
    <div class="setting-item">
      <span class="setting-label">自动发送</span>
      <label class="switch">
        <input type="checkbox" id="auto-send-toggle" ${settings.autoSend ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
    <button class="sidebar-button" id="reselect-input-button">重新选择输入框</button>
  `;
  
  // 添加自动发送切换事件
  const toggle = sidebar.querySelector('#auto-send-toggle');
  toggle.addEventListener('change', function() {
    chrome.storage.sync.set({autoSend: this.checked}, () => {
      if (currentSettings) {
        currentSettings.autoSend = this.checked;
      }
    });
  });
  
  // 添加重新选择输入框按钮事件
  const reselectButton = sidebar.querySelector('#reselect-input-button');
  reselectButton.addEventListener('click', () => {
    // 清除当前选择的输入框
    selectedInput = null;
    
    // 显示选择按钮
    showSelectButton();
    
    // 进入选择模式
    if (!isSelecting) {
      toggleSelectMode();
    }
  });
  
  return sidebar;
}

// 创建侧边栏触发器
function createSidebarTrigger() {
  const trigger = document.createElement('div');
  trigger.className = 'sidebar-trigger';
  
  const icon = document.createElement('div');
  icon.className = 'sidebar-trigger-icon';
  trigger.appendChild(icon);
  
  return trigger;
}

// 设置侧边栏交互
function setupSidebarInteraction(box, sidebar, trigger) {
  let hideTimeout = null;
  
  // 鼠标进入触发器显示侧边栏
  trigger.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
    sidebar.style.right = '0';
    sidebarVisible = true;
  });
  
  // 鼠标离开侧边栏隐藏
  sidebar.addEventListener('mouseleave', () => {
    hideTimeout = setTimeout(() => {
      sidebar.style.right = '-160px';
      sidebarVisible = false;
    }, 300);
  });
  
  // 鼠标进入侧边栏取消隐藏
  sidebar.addEventListener('mouseenter', () => {
    clearTimeout(hideTimeout);
  });
  
  // 点击触发器切换侧边栏
  trigger.addEventListener('click', () => {
    if (sidebarVisible) {
      sidebar.style.right = '-160px';
    } else {
      sidebar.style.right = '0';
    }
    sidebarVisible = !sidebarVisible;
  });
}

// 应用盒子样式
function applyBoxStyles(element, settings) {
  Object.assign(element.style, {
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
}

// 创建选择按钮
function createSelectButton() {
  const selectButton = document.createElement('button');
  selectButton.id = 'select-input-button';
  selectButton.className = 'select-input-button';
  selectButton.textContent = '选择输入框';
  selectButton.addEventListener('click', toggleSelectMode);
  
  Object.assign(selectButton.style, {
    padding: '5px 10px',
    marginBottom: '10px',
    cursor: 'pointer',
    backgroundColor: '#333',
    color: 'white',
    border: 'none',
    borderRadius: '4px'
  });
  
  return selectButton;
}

// 创建关键词容器
function createKeywordsContainer(settings) {
  const keywordsContainer = document.createElement('div');
  keywordsContainer.id = 'keywords-container';
  keywordsContainer.className = 'keywords-container';
  
  Object.assign(keywordsContainer.style, {
    overflowY: 'auto',
    flexGrow: '1',
    cursor: 'default'
  });
  
  // 使用事件委托处理关键词点击
  keywordsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('keyword-button') && selectedInput) {
      insertTextToInput(selectedInput, e.target.textContent);
      
      // 如果启用了自动发送，模拟按下Enter键
      if (currentSettings && currentSettings.autoSend) {
        simulateEnterKey(selectedInput);
      }
    }
  });
  
  // 添加关键词按钮
  addKeywordButtons(keywordsContainer, settings.keywords);
  
  return keywordsContainer;
}

// 模拟按下Enter键
function simulateEnterKey(input) {
  // 创建并分派keydown事件
  const keyDownEvent = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  });
  
  // 创建并分派keyup事件
  const keyUpEvent = new KeyboardEvent('keyup', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13,
    bubbles: true
  });
  
  // 分派事件
  input.dispatchEvent(keyDownEvent);
  input.dispatchEvent(keyUpEvent);
  
  // 对于表单，尝试提交
  if (input.form) {
    input.form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
  }
}

// 添加关键词按钮
function addKeywordButtons(container, keywords) {
  // 清空容器
  container.innerHTML = '';
  
  // 添加新的关键词按钮
  keywords.forEach(keyword => {
    const keywordButton = document.createElement('button');
    keywordButton.textContent = keyword;
    keywordButton.className = 'keyword-button';
    
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
    
    // 添加悬停效果
    keywordButton.addEventListener('mouseover', () => {
      keywordButton.style.backgroundColor = '#ccc';
    });
    
    keywordButton.addEventListener('mouseout', () => {
      keywordButton.style.backgroundColor = 'transparent';
    });
    
    container.appendChild(keywordButton);
  });
}

// 设置拖拽功能
function setupDragging(element) {
  let dragTimeout = null;
  
  element.addEventListener('mousedown', (e) => {
    // 如果点击的是按钮或关键词按钮，不触发拖拽
    if (e.target.tagName === 'BUTTON' || isSelecting || 
        e.target.closest('.sidebar') || e.target.closest('.sidebar-trigger')) {
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
  
  // 使用防抖优化拖拽性能
  const dragHandler = (e) => {
    if (!isDragging) return;
    
    if (dragTimeout) {
      clearTimeout(dragTimeout);
    }
    
    dragTimeout = setTimeout(() => {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      
      element.style.left = `${initialLeft + dx}px`;
      element.style.top = `${initialTop + dy}px`;
    }, 10); // 10ms的防抖延迟
  };
  
  document.addEventListener('mousemove', dragHandler);
  
  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    
    isDragging = false;
    element.style.cursor = 'move';
    
    if (dragTimeout) {
      clearTimeout(dragTimeout);
    }
    
    // 保存新位置
    const newPosition = {
      left: parseInt(element.style.left, 10),
      top: parseInt(element.style.top, 10)
    };
    
    // 更新缓存设置
    if (currentSettings) {
      currentSettings.boxPosition = newPosition;
    }
    
    chrome.storage.sync.set({boxPosition: newPosition});
  });
}

// 切换选择模式
function toggleSelectMode(e) {
  // 防止拖拽时触发选择模式
  if (isDragging) {
    e && e.stopPropagation();
    return;
  }
  
  isSelecting = !isSelecting;
  const selectButton = document.getElementById('select-input-button');
  
  if (isSelecting) {
    selectButton.textContent = '取消选择';
    selectButton.style.backgroundColor = '#ffdddd';
    
    // 添加输入框高亮样式
    addInputHighlightStyle();
    
    // 添加点击事件监听器
    document.addEventListener('click', handleInputSelection, true);
  } else {
    selectButton.textContent = '选择输入框';
    selectButton.style.backgroundColor = '#333';
    
    // 移除高亮样式
    removeInputHighlightStyle();
    
    // 移除点击事件监听器
    document.removeEventListener('click', handleInputSelection, true);
  }
  
  if (e) {
    e.stopPropagation();
  }
}

// 添加输入框高亮样式
function addInputHighlightStyle() {
  // 检查是否已存在样式
  if (document.getElementById('input-highlight-style')) return;
  
  const style = document.createElement('style');
  style.id = 'input-highlight-style';
  style.textContent = `
    input:hover, textarea:hover {
      outline: 2px solid #4a90e2 !important;
      cursor: pointer !important;
    }
  `;
  document.head.appendChild(style);
}

// 移除输入框高亮样式
function removeInputHighlightStyle() {
  const style = document.getElementById('input-highlight-style');
  if (style) style.remove();
}

// 处理输入框选择
function handleInputSelection(e) {
  const target = e.target;
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    e.preventDefault();
    e.stopPropagation();
    
    selectedInput = target;
    
    // 更新选择按钮显示状态
    if (currentSettings) {
      updateSelectButtonVisibility(selectedInput, currentSettings.hideButtonAfterSelect);
    }
    
    toggleSelectMode(); // 退出选择模式
    
    // 短暂高亮选中的输入框
    highlightInput(target);
    
    return false;
  }
}

// 高亮输入框
function highlightInput(input) {
  const originalOutline = input.style.outline;
  input.style.outline = '2px solid #4a90e2';
  setTimeout(() => {
    input.style.outline = originalOutline;
  }, 1000);
}

// 更新选择按钮可见性
function updateSelectButtonVisibility(input, hideButtonAfterSelect) {
  const selectButton = document.getElementById('select-input-button');
  if (!selectButton) return;
  
  if (hideButtonAfterSelect && input) {
    selectButton.style.display = 'none';
  } else {
    selectButton.style.display = 'block';
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
  if (area === 'sync' && currentSettings) {
    // 更新缓存设置
    for (let key in changes) {
      if (currentSettings.hasOwnProperty(key)) {
        currentSettings[key] = changes[key].newValue;
      }
    }
    
    // 检查当前页面是否在白名单中
    const currentDomain = window.location.hostname;
    if (currentSettings.whitelist.length > 0 && !currentSettings.whitelist.includes(currentDomain)) {
      if (quickWordBox) {
        quickWordBox.style.display = 'none';
      }
      return;
    } else if (quickWordBox) {
      quickWordBox.style.display = 'flex';
    }
    
    // 只更新需要更新的部分
    if (changes.keywords && quickWordBox) {
      const keywordsContainer = quickWordBox.querySelector('.keywords-container');
      if (keywordsContainer) {
        addKeywordButtons(keywordsContainer, currentSettings.keywords);
      }
    }
    
    if (changes.boxSize && quickWordBox) {
      quickWordBox.style.width = `${currentSettings.boxSize.width}px`;
      quickWordBox.style.height = `${currentSettings.boxSize.height}px`;
    }
    
    if (changes.boxColor && quickWordBox) {
      quickWordBox.style.backgroundColor = currentSettings.boxColor;
    }
    
    if (changes.borderColor && quickWordBox) {
      quickWordBox.style.borderColor = currentSettings.borderColor;
    }
    
    if (changes.borderRadius && quickWordBox) {
      quickWordBox.style.borderRadius = `${currentSettings.borderRadius}px`;
    }
    
    if (changes.opacity && quickWordBox) {
      quickWordBox.style.opacity = currentSettings.opacity;
    }
    
    // 更新自动发送开关状态
    if (changes.autoSend && quickWordBox) {
      const autoSendToggle = quickWordBox.querySelector('#auto-send-toggle');
      if (autoSendToggle) {
        autoSendToggle.checked = currentSettings.autoSend;
      }
    }
    
    // 检查是否需要显示选择按钮
    if (changes.hideButtonAfterSelect) {
      updateSelectButtonVisibility(selectedInput, currentSettings.hideButtonAfterSelect);
    }
  }
});