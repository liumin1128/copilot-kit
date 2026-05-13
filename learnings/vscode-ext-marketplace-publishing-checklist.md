# VS Code 扩展发布到 Marketplace 清单

## 必备条件
1. **注册 Publisher**：在 https://marketplace.visualstudio.com/manage 注册，`package.json` 中 `publisher` 字段需匹配
2. **安装 vsce**：`npm install -g @vscode/vsce`
3. **Personal Access Token**：在 Azure DevOps 创建（Marketplace → Manage → Personal access tokens）

## package.json 必须字段
- `name`、`displayName`、`description`、`version`、`publisher`
- `engines.vscode`：指定最低 VS Code 版本
- `repository`：仓库地址（市场列表需要）
- `icon`：128x128 PNG 图标
- `categories`、`keywords`：帮助搜索
- `galleryBanner`：市场页头样式（可选）

## 必需文件
- `LICENSE`：MIT 或其他开源许可
- `CHANGELOG.md`：版本变更记录
- `icon.png`：128x128 像素
- `README.md`：功能说明文档

## .vscodeignore 注意
- 必须排除 `src/**`、`**/*.ts`、`node_modules/**`
- 确保 `dist/**`（编译输出）不被排除
- 排除开发文件：`.vscode/**`、`media/**`（如非运行时必需）、`learnings/**` 等

## 打包与发布命令
```bash
vsce package          # 打包为 .vsix（本地测试）
vsce publish          # 发布到市场
vsce publish patch    # 自动升级补丁版本并发布
```

## 版本号规范
- `major.minor.patch`（语义化版本）
- `vsce publish patch|minor|major` 自动递进

## 注意事项
- 首次发布需先创建 Publisher
- 发布后市场更新可能有几分钟延迟
- `vscode:prepublish` 脚本会在打包前自动执行
- 扩展名需唯一（`<publisher>.<name>`）
