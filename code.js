// code.js — Figma main thread
figma.showUI(__html__, { width: 320, height: 600, title: 'Iconfont Replacer' });

const DEFAULT_PROXY = 'http://localhost:17788';

// Extract ctoken from cookie string (iconfont uses it as CSRF token)
function extractCtoken(cookieStr) {
  const m = cookieStr && cookieStr.match(/(?:^|;\s*)ctoken=([^;]+)/);
  return m ? m[1].trim() : 'null';
}

// On startup: read persisted data and send to UI
async function loadStorage() {
  const cookie = (await figma.clientStorage.getAsync('iconfont_cookie')) || '';
  const lastPid = (await figma.clientStorage.getAsync('iconfont_last_pid')) || '';
  const proxyUrl = (await figma.clientStorage.getAsync('iconfont_proxy_url')) || '';
  figma.ui.postMessage({ type: 'storage-loaded', cookie, lastPid, proxyUrl });
}
loadStorage();

// Notify UI whenever selection changes
figma.on('selectionchange', () => {
  const sel = figma.currentPage.selection;
  const nodes = sel.filter(n => 'exportAsync' in n).map(n => ({ id: n.id, name: n.name }));
  figma.ui.postMessage({ type: 'selection-changed', nodes });
});

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'export-svg':
    case 'export-svg-preview': {
      const isPreview = msg.type === 'export-svg-preview';
      const replyType = isPreview ? 'svg-preview' : 'svg-exported';
      const node = await figma.getNodeByIdAsync(msg.nodeId);
      if (!node || !('exportAsync' in node)) {
        figma.ui.postMessage({ type: replyType, nodeId: msg.nodeId, error: '节点不存在或不可导出' });
        return;
      }
      try {
        const bytes = await node.exportAsync({ format: 'SVG', contentsOnly: true });
        let svg = '';
        for (let i = 0; i < bytes.length; i++) {
          svg += String.fromCharCode(bytes[i]);
        }
        figma.ui.postMessage({ type: replyType, nodeId: msg.nodeId, svg });
      } catch (e) {
        figma.ui.postMessage({ type: replyType, nodeId: msg.nodeId, error: '导出失败：' + e.message });
      }
      break;
    }
    case 'export-svgs-batch': {
      const results = [];
      for (const nodeId of msg.nodeIds) {
        const node = await figma.getNodeByIdAsync(nodeId);
        if (!node || !('exportAsync' in node)) {
          results.push({ nodeId, error: '节点不存在或不可导出' });
          continue;
        }
        try {
          const bytes = await node.exportAsync({ format: 'SVG', contentsOnly: true });
          let svg = '';
          for (let i = 0; i < bytes.length; i++) svg += String.fromCharCode(bytes[i]);
          results.push({ nodeId, svg });
        } catch (e) {
          results.push({ nodeId, error: '导出失败：' + e.message });
        }
      }
      figma.ui.postMessage({ type: 'svgs-batch-exported', results });
      break;
    }
    case 'save-storage': {
      if (msg.cookie !== undefined) {
        await figma.clientStorage.setAsync('iconfont_cookie', msg.cookie);
      }
      if (msg.lastPid !== undefined) {
        await figma.clientStorage.setAsync('iconfont_last_pid', msg.lastPid);
      }
      if (msg.proxyUrl !== undefined) {
        await figma.clientStorage.setAsync('iconfont_proxy_url', msg.proxyUrl);
      }
      break;
    }
    case 'notify': {
      figma.notify(msg.message, { error: !!msg.isError });
      break;
    }
    case 'create-node-from-svg': {
      try {
        const node = figma.createNodeFromSvg(msg.svg);
        node.name = msg.name || 'icon';
        // Center in viewport
        const vp = figma.viewport.center;
        node.x = vp.x - node.width / 2;
        node.y = vp.y - node.height / 2;
        figma.currentPage.selection = [node];
        figma.viewport.scrollAndZoomIntoView([node]);
      } catch (e) {
        figma.notify('插入失败：' + e.message, { error: true });
      }
      break;
    }
    case 'api-get-projects': {
      try {
        const res = await fetch(`${msg.proxyUrl || DEFAULT_PROXY}/api/user/myprojects.json`, {
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
          `${msg.proxyUrl || DEFAULT_PROXY}/api/project/detail.json?pid=${encodeURIComponent(msg.pid)}`,
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
      try {
        const ctoken = extractCtoken(msg.cookie);

        // Step 1: GET iconInfo to set server-side editing context for this icon
        await fetch(
          `${msg.proxyUrl || DEFAULT_PROXY}/api/icon/iconInfo.json?id=${encodeURIComponent(msg.iconId)}&pid=${encodeURIComponent(msg.pid)}&t=${Date.now()}&ctoken=${ctoken}`,
          { headers: { 'X-Cookie': msg.cookie, Referer: 'https://www.iconfont.cn' } }
        );

        // Step 2: POST SVG as multipart/form-data to getPrototypeSvg.json
        // FormData unavailable in Figma sandbox — construct multipart manually (SVG is ASCII-safe)
        const boundary = 'IFBound' + Date.now().toString(36);
        const uploadBody = `--${boundary}\r\nContent-Disposition: form-data; name="filename"; filename="icon.svg"\r\nContent-Type: image/svg+xml\r\n\r\n${msg.originSvg}\r\n--${boundary}--\r\n`;
        const r2 = await fetch(`${msg.proxyUrl || DEFAULT_PROXY}/api/getPrototypeSvg.json?ctoken=${ctoken}`, {
          method: 'POST',
          headers: { 'X-Cookie': msg.cookie, Referer: 'https://www.iconfont.cn', 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          body: uploadBody,
        });
        const t2 = await r2.text();
        let j2;
        try { j2 = JSON.parse(t2); }
        catch (_) { throw new Error(`上传失败 HTTP ${r2.status}: ${t2.slice(0, 100)}`); }
        if (j2.code !== 200) throw new Error(j2.message || '上传 SVG 失败');

        const showSvg = (j2.data && j2.data.show_svg) || '';
        const originFile = (j2.data && j2.data.origin_file) || msg.originSvg;

        // Extract path d → prototype_svg, fill → path_attributes from show_svg
        const dMatch = showSvg.match(/\bd="([^"]*)"/);
        const prototypeSvg = dMatch ? dMatch[1] : '';
        const fillMatch = showSvg.match(/<path[^>]+fill="([^"]*)"/);
        const pathAttributes = fillMatch ? `fill="${fillMatch[1]}"` : 'fill="#000000"';

        // Step 3: POST to updateProjectIcon.json to commit the replacement
        const saveBody = [
          `id=${encodeURIComponent(msg.iconId)}`,
          `prototype_svg=${encodeURIComponent(prototypeSvg)}`,
          `path_attributes=${encodeURIComponent(pathAttributes)}`,
          `svg=${encodeURIComponent(prototypeSvg)}`,
          `origin_file=${encodeURIComponent(originFile)}`,
          `font_class=${encodeURIComponent(msg.fontClass)}`,
          `pid=${encodeURIComponent(msg.pid)}`,
          `unicode=${encodeURIComponent(msg.unicode)}`,
          `icon_name=${encodeURIComponent(msg.iconName)}`,
          `t=${Date.now()}`,
          `ctoken=${ctoken}`,
        ].join('&');
        const r3 = await fetch(`${msg.proxyUrl || DEFAULT_PROXY}/api/icon/updateProjectIcon.json`, {
          method: 'POST',
          headers: { 'X-Cookie': msg.cookie, Referer: 'https://www.iconfont.cn', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: saveBody,
        });
        const t3 = await r3.text();
        let j3;
        try { j3 = JSON.parse(t3); }
        catch (_) { throw new Error(`保存失败 HTTP ${r3.status}: ${t3.slice(0, 100)}`); }
        figma.ui.postMessage({ type: 'api-result', id: msg.id, data: j3 });
      } catch (e) {
        figma.ui.postMessage({ type: 'api-result', id: msg.id, error: e.message });
      }
      break;
    }

    case 'api-upload-icon': {
      try {
        const ctoken = extractCtoken(msg.cookie);

        // Step 1: POST SVG to /api/uploadIcons.json (multipart, field: icons[])
        const boundary = 'IFBound' + Date.now().toString(36);
        const uploadBody =
          '--' + boundary + '\r\n' +
          'Content-Disposition: form-data; name="icons[]"; filename="icon.svg"\r\n' +
          'Content-Type: image/svg+xml\r\n\r\n' +
          msg.originSvg + '\r\n' +
          '--' + boundary + '--\r\n';
        const r1 = await fetch(
          (msg.proxyUrl || DEFAULT_PROXY) + '/api/uploadIcons.json?ctoken=' + ctoken + '&_csrf=' + ctoken,
          {
            method: 'POST',
            headers: {
              'X-Cookie': msg.cookie,
              'Referer': 'https://www.iconfont.cn',
              'Content-Type': 'multipart/form-data; boundary=' + boundary,
            },
            body: uploadBody,
          }
        );
        const t1 = await r1.text();
        let j1;
        try { j1 = JSON.parse(t1); }
        catch (_) { throw new Error('上传失败 HTTP ' + r1.status + ': ' + t1.slice(0, 100)); }
        if (j1.code !== 200) throw new Error(j1.message || '上传 SVG 失败');

        // j1.data contains uploaded icon(s) with id, unicode, etc.
        const rawData = j1.data;
        const iconArr = Array.isArray(rawData) ? rawData : (rawData ? [rawData] : []);
        if (iconArr.length === 0) throw new Error('上传后未返回图标数据');

        // Build updateIcons array matching iconfont's expected format
        const updateIcons = iconArr.map(function(ic) {
          return {
            id: ic.id,
            name: msg.fontClass,
            keepFill: false,
            unicode: ic.unicode || '',
            slug: msg.fontClass
          };
        });

        // Step 2: POST to /api/updateUploadIcons.json to confirm adding to project
        const saveBody = [
          'advanceType=project',
          'projectId=' + encodeURIComponent(msg.pid),
          'updateIcons=' + encodeURIComponent(JSON.stringify(updateIcons)),
          't=' + Date.now(),
          'ctoken=' + ctoken,
        ].join('&');
        const r2 = await fetch(
          (msg.proxyUrl || DEFAULT_PROXY) + '/api/updateUploadIcons.json',
          {
            method: 'POST',
            headers: {
              'X-Cookie': msg.cookie,
              'Referer': 'https://www.iconfont.cn',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: saveBody,
          }
        );
        const t2 = await r2.text();
        let j2;
        try { j2 = JSON.parse(t2); }
        catch (_) { throw new Error('保存失败 HTTP ' + r2.status + ': ' + t2.slice(0, 100)); }
        figma.ui.postMessage({ type: 'api-result', id: msg.id, data: j2 });
      } catch (e) {
        figma.ui.postMessage({ type: 'api-result', id: msg.id, error: e.message });
      }
      break;
    }
  }
};
