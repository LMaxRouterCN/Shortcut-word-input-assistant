// ==UserScript==
// @name         文本快捷输入助手
// @namespace    http://tampermonkey.net/
// @version      4.9
// @description
// @author       LMaxRouterCN
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
    'use strict';

    // ================= 默认配置 =================
    const DEFAULT_CONFIG = {
        runOnAllSites: false,
        whiteList: ["localhost", "127.0.0.1", "example.com"],
        headerPosition: 'top',
        autoCollapse: false,
        autoCollapseDelay: 300,
        autoEnter: false,
        phrases: [
            { name: "邮箱", content: "myemail@example.com" },
            { name: "手机号", content: "13800138000" },
            { name: "这是一句完整的话", content: "这是一句完整的话" }
        ],
        style: {
            width: 220,
            height: null,
            borderRadius: 8,
            animationSpeed: 0.25,
            bgColor: "#ffffff",
            textColor: "#333333",
            headerBgColor: "#f0f0f0",
            btnBgColor: "#e8f4ff",
            btnTextColor: "#0052cc",
            btnBorderColor: "#b6d4fe"
        }
    };

    // ================= 工具函数 =================

    const currentHost = window.location.hostname;

    function loadGlobalConfig() {
        const saved = GM_getValue('quick_input_config');
        if (!saved) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        try {
            const cfg = { ...DEFAULT_CONFIG, ...saved };
            cfg.style = { ...DEFAULT_CONFIG.style, ...(saved.style || {}) };
            return cfg;
        } catch (e) { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
    }

    function loadSiteLayout() {
        const key = `qip_layout_${currentHost}`;
        const saved = GM_getValue(key);
        if (saved) {
            return {
                left: saved.left,
                top: saved.top,
                width: saved.width,
                height: saved.height
            };
        }
        return null;
    }

    function saveGlobalConfig(config) {
        const dataToSave = {
            runOnAllSites: config.runOnAllSites,
            whiteList: config.whiteList,
            headerPosition: config.headerPosition,
            autoCollapse: config.autoCollapse,
            autoCollapseDelay: config.autoCollapseDelay,
            autoEnter: config.autoEnter,
            phrases: config.phrases,
            style: config.style
        };
        GM_setValue('quick_input_config', dataToSave);
    }

    function saveSiteLayout(layout) {
        const key = `qip_layout_${currentHost}`;
        GM_setValue(key, {
            left: layout.left,
            top: layout.top,
            width: layout.width,
            height: layout.height
        });
    }

    let config = loadGlobalConfig();
    const siteLayout = loadSiteLayout();
    if (siteLayout) {
        config.position = { top: siteLayout.top, left: siteLayout.left };
        config.style.width = siteLayout.width;
        config.style.height = siteLayout.height;
    } else {
        config.position = { top: 100, left: null, right: 20 };
    }

    let panelInstance = null;
    let targetElement = null;
    let styleElement = null;
    let isInitialized = false;

    function isHostAllowed(hostname, whiteList) {
        if (config.runOnAllSites) return true;
        return whiteList.some(domain => {
            if (hostname === domain) return true;
            if (hostname.endsWith('.' + domain)) return true;
            return false;
        });
    }

    // ================= 样式注入 =================
    function injectStyles() {
        if (styleElement) styleElement.remove();
        styleElement = document.createElement('style');
        styleElement.id = 'qip-styles';
        const radius = config.style.borderRadius || 0;
        const animSpeed = (config.style.animationSpeed !== undefined ? config.style.animationSpeed : 0.25);

        styleElement.textContent = `
            #quick-input-panel {
                position: fixed;
                background: ${config.style.bgColor};
                color: ${config.style.textColor};
                border: 1px solid #ddd;
                border-radius: ${radius}px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                z-index: 2147483647;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 13px;
                user-select: none;
                display: flex;
                box-sizing: border-box;
                overflow: hidden;
                transition:
                    height ${animSpeed}s cubic-bezier(0.4, 0, 0.2, 1),
                    width ${animSpeed}s cubic-bezier(0.4, 0, 0.2, 1),
                    top ${animSpeed}s cubic-bezier(0.4, 0, 0.2, 1),
                    left ${animSpeed}s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .qip-layout-top { flex-direction: column; justify-content: flex-start; }
            .qip-layout-bottom { flex-direction: column; justify-content: flex-end; }
            .qip-layout-left { flex-direction: row; justify-content: flex-start; }
            .qip-layout-right { flex-direction: row; justify-content: flex-end; }

            .qip-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: ${config.style.headerBgColor};
                border-bottom: 1px solid #eee;
                cursor: move;
                flex-shrink: 0;
                transition: border-radius ${animSpeed}s, border-width ${animSpeed}s;
            }
            .qip-layout-left .qip-header, .qip-layout-right .qip-header {
                flex-direction: column;
                padding: 10px 8px;
                writing-mode: vertical-rl;
                min-height: 60px;
            }
            .qip-layout-top .qip-header { border-bottom: 1px solid #eee; border-top: none; border-left: none; border-right: none; }
            .qip-layout-bottom .qip-header { border-top: 1px solid #eee; border-bottom: none; border-left: none; border-right: none; }
            .qip-layout-left .qip-header { border-right: 1px solid #eee; border-left: none; border-top: none; border-bottom: none; }
            .qip-layout-right .qip-header { border-left: 1px solid #eee; border-right: none; border-top: none; border-bottom: none; }

            .qip-header { border-radius: 0; }
            .qip-layout-top .qip-header { border-radius: ${radius}px ${radius}px 0 0; }
            .qip-layout-bottom .qip-header { border-radius: 0 0 ${radius}px ${radius}px; }
            .qip-layout-left .qip-header { border-radius: ${radius}px 0 0 ${radius}px; }
            .qip-layout-right .qip-header { border-radius: 0 ${radius}px ${radius}px 0; }

            #quick-input-panel.is-collapsed .qip-header {
                border-radius: ${radius}px !important;
                border-color: transparent !important;
            }

            .qip-title { font-weight: bold; font-size: 14px; pointer-events: none; }
            .qip-actions { display: flex; gap: 2px; }
            .qip-actions button {
                background: transparent; border: none; cursor: pointer;
                font-size: 16px; padding: 2px; color: #666; line-height: 1;
            }
            .qip-actions button:hover { color: #000; }

            .qip-body {
                padding: 10px;
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                min-width: 0;
                min-height: 0;
                transition: padding 0s;
            }
            .qip-layout-left .qip-body, .qip-layout-right .qip-body { width: 180px; height: auto; }

            .qip-layout-top .qip-body { display: flex; flex-direction: column; justify-content: flex-end; }
            .qip-layout-left .qip-body { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; }
            .qip-layout-left .qip-btn { width: auto; min-width: 80%; }

            .qip-resize { position: absolute; background: transparent; z-index: 10; display: block; width: 8px; height: 8px; }
            #quick-input-panel.is-collapsed .qip-resize { display: none; }
            .qip-resize-top    { top: -2px; left: 10px; right: 10px; width: auto; height: 5px; cursor: n-resize; }
            .qip-resize-bottom { bottom: -2px; left: 10px; right: 10px; width: auto; height: 5px; cursor: s-resize; }
            .qip-resize-left   { left: -2px; top: 10px; bottom: 10px; width: 5px; height: auto; cursor: w-resize; }
            .qip-resize-right  { right: -2px; top: 10px; bottom: 10px; width: 5px; height: auto; cursor: e-resize; }
            .qip-resize-tl { top: -2px; left: -2px; cursor: nwse-resize; }
            .qip-resize-tr { top: -2px; right: -2px; cursor: nesw-resize; }
            .qip-resize-bl { bottom: -2px; left: -2px; cursor: nesw-resize; }
            .qip-resize-br { bottom: -2px; right: -2px; cursor: nwse-resize; }

            .qip-btn {
                display: block; width: 100%; padding: 8px; margin-bottom: 6px;
                background: ${config.style.btnBgColor}; color: ${config.style.btnTextColor};
                border: 1px solid ${config.style.btnBorderColor}; border-radius: 4px;
                text-align: left; cursor: pointer;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                transition: filter 0.2s;
            }
            .qip-btn:hover { filter: brightness(0.95); }
            .qip-btn:active { filter: brightness(0.85); }

            .qip-status {
                margin-top: 8px; font-size: 11px; color: #888; text-align: center;
                border-top: 1px solid #eee; padding-top: 6px;
            }
            .qip-layout-left .qip-status, .qip-layout-right .qip-status {
                border-top: none; border-left: 1px solid #eee; margin-top: 0; padding-top: 0; padding-left: 6px;
                writing-mode: vertical-rl; text-align: left;
            }

            .qip-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2147483647; display: flex; justify-content: center; align-items: center; }
            .qip-modal { background: #fff; width: 500px; max-width: 95vw; max-height: 90vh; border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,0.3); display: flex; flex-direction: column; font-family: system-ui; color: #000; }
            .qip-modal-header { padding: 15px 20px; border-bottom: 1px solid #eee; font-size: 16px; font-weight: bold; display: flex; justify-content: space-between; }
            .qip-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
            .qip-modal-footer { padding: 15px; border-top: 1px solid #eee; text-align: right; background: #f9f9f9; border-radius: 0 0 10px 10px; }
            .form-group { margin-bottom: 18px; }
            .form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 13px; }
            .form-group input[type="text"], .form-group input[type="number"], .form-group textarea, .form-group select { width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; background: #fff; }
            .form-group textarea { height: 120px; font-family: monospace; }
            .form-group input[type="color"] { width: 100%; height: 40px; padding: 0; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; cursor: pointer; }

            .form-row { display: flex; gap: 10px; margin-bottom: 15px; }
            .form-row > div { flex: 1; margin-bottom: 0; }
            .pos-inputs { display: flex; gap: 5px; }
            .pos-inputs input { width: 50%; }

            .btn-save { background: #0052cc; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; }
            .btn-cancel { background: #f4f5f7; border: 1px solid #ccc; padding: 8px 20px; border-radius: 4px; cursor: pointer; margin-right: 10px; font-size: 14px; }
            .disabled-group { opacity: 0.5; pointer-events: none; }
        `;
        document.head.appendChild(styleElement);
    }

    // ================= 核心逻辑 =================

    function insertText(element, text) {
        element.focus();
        const success = document.execCommand('insertText', false, text);

        if (success) {
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            updateStatus('✅ 已输入', true);

            if (config.autoEnter) {
                setTimeout(() => {
                    simulateEnterKey(element);
                    updateStatus('✅ 已发送', true);
                }, 50);
            }
            return;
        }

        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const val = element.value;
            const newValue = val.substring(0, start) + text + val.substring(end);

            const proto = Object.getPrototypeOf(element);
            const descriptor = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(element, 'value');

            if (descriptor && descriptor.set) {
                descriptor.set.call(element, newValue);
            } else {
                element.value = newValue;
            }

            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            const newCursorPos = start + text.length;
            element.setSelectionRange(newCursorPos, newCursorPos);

            updateStatus('✅ 已输入 (兼容模式)', true);

            if (config.autoEnter) {
                setTimeout(() => {
                    simulateEnterKey(element);
                    updateStatus('✅ 已发送', true);
                }, 50);
            }
            return;
        }

        if (element.isContentEditable) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            updateStatus('✅ 已输入 (富文本)', true);

            if (config.autoEnter) {
                setTimeout(() => {
                    simulateEnterKey(element);
                    updateStatus('✅ 已发送', true);
                }, 50);
            }
            return;
        }

        updateStatus('⚠️ 输入失败', true);
    }

    function simulateEnterKey(element) {
        const enterEvent = new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13
        });
        element.dispatchEvent(enterEvent);

        const enterEventUp = new KeyboardEvent('keyup', {
            bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13
        });
        element.dispatchEvent(enterEventUp);
    }

    function updateStatus(msg, isTemp = false) {
        if (!panelInstance) return;
        const status = panelInstance.querySelector('.qip-status');
        if (status) {
            status.textContent = msg;
            if (isTemp) setTimeout(() => { if(status.textContent.includes('已输入') || status.textContent.includes('已发送')) status.textContent = "等待操作..."; }, 2000);
        }
    }

    function createPanel(cfg) {
        const existingPanel = document.getElementById('quick-input-panel');
        if (existingPanel) existingPanel.remove();

        const div = document.createElement('div');
        div.id = 'quick-input-panel';
        div.className = `qip-layout-${cfg.headerPosition}`;

        if (cfg.position.left !== null && cfg.position.left !== undefined) {
            div.style.left = cfg.position.left + 'px';
        } else if (cfg.position.right !== null && cfg.position.right !== undefined) {
            div.style.right = cfg.position.right + 'px';
        } else {
            div.style.right = 20 + 'px';
        }
        div.style.top = cfg.position.top + 'px';

        setTimeout(() => {
            if (div.style.right) {
                const rect = div.getBoundingClientRect();
                div.style.left = rect.left + 'px';
                div.style.right = 'auto';
            }
        }, 0);

        const itemsHtml = cfg.phrases.map((p, i) =>
            `<button class="qip-btn" data-idx="${i}" title="${p.content}">${p.name}</button>`
        ).join('');

        const isReverse = (cfg.headerPosition === 'bottom' || cfg.headerPosition === 'right');

        const headerHtml = `
            <div class="qip-header">
                <span class="qip-title">快捷输入</span>
                <div class="qip-actions">
                    <button id="qip-settings">⚙️</button>
                    <button id="qip-toggle">−</button>
                </div>
            </div>`;

        const bodyHtml = `
            <div class="qip-body">
                ${itemsHtml || '<div style="color:#999; text-align:center; padding:10px;">暂无短语</div>'}
                <div class="qip-status">点击输入框后生效</div>
            </div>
            <div class="qip-resize qip-resize-top" data-dir="n"></div>
            <div class="qip-resize qip-resize-bottom" data-dir="s"></div>
            <div class="qip-resize qip-resize-left" data-dir="w"></div>
            <div class="qip-resize qip-resize-right" data-dir="e"></div>
            <div class="qip-resize qip-resize-tl" data-dir="nw"></div>
            <div class="qip-resize qip-resize-tr" data-dir="ne"></div>
            <div class="qip-resize qip-resize-bl" data-dir="sw"></div>
            <div class="qip-resize qip-resize-br" data-dir="se"></div>`;

        div.innerHTML = isReverse ? (bodyHtml + headerHtml) : (headerHtml + bodyHtml);

        let isDragging = false, isResizing = false, resizeDir = '';
        let isInteracting = false;
        let autoCollapseTimer = null;
        let startX, startY, startLeft, startTop, startW, startH;

        function animatePanel(shouldCollapse) {
            const header = div.querySelector('.qip-header');
            const pos = cfg.headerPosition;
            const currentRect = div.getBoundingClientRect();
            const headerRect = header.getBoundingClientRect();

            div.classList.toggle('is-collapsed', shouldCollapse);
            div.querySelector('#qip-toggle').textContent = shouldCollapse ? '+' : '−';

            const computedStyle = getComputedStyle(div);
            const borderH = parseFloat(computedStyle.borderTopWidth) + parseFloat(computedStyle.borderBottomWidth);
            const borderW = parseFloat(computedStyle.borderLeftWidth) + parseFloat(computedStyle.borderRightWidth);

            div.style.transition = 'none';
            div.style.width = currentRect.width + 'px';
            div.style.height = currentRect.height + 'px';
            div.style.left = currentRect.left + 'px';
            div.style.top = currentRect.top + 'px';

            void div.offsetWidth;
            div.style.transition = '';

            if (shouldCollapse) {
                if (pos === 'top') {
                    div.style.height = (headerRect.height + borderH) + 'px';
                } else if (pos === 'bottom') {
                    div.style.height = (headerRect.height + borderH) + 'px';
                    div.style.top = (currentRect.bottom - headerRect.height - borderH) + 'px';
                } else if (pos === 'left') {
                    div.style.width = (headerRect.width + borderW) + 'px';
                } else if (pos === 'right') {
                    div.style.width = (headerRect.width + borderW) + 'px';
                    div.style.left = (currentRect.right - headerRect.width - borderW) + 'px';
                }
            } else {
                div.style.width = 'auto';
                div.style.height = 'auto';
                const targetRect = div.getBoundingClientRect();

                let finalW = cfg.style.width || targetRect.width;
                let finalH = cfg.style.height || targetRect.height;

                div.style.width = currentRect.width + 'px';
                div.style.height = currentRect.height + 'px';

                void div.offsetWidth;

                if (pos === 'top') {
                    div.style.height = finalH + 'px';
                    div.style.width = finalW + 'px';
                } else if (pos === 'bottom') {
                    div.style.height = finalH + 'px';
                    div.style.top = (currentRect.bottom - finalH) + 'px';
                    div.style.width = finalW + 'px';
                } else if (pos === 'left') {
                    div.style.width = finalW + 'px';
                    div.style.height = finalH + 'px';
                } else if (pos === 'right') {
                    div.style.width = finalW + 'px';
                    div.style.left = (currentRect.right - finalW) + 'px';
                    div.style.height = finalH + 'px';
                }

                setTimeout(() => {
                    if (!div.classList.contains('is-collapsed')) {
                        if (!cfg.style.height) div.style.height = 'auto';
                        if (!cfg.style.width) div.style.width = 'auto';
                    }
                }, cfg.style.animationSpeed * 1000);
            }
        }

        div.querySelector('#qip-toggle').onclick = (e) => {
            const isCurrentlyCollapsed = div.classList.contains('is-collapsed');
            animatePanel(!isCurrentlyCollapsed);
        };

        div.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            const target = e.target;
            startX = e.clientX; startY = e.clientY;
            const rect = div.getBoundingClientRect();
            startLeft = rect.left; startTop = rect.top;
            startW = rect.width; startH = rect.height;

            if (target.classList.contains('qip-resize')) {
                isResizing = true; resizeDir = target.dataset.dir;
                document.body.style.cursor = getComputedStyle(target).cursor;
                div.style.transition = 'none'; // 禁用动画
                isInteracting = true;
            } else if (target.closest('.qip-header') && !target.closest('button')) {
                isDragging = true;
                document.body.style.cursor = 'move';
                div.style.transition = 'none'; // 【关键修复】拖拽时禁用动画，防止延迟
                isInteracting = true;
            } else { return; }

            e.preventDefault();
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            const dx = e.clientX - startX; const dy = e.clientY - startY;
            if (isResizing) {
                let newW = startW, newH = startH, newL = startLeft, newT = startTop;
                if (resizeDir.includes('e')) newW = Math.max(100, startW + dx);
                if (resizeDir.includes('w')) { newW = Math.max(100, startW - dx); newL = startLeft + (startW - newW); }
                if (resizeDir.includes('s')) newH = Math.max(60, startH + dy);
                if (resizeDir.includes('n')) { newH = Math.max(60, startH - dy); newT = startTop + (startH - newH); }
                div.style.left = newL + 'px'; div.style.top = newT + 'px';
                div.style.width = newW + 'px'; div.style.height = newH + 'px';
            } else if (isDragging) {
                div.style.left = (startLeft + dx) + 'px';
                div.style.top = (startTop + dy) + 'px';
                if (div.style.right) div.style.right = 'auto';
            }
        }

        function onMouseUp() {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';

            if (isDragging || isResizing) {
                const rect = div.getBoundingClientRect();
                cfg.position.left = rect.left;
                cfg.position.top = rect.top;
                cfg.style.width = rect.width;
                if (!div.classList.contains('is-collapsed')) {
                    cfg.style.height = rect.height;
                }
                saveSiteLayout({
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: cfg.style.height
                });
            }
            div.style.transition = ''; // 恢复动画
            isDragging = false; isResizing = false;
            isInteracting = false;
        }

        div.addEventListener('mouseenter', () => {
            if (!cfg.autoCollapse) return;
            clearTimeout(autoCollapseTimer);
            if (!isInteracting && div.classList.contains('is-collapsed')) {
                animatePanel(false);
            }
        });

        div.addEventListener('mouseleave', () => {
            if (!cfg.autoCollapse) return;
            clearTimeout(autoCollapseTimer);
            if (!isInteracting && !div.classList.contains('is-collapsed')) {
                const delay = (typeof cfg.autoCollapseDelay === 'number') ? cfg.autoCollapseDelay : 300;
                autoCollapseTimer = setTimeout(() => {
                    if (!isInteracting) animatePanel(true);
                }, delay);
            }
        });

        div.querySelector('#qip-settings').onclick = (e) => { e.stopPropagation(); createSettingsModal(cfg); };
        div.querySelector('.qip-body').onclick = (e) => {
            const btn = e.target.closest('.qip-btn');
            if (btn) {
                const idx = btn.dataset.idx;
                if (targetElement) insertText(targetElement, cfg.phrases[idx].content);
                else updateStatus('⚠️ 请先点击输入框', true);
            }
        };

        document.body.appendChild(div);

        if (cfg.style.width) div.style.width = cfg.style.width + 'px';
        if (cfg.style.height) div.style.height = cfg.style.height + 'px';

        return div;
    }

    // ================= 设置面板 =================
    function createSettingsModal(currentCfg) {
        const old = document.querySelector('.qip-modal-overlay');
        if (old) old.remove();
        const overlay = document.createElement('div');
        overlay.className = 'qip-modal-overlay';

        const listToText = (arr, key) => (arr || []).map(i => key ? i[key] : i).join('\n');
        const phrasesToText = (arr) => (arr || []).map(p => (p.name === p.content) ? p.content : `${p.name}||${p.content}`).join('\n');

        overlay.innerHTML = `
            <div class="qip-modal">
                <div class="qip-modal-header"><span>全局设置面板</span><span style="cursor:pointer" id="modal-close">✖</span></div>
                <div class="qip-modal-body">
                    <div class="form-group">
                        <label>🌐 运行规则</label>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <input type="checkbox" id="cfg-runAll" ${currentCfg.runOnAllSites ? 'checked' : ''}>
                            <span style="font-size:13px">在所有网站运行</span>
                        </div>
                    </div>

                    <div class="form-group" style="background:#f8f9fa; padding:10px; border-radius:6px; border:1px solid #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <input type="checkbox" id="cfg-autoCollapse" ${currentCfg.autoCollapse ? 'checked' : ''}>
                            <span style="font-size:13px; font-weight:bold">鼠标离开自动收起</span>
                        </div>
                        <div class="form-group" id="delay-group" style="margin-bottom:10px; margin-left:25px; ${currentCfg.autoCollapse ? '' : 'opacity:0.5; pointer-events:none;'}">
                            <label style="font-size:12px; color:#555;">延迟收起时间 (毫秒)</label>
                            <input type="number" id="cfg-autoCollapseDelay" value="${currentCfg.autoCollapseDelay || 300}" placeholder="300">
                        </div>
                        <div style="display:flex; align-items:center; gap:10px; border-top:1px solid #e0e0e0; padding-top:10px;">
                            <input type="checkbox" id="cfg-autoEnter" ${currentCfg.autoEnter ? 'checked' : ''}>
                            <span style="font-size:13px; font-weight:bold">输入后自动发送 (模拟回车)</span>
                        </div>
                    </div>

                    <div class="form-group" id="whitelist-group" style="${currentCfg.runOnAllSites ? 'opacity:0.5;pointer-events:none':''}">
                        <label>📝 网站白名单</label>
                        <textarea id="cfg-whitelist">${listToText(currentCfg.whiteList)}</textarea>
                    </div>

                    <div style="border-top: 1px solid #eee; margin: 20px 0; padding-top: 10px;">
                        <label style="font-weight: bold; margin-bottom: 10px; display:block;">🎨 外观与布局</label>

                        <div class="form-row">
                            <div class="form-group">
                                <label>📐 标题栏位置</label>
                                <select id="cfg-headerPos">
                                    <option value="top" ${currentCfg.headerPosition === 'top' ? 'selected' : ''}>顶部 (向下展开)</option>
                                    <option value="bottom" ${currentCfg.headerPosition === 'bottom' ? 'selected' : ''}>底部 (向上展开)</option>
                                    <option value="left" ${currentCfg.headerPosition === 'left' ? 'selected' : ''}>左边 (向右展开)</option>
                                    <option value="right" ${currentCfg.headerPosition === 'right' ? 'selected' : ''}>右边 (向左展开)</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label>📐 宽度</label>
                                <input type="number" id="cfg-width" value="${currentCfg.style.width}">
                            </div>
                            <div class="form-group">
                                <label>📐 高度 (留空自适应)</label>
                                <input type="number" id="cfg-height" value="${currentCfg.style.height || ''}" placeholder="自适应">
                            </div>
                            <div class="form-group">
                                <label>📍 位置 (左/上)</label>
                                <div class="pos-inputs">
                                    <input type="number" id="cfg-posX" value="${currentCfg.position.left}" placeholder="左">
                                    <input type="number" id="cfg-posY" value="${currentCfg.position.top}" placeholder="上">
                                </div>
                            </div>
                        </div>
                        <div class="form-row">
                             <div class="form-group" style="flex:0 0 30%;">
                                <label>🔲 圆角</label>
                                <input type="number" id="cfg-radius" value="${currentCfg.style.borderRadius}" placeholder="0">
                            </div>
                             <div class="form-group" style="flex:0 0 30%;">
                                <label>⚡ 动画(秒)</label>
                                <input type="number" id="cfg-anim" step="0.1" value="${currentCfg.style.animationSpeed}" placeholder="0.3">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>面板背景</label><input type="color" id="cfg-bgColor" value="${currentCfg.style.bgColor}"></div>
                            <div class="form-group"><label>标题背景</label><input type="color" id="cfg-headerBg" value="${currentCfg.style.headerBgColor}"></div>
                        </div>
                        <div class="form-row">
                            <div class="form-group"><label>按钮背景</label><input type="color" id="cfg-btnBg" value="${currentCfg.style.btnBgColor}"></div>
                            <div class="form-group"><label>按钮文字</label><input type="color" id="cfg-btnText" value="${currentCfg.style.btnTextColor}"></div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>💬 快捷短语 (无分隔符时自动同名)</label>
                        <textarea id="cfg-phrases">${phrasesToText(currentCfg.phrases)}</textarea>
                    </div>

                    <div class="form-group">
                         <button id="cfg-reset" style="width:100%; padding:10px; background:#fff; border:1px dashed #aaa; cursor:pointer;">重置所有设置</button>
                    </div>
                </div>
                <div class="qip-modal-footer">
                    <button class="btn-cancel" id="modal-cancel">取消</button>
                    <button class="btn-save" id="modal-save">保存并应用</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        document.getElementById('modal-close').onclick = close;
        document.getElementById('modal-cancel').onclick = close;

        document.getElementById('cfg-runAll').onchange = (e) => {
            const group = document.getElementById('whitelist-group');
            group.style.opacity = e.target.checked ? '0.5' : '1';
            group.style.pointerEvents = e.target.checked ? 'none' : 'auto';
        };

        document.getElementById('cfg-autoCollapse').onchange = (e) => {
            const group = document.getElementById('delay-group');
            if (e.target.checked) {
                group.style.opacity = '1';
                group.style.pointerEvents = 'auto';
            } else {
                group.style.opacity = '0.5';
                group.style.pointerEvents = 'none';
            }
        };

        document.getElementById('cfg-reset').onclick = () => {
            if(confirm("确定要重置所有设置吗？位置、大小、颜色都将恢复默认。\n注意：这会重置所有网站的全局设置，但不会清除各网站的独立位置记录。")){
                GM_setValue('quick_input_config', DEFAULT_CONFIG);
                alert('重置成功！即将刷新页面。');
                window.location.reload();
            }
        };

        document.getElementById('modal-save').onclick = () => {
            try {
                const rawPhrases = document.getElementById('cfg-phrases').value.split('\n');
                const newPhrases = rawPhrases.map(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;
                    if (trimmed.includes('||')) {
                        const idx = trimmed.indexOf('||');
                        const name = trimmed.substring(0, idx).trim();
                        const content = trimmed.substring(idx + 2).trim();
                        if (name && content) return { name, content };
                    }
                    return { name: trimmed, content: trimmed };
                }).filter(p => p && p.name && p.content);

                currentCfg.runOnAllSites = document.getElementById('cfg-runAll').checked;
                currentCfg.autoCollapse = document.getElementById('cfg-autoCollapse').checked;

                const delayVal = parseInt(document.getElementById('cfg-autoCollapseDelay').value);
                currentCfg.autoCollapseDelay = isNaN(delayVal) ? 300 : delayVal;
                currentCfg.autoEnter = document.getElementById('cfg-autoEnter').checked;

                currentCfg.whiteList = document.getElementById('cfg-whitelist').value.split('\n').map(s => s.trim()).filter(s => s);
                currentCfg.phrases = newPhrases;

                currentCfg.headerPosition = document.getElementById('cfg-headerPos').value;

                currentCfg.style.width = parseInt(document.getElementById('cfg-width').value) || 220;
                const heightVal = document.getElementById('cfg-height').value;
                currentCfg.style.height = heightVal ? (parseInt(heightVal) || null) : null;

                const posX = parseInt(document.getElementById('cfg-posX').value);
                const posY = parseInt(document.getElementById('cfg-posY').value);
                if(!isNaN(posX)) currentCfg.position.left = posX;
                if(!isNaN(posY)) currentCfg.position.top = posY;

                currentCfg.style.borderRadius = parseInt(document.getElementById('cfg-radius').value) || 0;
                const animVal = parseFloat(document.getElementById('cfg-anim').value);
                currentCfg.style.animationSpeed = isNaN(animVal) ? 0.25 : animVal;

                currentCfg.style.bgColor = document.getElementById('cfg-bgColor').value;
                currentCfg.style.headerBgColor = document.getElementById('cfg-headerBg').value;
                currentCfg.style.btnBgColor = document.getElementById('cfg-btnBg').value;
                currentCfg.style.btnTextColor = document.getElementById('cfg-btnText').value;

                saveGlobalConfig(currentCfg);
                saveSiteLayout({
                    left: currentCfg.position.left,
                    top: currentCfg.position.top,
                    width: currentCfg.style.width,
                    height: currentCfg.style.height
                });

                config = currentCfg;
                injectStyles();
                panelInstance = createPanel(config);
                close();
            } catch (err) {
                alert('保存失败：' + err.message);
            }
        };
    }

    // ================= 初始化逻辑 =================
    function initScript() {
        if (isInitialized) return;
        isInitialized = true;

        injectStyles();
        panelInstance = createPanel(config);

        document.addEventListener('focusin', (e) => {
            const el = e.target;
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
                targetElement = el;
                updateStatus(`目标: ${el.id || el.name || el.tagName}`);
            }
        }, true);
    }

    // ================= 菜单注册 =================
    GM_registerMenuCommand("⚙️ 打开快捷输入设置", () => {
        if (!isInitialized) initScript();
        createSettingsModal(config);
    });

    GM_registerMenuCommand("➕ 将当前网站加入白名单", () => {
        if (config.runOnAllSites) {
            alert('当前已开启“在所有网站运行”模式，无需添加白名单。');
            return;
        }
        if (config.whiteList.includes(currentHost)) {
            alert(`${currentHost} 已在白名单中。`);
            return;
        }

        config.whiteList.push(currentHost);
        saveGlobalConfig(config);
        alert(`已将 ${currentHost} 加入白名单，插件已激活！`);

        if (!isInitialized) {
            initScript();
        }
    });

    // ================= 启动检查 =================
    if (isHostAllowed(currentHost, config.whiteList)) {
        initScript();
    }

})();
