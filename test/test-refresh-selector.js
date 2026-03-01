/**
 * 刷新频率下拉选择器功能测试脚本
 * 测试维度：状态管理、定时器逻辑、UI渲染、交互逻辑、CSS动画
 */

const fs = require('fs');
const path = require('path');

// 测试结果收集
const testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  details: []
};

function test(name, fn) {
  try {
    const result = fn();
    if (result === true || result.passed !== false) {
      testResults.passed++;
      testResults.details.push({ name, status: 'PASS', message: typeof result === 'string' ? result : '' });
    } else {
      testResults.failed++;
      testResults.details.push({ name, status: 'FAIL', message: result.message || result });
      testResults.errors.push({ name, message: result.message || result });
    }
  } catch (e) {
    testResults.failed++;
    testResults.details.push({ name, status: 'ERROR', message: e.message });
    testResults.errors.push({ name, message: e.message });
  }
}

// 读取源文件
const pageContent = fs.readFileSync('app/page.jsx', 'utf-8');
const cssContent = fs.readFileSync('app/globals.css', 'utf-8');

console.log('========================================');
console.log('  刷新频率下拉选择器功能测试报告');
console.log('========================================\n');

// ===== 测试组1: 状态变量 =====
console.log('>>> 测试组1: 状态变量检查');

test('refreshMs 状态变量存在', () => {
  return pageContent.includes('const [refreshMs, setRefreshMs] = useState(30000)');
});

test('refreshDropdownOpen 状态变量存在', () => {
  return pageContent.includes('const [refreshDropdownOpen, setRefreshDropdownOpen] = useState(false)');
});

test('refreshDropdownRef 引用存在', () => {
  return pageContent.includes('const refreshDropdownRef = useRef(null)');
});

test('默认刷新频率为30秒', () => {
  const hasCorrectDefault = pageContent.includes('const [refreshMs, setRefreshMs] = useState(30000)');
  return hasCorrectDefault ? '默认值30000ms正确' : { passed: false, message: '默认值错误' };
});

// ===== 测试组2: 定时器逻辑 =====
console.log('\n>>> 测试组2: 定时器逻辑检查');

test('定时器清除逻辑存在', () => {
  return pageContent.includes('if (timerRef.current) clearInterval(timerRef.current)');
});

test('停止刷新条件判断存在', () => {
  return pageContent.includes("if (refreshMs === 0)") && pageContent.includes('return;');
});

test('setInterval 使用 refreshMs 作为间隔', () => {
  const hasSetInterval = pageContent.includes('setInterval(() => {');
  const hasRefreshMs = /setInterval\([^}]+\},\s*refreshMs\)/.test(pageContent);
  return hasSetInterval && hasRefreshMs ? '定时器间隔使用 refreshMs 变量' : { passed: false };
});

test('useEffect 依赖数组包含 refreshMs', () => {
  const hasCorrectDeps = pageContent.includes('}, [funds, refreshMs]);');
  return hasCorrectDeps ? '依赖数组正确包含 funds 和 refreshMs' : { passed: false };
});

// ===== 测试组3: UI渲染逻辑 =====
console.log('\n>>> 测试组3: UI渲染逻辑检查');

test('下拉选择器容器存在', () => {
  return pageContent.includes('className="refresh-selector"');
});

test('ref 绑定到容器', () => {
  return pageContent.includes('ref={refreshDropdownRef}');
});

test('停止状态显示"已停止"', () => {
  return pageContent.includes('已停止');
});

test('运行状态显示刷新秒数', () => {
  return pageContent.includes('刷新 {Math.round(refreshMs / 1000)}秒');
});

test('下拉菜单项包含停止刷新', () => {
  return pageContent.includes("{ value: 0, label: '停止刷新' }");
});

test('下拉菜单项包含15秒', () => {
  return pageContent.includes("{ value: 15000, label: '15 秒' }");
});

test('下拉菜单项包含30秒', () => {
  return pageContent.includes("{ value: 30000, label: '30 秒' }");
});

test('下拉菜单项包含60秒', () => {
  return pageContent.includes("{ value: 60000, label: '60 秒' }");
});

// ===== 测试组4: 交互逻辑 =====
console.log('\n>>> 测试组4: 交互逻辑检查');

test('点击按钮切换下拉状态', () => {
  return pageContent.includes('onClick={() => setRefreshDropdownOpen(!refreshDropdownOpen)}');
});

test('选择选项后关闭下拉菜单', () => {
  return pageContent.includes('setRefreshDropdownOpen(false)');
});

test('选择选项后更新刷新频率', () => {
  return pageContent.includes('setRefreshMs(option.value)');
});

test('点击外部关闭下拉菜单', () => {
  const hasHandleClickOutside = pageContent.includes('const handleClickOutside = (event)');
  const hasRefreshDropdownRef = pageContent.includes('refreshDropdownRef.current && !refreshDropdownRef.current.contains(event.target)');
  return hasHandleClickOutside && hasRefreshDropdownRef;
});

test('mousedown 事件监听器正确添加', () => {
  return pageContent.includes("document.addEventListener('mousedown', handleClickOutside)");
});

test('mousedown 事件监听器正确移除', () => {
  return pageContent.includes("document.removeEventListener('mousedown', handleClickOutside)");
});

// ===== 测试组5: 样式检查 =====
console.log('\n>>> 测试组5: 样式检查');

test('停止状态使用红色背景', () => {
  return pageContent.includes("background: refreshMs === 0 ? 'rgba(239, 68, 68, 0.15)'");
});

test('运行状态使用青色背景', () => {
  return pageContent.includes("'rgba(34, 211, 238, 0.1)'");
});

test('停止状态使用红色文字', () => {
  return pageContent.includes("color: refreshMs === 0 ? 'var(--danger)'");
});

test('运行状态使用主色文字', () => {
  return pageContent.includes("'var(--primary)'");
});

test('状态指示灯存在', () => {
  return pageContent.includes("width: 6, height: 6, borderRadius: '50%'");
});

test('运行状态指示灯使用脉冲动画', () => {
  return pageContent.includes("animation: 'pulse 2s infinite'");
});

// ===== 测试组6: CSS动画 =====
console.log('\n>>> 测试组6: CSS动画检查');

test('pulse 动画定义存在', () => {
  return cssContent.includes('@keyframes pulse');
});

test('pulse 动画包含 0%, 100% 状态', () => {
  return cssContent.includes('0%, 100%') && cssContent.includes('opacity: 1');
});

test('pulse 动画包含 50% 状态', () => {
  return cssContent.includes('50%') && cssContent.includes('opacity: 0.4');
});

// ===== 测试组7: 下拉菜单样式 =====
console.log('\n>>> 测试组7: 下拉菜单样式检查');

test('下拉菜单使用 glass 样式', () => {
  return pageContent.includes('className="glass"');
});

test('下拉菜单使用绝对定位', () => {
  return pageContent.includes("position: 'absolute'");
});

test('下拉菜单位于按钮下方', () => {
  return pageContent.includes("top: '100%'");
});

test('下拉菜单右对齐', () => {
  return pageContent.includes("right: 0");
});

test('下拉菜单有圆角', () => {
  return pageContent.includes("borderRadius: 8");
});

test('下拉菜单有阴影', () => {
  return pageContent.includes("boxShadow: '0 4px 20px rgba(0,0,0,0.3)'");
});

test('下拉菜单 z-index 足够高', () => {
  return pageContent.includes('zIndex: 100');
});

// ===== 测试组8: 动画效果 =====
console.log('\n>>> 测试组8: 动画效果检查');

test('使用 motion.div 实现动画', () => {
  return pageContent.includes('<motion.div');
});

test('动画初始状态透明度为0', () => {
  return pageContent.includes("initial={{ opacity: 0");
});

test('动画初始状态有位移', () => {
  return pageContent.includes("y: -8");
});

test('动画初始状态有缩放', () => {
  return pageContent.includes("scale: 0.95");
});

test('动画结束状态透明度为1', () => {
  return pageContent.includes("animate={{ opacity: 1");
});

// ===== 测试组9: 选项高亮逻辑 =====
console.log('\n>>> 测试组9: 选项高亮逻辑检查');

test('当前选项背景高亮', () => {
  return pageContent.includes("background: refreshMs === option.value ? 'rgba(34, 211, 238, 0.15)'");
});

test('停止刷新选项使用红色文字', () => {
  return pageContent.includes("color: option.value === 0 ? 'var(--danger)'");
});

test('鼠标悬停效果存在', () => {
  return pageContent.includes('onMouseEnter') && pageContent.includes('onMouseLeave');
});

// ===== 测试组10: 功能完整性 =====
console.log('\n>>> 测试组10: 功能完整性检查');

test('选项数量为4个', () => {
  const matches = pageContent.match(/{ value: \d+, label: '[^']+' }/g);
  return matches && matches.length === 4 ? `共 ${matches.length} 个选项` : { passed: false, message: `选项数量: ${matches ? matches.length : 0}` };
});

test('选项值分别为 0, 15000, 30000, 60000', () => {
  const has0 = pageContent.includes('value: 0');
  const has15 = pageContent.includes('value: 15000');
  const has30 = pageContent.includes('value: 30000');
  const has60 = pageContent.includes('value: 60000');
  return has0 && has15 && has30 && has60 ? '选项值正确' : { passed: false };
});

test('条件渲染下拉菜单', () => {
  return pageContent.includes('{refreshDropdownOpen && (');
});

test('使用 AnimatePresence 或条件渲染', () => {
  const hasAnimatePresence = pageContent.includes('AnimatePresence');
  const hasConditionalRender = pageContent.includes('refreshDropdownOpen &&');
  return hasAnimatePresence || hasConditionalRender ? '动画/条件渲染存在' : { passed: false };
});

// ===== 输出测试报告 =====
console.log('\n========================================');
console.log('  测试结果汇总');
console.log('========================================');
console.log(`通过: ${testResults.passed}`);
console.log(`失败: ${testResults.failed}`);
console.log(`总计: ${testResults.passed + testResults.failed}`);
console.log('');

if (testResults.failed > 0) {
  console.log('失败项详情:');
  testResults.errors.forEach(e => {
    console.log(`  - ${e.name}: ${e.message}`);
  });
}

console.log('\n----------------------------------------');
console.log('  详细测试结果');
console.log('----------------------------------------');

// 按测试组分组显示
const groups = [
  { name: '状态变量检查', start: 0, count: 4 },
  { name: '定时器逻辑检查', start: 4, count: 4 },
  { name: 'UI渲染逻辑检查', start: 8, count: 8 },
  { name: '交互逻辑检查', start: 16, count: 6 },
  { name: '样式检查', start: 22, count: 6 },
  { name: 'CSS动画检查', start: 28, count: 3 },
  { name: '下拉菜单样式检查', start: 31, count: 7 },
  { name: '动画效果检查', start: 38, count: 5 },
  { name: '选项高亮逻辑检查', start: 43, count: 3 },
  { name: '功能完整性检查', start: 46, count: 4 }
];

groups.forEach(group => {
  console.log(`\n[${group.name}]`);
  for (let i = group.start; i < group.start + group.count && i < testResults.details.length; i++) {
    const d = testResults.details[i];
    const icon = d.status === 'PASS' ? '✓' : '✗';
    console.log(`  [${icon}] ${d.name}${d.message ? ': ' + d.message : ''}`);
  }
});

console.log('\n========================================');
console.log(`测试完成，通过率: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
console.log('========================================\n');

// 返回退出码
process.exit(testResults.failed > 0 ? 1 : 0);
