const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 用 vm 加载 code.js(stub figma 沙箱),并导出待测纯函数
function loadCode() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'code.js'), 'utf8');
  const noop = () => {};
  const figma = {
    showUI: noop, on: noop, notify: noop,
    ui: { postMessage: noop, set onmessage(_) {} },
    clientStorage: { getAsync: async () => '', setAsync: async () => {} },
    currentPage: { selection: [] },
    viewport: { center: { x: 0, y: 0 }, scrollAndZoomIntoView: noop },
    getNodeByIdAsync: async () => null,
    createNodeFromSvg: () => ({}),
  };
  const sandbox = {
    figma, __html__: '', console,
    Date, setTimeout, fetch: async () => ({}),
    module: { exports: {} },
  };
  const shim = '\n;module.exports = { flipPathDY, buildReplaceFields, ICONFONT_FONT_ASCENT };';
  vm.createContext(sandbox);
  vm.runInContext(code + shim, sandbox);
  return sandbox.module.exports;
}

// 把 path d 归一化成数值/命令 token 数组(消除空格/格式差异),用于几何等价比较
function normD(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  return toks.map(t => (/[A-Za-z]/.test(t) ? t : String(parseFloat(t)))).join(' ');
}

function assert(cond, msg) {
  if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; }
  else { console.log('PASS:', msg); }
}

const { buildReplaceFields } = loadCode();

// ── Fixtures(真实拓包,彩色 3 色国旗) ──
const COLOR_SHOW_SVG = '<svg class="icon" style="width: 1em;height: 1em;vertical-align: middle;fill: currentColor;overflow: hidden;" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path d="M1024 400.1792H0.04096V194.21184c0-9.74848 7.90528-17.65376 17.65376-17.65376H1006.3872c9.74848 0 17.65376 7.90528 17.65376 17.65376V400.1792z" fill="#464655" /><path d="M1006.36672 847.4624H17.67424a17.65376 17.65376 0 0 1-17.65376-17.67424V623.8208h1024v205.96736a17.65376 17.65376 0 0 1-17.65376 17.65376z" fill="#FFE15A" /><path d="M1024 400.1792H0.04096V623.8208h1024V400.1792z" fill="#FF4B55" /></svg>';

const EXPECT_PROTOTYPE = 'M1024 400.1792H0.04096V194.21184c0-9.74848 7.90528-17.65376 17.65376-17.65376H1006.3872c9.74848 0 17.65376 7.90528 17.65376 17.65376V400.1792z|M1006.36672 847.4624H17.67424a17.65376 17.65376 0 0 1-17.65376-17.67424V623.8208h1024v205.96736a17.65376 17.65376 0 0 1-17.65376 17.65376z|M1024 400.1792H0.04096V623.8208h1024V400.1792z';

// iconfont 服务端存储的 Y-up svg(逐路径,用于几何等价校验,格式可不同)
const EXPECT_SVG = 'M1024 495.8208H0.04096V701.78816c0 9.74848 7.90528 17.65376 17.65376 17.65376H1006.3872c9.74848 0 17.65376-7.90528 17.65376-17.65376V495.8208z|M1006.36672 48.5376H17.67424a17.65376 17.65376 0 0 0-17.65376 17.67424V272.1792h1024v-205.96736a17.65376 17.65376 0 0 0-17.65376-17.65376z|M1024 495.8208H0.04096V272.1792h1024V495.8208z';

const EXPECT_PATH_ATTRS = 'fill="#464655"|fill="#FFE15A"|fill="#FF4B55"';

// ── 彩色模式 ──
const c = buildReplaceFields(COLOR_SHOW_SVG, 'color');
assert(c.prototypeSvg === EXPECT_PROTOTYPE, 'color: prototypeSvg 竖线连接、d 逐路径保留');
assert(c.pathAttributes === EXPECT_PATH_ATTRS, 'color: path_attributes 逐路径 fill 竖线连接');
// svg 与 iconfont 服务端 Y-up 结果几何等价(逐路径比较,忽略格式)
const gotSvgParts = c.svg.split('|');
const expSvgParts = EXPECT_SVG.split('|');
assert(gotSvgParts.length === expSvgParts.length, 'color: svg 路径数一致(3)');
let svgOk = gotSvgParts.length === expSvgParts.length;
for (let i = 0; i < expSvgParts.length; i++) {
  if (normD(gotSvgParts[i]) !== normD(expSvgParts[i])) {
    svgOk = false;
    console.error('  path', i, 'got ', normD(gotSvgParts[i]));
    console.error('  path', i, 'want', normD(expSvgParts[i]));
  }
}
assert(svgOk, 'color: svg 逐路径 896-y 翻转与服务端几何等价');

// ── 去色模式(真正去色:空格连接、统一 currentColor) ──
const m = buildReplaceFields(COLOR_SHOW_SVG, 'mono');
assert(m.prototypeSvg.indexOf('|') === -1, 'mono: prototypeSvg 不含竖线(空格连接)');
assert(m.pathAttributes === 'fill="currentColor"', 'mono: 彩色源去色后统一为单个 fill="currentColor"');
assert(m.svg.indexOf('|') === -1, 'mono: svg 不含竖线(空格连接)');

// ── 去色:无 fill 源同样输出 currentColor ──
const noFill = buildReplaceFields('<svg><path d="M0 0H10V10z"/></svg>', 'mono');
assert(noFill.pathAttributes === 'fill="currentColor"', 'mono: 无 fill 源也输出 fill="currentColor"');

// ── 原色:某路径缺 fill 回退 #333333 ──
const colorNoFill = buildReplaceFields('<svg><path d="M0 0H10V10z" fill="#FF0000"/><path d="M0 10H10V20z"/></svg>', 'color');
assert(colorNoFill.pathAttributes === 'fill="#FF0000"|fill="#333333"', 'color: 缺 fill 的路径回退 #333333,与有色路径对齐');

// ── previewSvg:重建预览,反映真实存储状态(而非源图颜色) ──
// 去色预览:单 path,统一 currentColor,不带源图任何 hex
assert(m.previewSvg.indexOf('fill="currentColor"') !== -1, 'mono previewSvg: 含 fill="currentColor"');
assert(m.previewSvg.indexOf('#464655') === -1 && m.previewSvg.indexOf('#FFE15A') === -1, 'mono previewSvg: 不含源图颜色(已去色)');
assert((m.previewSvg.match(/<path/g) || []).length === 1, 'mono previewSvg: 合并为单 path');
// 原色预览:逐路径保留各自 fill
assert((c.previewSvg.match(/<path/g) || []).length === 3, 'color previewSvg: 3 个 path');
assert(c.previewSvg.indexOf('fill="#464655"') !== -1 && c.previewSvg.indexOf('fill="#FF4B55"') !== -1, 'color previewSvg: 逐路径保留原色');
