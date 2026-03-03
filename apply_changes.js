const fs = require('fs');
let content = fs.readFileSync('app/page.jsx', 'utf8');

// 1. 添加 ChainIcon 导入
content = content.replace(
  'BookmarkIcon } from "./components/Icons";',
  'BookmarkIcon, ChainIcon } from "./components/Icons";'
);

// 2. 添加 IndustryChainModal 导入
content = content.replace(
  'import WatchlistModal from "./components/WatchlistModal";',
  'import WatchlistModal from "./components/WatchlistModal";\nimport IndustryChainModal from "./components/IndustryChainModal";'
);

// 3. 添加 chainModalOpen 状态
content = content.replace(
  '// 行业分类弹窗状态\n  const [industryModalOpen, setIndustryModalOpen] = useState(false);\n\n  // 锁定背景滚动',
  '// 行业分类弹窗状态\n  const [industryModalOpen, setIndustryModalOpen] = useState(false);\n\n  // 产业链分析弹窗状态\n  const [chainModalOpen, setChainModalOpen] = useState(false);\n\n  // 锁定背景滚动'
);

// 4. 添加 chainModalOpen 到 isAnyModalOpen
content = content.replace(
  'feedbackOpen ||\n      industryModalOpen ||\n      addResultOpen',
  'feedbackOpen ||\n      industryModalOpen ||\n      chainModalOpen ||\n      addResultOpen'
);

// 5. 添加 chainModalOpen 到依赖数组
content = content.replace(
  'feedbackOpen,\n    industryModalOpen,\n    addResultOpen',
  'feedbackOpen,\n    industryModalOpen,\n    chainModalOpen,\n    addResultOpen'
);

// 6. 添加产业链按钮
content = content.replace(
  '<LayersIcon width="18" height="18" />\n            </button>\n          </div>\n\n          {/* 右侧',
  '<LayersIcon width="18" height="18" />\n            </button>\n            {/* 产业链分析 */}\n            <button\n              className="icon-button"\n              aria-label="产业链分析"\n              onClick={() => setChainModalOpen(true)}\n              title="产业链分析"\n            >\n              <ChainIcon width="18" height="18" />\n            </button>\n          </div>\n\n          {/* 右侧'
);

// 7. 添加弹框渲染
content = content.replace(
  '<IndustryModal\n            onClose={() => setIndustryModalOpen(false)}\n            data={industryData}\n          />\n        )}\n      </AnimatePresence>\n      <AnimatePresence>\n        {watchlistModalOpen && (',
  '<IndustryModal\n            onClose={() => setIndustryModalOpen(false)}\n            data={industryData}\n          />\n        )}\n      </AnimatePresence>\n      <AnimatePresence>\n        {chainModalOpen && (\n          <IndustryChainModal\n            isOpen={chainModalOpen}\n            onClose={() => setChainModalOpen(false)}\n            userId={user?.id}\n          />\n        )}\n      </AnimatePresence>\n      <AnimatePresence>\n        {watchlistModalOpen && ('
);

fs.writeFileSync('app/page.jsx', content, 'utf8');
console.log('All modifications applied successfully');
