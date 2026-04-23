// code.js — Figma main thread
figma.showUI(__html__, { width: 320, height: 600, title: 'IconBridge' });

const DEFAULT_PROXY = 'http://localhost:17788';

// Extract ctoken from cookie string (iconfont uses it as CSRF token)
function extractCtoken(cookieStr) {
  const m = cookieStr && cookieStr.match(/(?:^|;\s*)ctoken=([^;]+)/);
  return m ? m[1].trim() : 'null';
}

// Convert Y-down display path d to iconfont's font-coord path d.
// iconfont fonts use UPM=1024 with ascent=896, descent=-128, so y_font = 896 - y_svg.
// Arc: sweep-flag flips and x-axis-rotation negates under Y-flip to preserve shape.
const ICONFONT_FONT_ASCENT = 896;
function flipPathDY(d, H) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const out = [];
  const absY = (s) => String(H - parseFloat(s));
  const relY = (s) => String(-parseFloat(s));
  const negAngle = (s) => String(-parseFloat(s));
  let i = 0;
  let prevCmd = '';
  while (i < tokens.length) {
    const t = tokens[i];
    let cmd;
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      out.push(cmd);
      i++;
    } else {
      cmd = prevCmd === 'M' ? 'L' : prevCmd === 'm' ? 'l' : prevCmd;
    }
    prevCmd = cmd;
    switch (cmd) {
      case 'M': case 'L': case 'T':
        out.push(tokens[i++], absY(tokens[i++])); break;
      case 'm': case 'l': case 't':
        out.push(tokens[i++], relY(tokens[i++])); break;
      case 'H': case 'h':
        out.push(tokens[i++]); break;
      case 'V':
        out.push(absY(tokens[i++])); break;
      case 'v':
        out.push(relY(tokens[i++])); break;
      case 'C':
        out.push(tokens[i++], absY(tokens[i++]), tokens[i++], absY(tokens[i++]), tokens[i++], absY(tokens[i++])); break;
      case 'c':
        out.push(tokens[i++], relY(tokens[i++]), tokens[i++], relY(tokens[i++]), tokens[i++], relY(tokens[i++])); break;
      case 'S': case 'Q':
        out.push(tokens[i++], absY(tokens[i++]), tokens[i++], absY(tokens[i++])); break;
      case 's': case 'q':
        out.push(tokens[i++], relY(tokens[i++]), tokens[i++], relY(tokens[i++])); break;
      case 'A':
        out.push(tokens[i++], tokens[i++], negAngle(tokens[i++]), tokens[i++],
                 tokens[i++] === '1' ? '0' : '1', tokens[i++], absY(tokens[i++])); break;
      case 'a':
        out.push(tokens[i++], tokens[i++], negAngle(tokens[i++]), tokens[i++],
                 tokens[i++] === '1' ? '0' : '1', tokens[i++], relY(tokens[i++])); break;
      case 'Z': case 'z':
        break;
      default:
        i++; break;
    }
  }
  return out.join(' ');
}

// On startup: read persisted data and send to UI
async function loadStorage() {
  const cookie = (await figma.clientStorage.getAsync('iconfont_cookie')) || '';
  const lastPid = (await figma.clientStorage.getAsync('iconfont_last_pid')) || '';
  const proxyUrl = (await figma.clientStorage.getAsync('iconfont_proxy_url')) || '';
  figma.ui.postMessage({ type: 'storage-loaded', cookie, lastPid, proxyUrl });
}
loadStorage();

// Drag-to-canvas: try figma.on('drop') for exact cursor position, fallback to viewport center
let _dropHandled = false;
try {
  figma.on('drop', (event) => {
    const textItem = event.items && event.items.find(i => i.type === 'text/plain');
    if (!textItem || !textItem.data) return;
    let data;
    try { data = JSON.parse(textItem.data); } catch (_) { return; }
    if (!data || !data.svg) return;
    try {
      const node = figma.createNodeFromSvg(data.svg);
      node.name = data.name || 'icon';
      node.resize(48, 48);
      node.x = event.absoluteX - 24;
      node.y = event.absoluteY - 24;
      figma.currentPage.selection = [node];
      _dropHandled = true;
      setTimeout(() => { _dropHandled = false; }, 500);
    } catch (e) {
      figma.notify('插入失败：' + e.message, { error: true });
    }
    return false;
  });
} catch (_) { /* drop event not supported, dragend fallback will handle it */ }

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
      if (_dropHandled) { _dropHandled = false; break; }
      try {
        const node = figma.createNodeFromSvg(msg.svg);
        node.name = msg.name || 'icon';
        node.resize(48, 48);
        const vp = figma.viewport.center;
        node.x = vp.x - 24;
        node.y = vp.y - 24;
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
        // Collect d from ALL <path> elements so multi-path icons (e.g. pause ▮▮) stay intact
        const pathRe = /<path[^>]*\bd="([^"]*)"[^>]*\/?>/g;
        const dValues = [];
        var pm;
        while ((pm = pathRe.exec(showSvg)) !== null) dValues.push(pm[1]);
        const prototypeSvg = dValues.join(' ');
        const fillMatch = showSvg.match(/<path[^>]+fill="([^"]*)"/);
        const pathAttributes = fillMatch ? `fill="${fillMatch[1]}"` : 'fill="#000000"';

        // Step 3: POST to updateProjectIcon.json to commit the replacement
        const saveBody = [
          `id=${encodeURIComponent(msg.iconId)}`,
          `prototype_svg=${encodeURIComponent(prototypeSvg)}`,
          `path_attributes=${encodeURIComponent(pathAttributes)}`,
          `svg=${encodeURIComponent(dValues.map(d => flipPathDY(d, ICONFONT_FONT_ASCENT)).join(' '))}`,
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
        if (j3 && typeof j3 === 'object' && j3.data && typeof j3.data === 'object') {
          if (!j3.data.show_svg) j3.data.show_svg = showSvg;
        } else if (j3 && typeof j3 === 'object') {
          j3.show_svg = showSvg;
        }
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

    case 'scan-broken': {
      // Identify icons where svg == prototype_svg (both Y-down = broken) vs
      // svg != prototype_svg (proper Y-up/Y-down pair = healthy).
      // Emits scan-progress per icon and scan-done with full payloads for fixing.
      const ctoken = extractCtoken(msg.cookie);
      const broken = [];
      const total = msg.iconIds.length;
      let scanned = 0;
      let loggedSample = false;
      for (const iconId of msg.iconIds) {
        try {
          const res = await fetch(
            `${msg.proxyUrl || DEFAULT_PROXY}/api/icon/iconInfo.json?id=${encodeURIComponent(iconId)}&pid=${encodeURIComponent(msg.pid)}&t=${Date.now()}&ctoken=${ctoken}`,
            { headers: { 'X-Cookie': msg.cookie, Referer: 'https://www.iconfont.cn' } }
          );
          const json = await res.json();
          const data = (json && json.data) || {};
          if (!loggedSample) {
            console.log('[IconBridge] iconInfo sample fields:', Object.keys(data));
            loggedSample = true;
          }
          const svg = String(data.svg || '').trim();
          const prototypeSvg = String(data.prototype_svg || '').trim();
          if (svg && prototypeSvg && svg === prototypeSvg) {
            broken.push({
              id: data.id || iconId,
              prototype_svg: prototypeSvg,
              path_attributes: data.path_attributes || 'fill="#000000"',
              origin_file: data.origin_file || '',
              font_class: data.font_class || '',
              unicode: data.unicode || '',
              icon_name: data.name || data.font_class || '',
            });
          }
        } catch (_) { /* skip on error, treat as healthy */ }
        scanned++;
        figma.ui.postMessage({ type: 'scan-progress', scanned, total, brokenCount: broken.length });
      }
      figma.ui.postMessage({ type: 'scan-done', broken });
      break;
    }

    case 'fix-broken': {
      // For each broken icon, re-POST updateProjectIcon.json with svg = Y-up flip of prototype_svg.
      const ctoken = extractCtoken(msg.cookie);
      const total = msg.brokenIcons.length;
      let fixed = 0;
      let failed = 0;
      const errors = [];
      for (const ic of msg.brokenIcons) {
        try {
          // Set editing context (mirrors api-replace-icon step 1)
          await fetch(
            `${msg.proxyUrl || DEFAULT_PROXY}/api/icon/iconInfo.json?id=${encodeURIComponent(ic.id)}&pid=${encodeURIComponent(msg.pid)}&t=${Date.now()}&ctoken=${ctoken}`,
            { headers: { 'X-Cookie': msg.cookie, Referer: 'https://www.iconfont.cn' } }
          );
          const svgYUp = flipPathDY(ic.prototype_svg, ICONFONT_FONT_ASCENT);
          const saveBody = [
            `id=${encodeURIComponent(ic.id)}`,
            `prototype_svg=${encodeURIComponent(ic.prototype_svg)}`,
            `path_attributes=${encodeURIComponent(ic.path_attributes)}`,
            `svg=${encodeURIComponent(svgYUp)}`,
            `origin_file=${encodeURIComponent(ic.origin_file)}`,
            `font_class=${encodeURIComponent(ic.font_class)}`,
            `pid=${encodeURIComponent(msg.pid)}`,
            `unicode=${encodeURIComponent(ic.unicode)}`,
            `icon_name=${encodeURIComponent(ic.icon_name)}`,
            `t=${Date.now()}`,
            `ctoken=${ctoken}`,
          ].join('&');
          const r = await fetch(`${msg.proxyUrl || DEFAULT_PROXY}/api/icon/updateProjectIcon.json`, {
            method: 'POST',
            headers: { 'X-Cookie': msg.cookie, Referer: 'https://www.iconfont.cn', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: saveBody,
          });
          const j = await r.json();
          if (j && j.code !== 200) throw new Error(j.message || '保存失败');
          fixed++;
        } catch (e) {
          failed++;
          errors.push({ id: ic.id, error: e.message });
        }
        figma.ui.postMessage({ type: 'fix-progress', fixed, failed, total });
      }
      figma.ui.postMessage({ type: 'fix-done', fixed, failed, errors });
      break;
    }
  }
};
