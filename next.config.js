/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  // 生产构建时禁用开发指示器
  devIndicators: {
    buildActivity: true, // 设为 false 可完全禁用编译指示器
    buildActivityPosition: 'bottom-right', // 调整位置
  },
};

module.exports = nextConfig;
