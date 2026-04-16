// code.js — Figma main thread
figma.showUI(__html__, { width: 320, height: 560, title: 'Iconfont Replacer' });

const ICONFONT_PROXY = 'http://localhost:17788';

// On startup: read persisted data and send to UI
async function loadStorage() {
  const cookie = (await figma.clientStorage.getAsync('iconfont_cookie')) || '';
  const lastPid = (await figma.clientStorage.getAsync('iconfont_last_pid')) || '';
  figma.ui.postMessage({ type: 'storage-loaded', cookie, lastPid });
}
loadStorage();

// Notify UI whenever selection changes
figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection;
  if (sel.length === 1 && sel[0].type === 'FRAME') {
    figma.ui.postMessage({ type: 'selection-changed', node: { id: sel[0].id, name: sel[0].name } });
  } else {
    figma.ui.postMessage({ type: 'selection-changed', node: null });
  }
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'export-svg': {
      const node = figma.getNodeById(msg.nodeId);
      if (!node || !('exportAsync' in node)) {
        figma.ui.postMessage({ type: 'svg-exported', error: '节点不存在或不可导出' });
        return;
      }
      try {
        const bytes = await node.exportAsync({ format: 'SVG', contentsOnly: true });
        const svg = new TextDecoder().decode(bytes);
        figma.ui.postMessage({ type: 'svg-exported', svg });
      } catch (e) {
        figma.ui.postMessage({ type: 'svg-exported', error: '导出失败：' + e.message });
      }
      break;
    }
    case 'save-storage': {
      if (msg.cookie !== undefined) {
        await figma.clientStorage.setAsync('iconfont_cookie', msg.cookie);
      }
      if (msg.lastPid !== undefined) {
        await figma.clientStorage.setAsync('iconfont_last_pid', msg.lastPid);
      }
      break;
    }
    case 'notify': {
      figma.notify(msg.message, { error: !!msg.isError });
      break;
    }
    case 'api-get-projects': {
      try {
        const res = await fetch(`${ICONFONT_PROXY}/api/user/myprojects.json`, {
          headers: {
            'X-Cookie': msg.cookie,
            Referer: 'https://www.iconfont.cn',
          },
        });
        const json = await res.json();
        figma.ui.postMessage({ type: 'api-result', id: msg.id, data: json });
      } catch (e) {
        figma.ui.postMessage({ type: 'api-result', id: msg.id, error: e.message });
      }
      break;
    }

    case 'api-get-icons': {
      try {
        const res = await fetch(
          `${ICONFONT_PROXY}/api/project/detail.json?pid=${encodeURIComponent(msg.pid)}`,
          {
            headers: {
              'X-Cookie': msg.cookie,
              Referer: 'https://www.iconfont.cn',
            },
          }
        );
        const json = await res.json();
        figma.ui.postMessage({ type: 'api-result', id: msg.id, data: json });
      } catch (e) {
        figma.ui.postMessage({ type: 'api-result', id: msg.id, error: e.message });
      }
      break;
    }

    case 'api-replace-icon': {
      // ⚠️ 待验证：Body 格式（urlencoded / JSON / multipart）和字段名
      try {
        const body = `icon_id=${encodeURIComponent(msg.iconId)}&svg=${encodeURIComponent(msg.svg)}`;
        const res = await fetch(`${ICONFONT_PROXY}/api/icon/upload.json`, {
          method: 'POST',
          headers: {
            'X-Cookie': msg.cookie,
            Referer: 'https://www.iconfont.cn',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });
        const json = await res.json();
        figma.ui.postMessage({ type: 'api-result', id: msg.id, data: json });
      } catch (e) {
        figma.ui.postMessage({ type: 'api-result', id: msg.id, error: e.message });
      }
      break;
    }
  }
};
