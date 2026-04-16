// code.js — Figma main thread
figma.showUI(__html__, { width: 320, height: 560, title: 'Iconfont Replacer' });

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
  if (msg.type === 'export-svg') {
    const node = figma.getNodeById(msg.nodeId);
    if (!node) {
      figma.ui.postMessage({ type: 'svg-exported', error: '节点不存在' });
      return;
    }
    try {
      const bytes = await node.exportAsync({ format: 'SVG', contentsOnly: true });
      const svg = new TextDecoder().decode(bytes);
      figma.ui.postMessage({ type: 'svg-exported', svg });
    } catch (e) {
      figma.ui.postMessage({ type: 'svg-exported', error: '导出失败：' + e.message });
    }
  }

  if (msg.type === 'save-storage') {
    if (msg.cookie !== undefined) {
      await figma.clientStorage.setAsync('iconfont_cookie', msg.cookie);
    }
    if (msg.lastPid !== undefined) {
      await figma.clientStorage.setAsync('iconfont_last_pid', msg.lastPid);
    }
  }

  if (msg.type === 'notify') {
    figma.notify(msg.message, { error: !!msg.isError });
  }
};
