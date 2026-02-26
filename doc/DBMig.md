后续迁移到真实数据库步骤：

实现 SupabaseDataAdapter 或 MySQLDataAdapter
在 dataAccess.js 中切换：export const dataAdapter = SupabaseDataAdapter;
无需修改任何业务代码
