# 备份：文献卡片 v1.0

保存于 2026-10-21。仓库里同时打了标签 `v1.0`，指向保存时的完整仓库。

`paper-card-v1.0.zip` 是一份完整的网站：所有代码和一套空白数据。**不含**你的卡片、PDF 和密码，解压后就能部署成一个全新的网站。

## 部署成一个新网站（约 10 分钟，不用装软件）

1. **下载**：在 GitHub 上点开 `paper-card-v1.0.zip`，再点右上角的下载按钮。解压后得到 `paper-card` 文件夹。
2. **新建仓库**：打开 <https://github.com/new>，起个名字（比如 `paper-card`），选 **Public**，其他都不勾，点 **Create repository**。
3. **上传文件**：在新仓库页面点 **uploading an existing file**，把 `paper-card` 文件夹**里面的**全部文件和文件夹拖进网页，点 **Commit changes**。
   （Mac 默认隐藏 `.nojekyll` 这类以点开头的文件，按 `⌘ + Shift + .` 可以显示。不传它们也能用。）
4. **改仓库名**：在仓库里打开 `data/site.json`，点铅笔图标，把 `"repo"` 改成 `你的用户名/仓库名`，点 **Commit changes**。
5. **开启网站**：仓库的 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 **main** 和 **/ (root)**，点 **Save**。大约 1 分钟后，`https://你的用户名.github.io/仓库名/` 就能打开了。
6. **第一次设置**：打开网址 → **设置 → 开始设置**，按页面提示在 GitHub 生成令牌（只授权这个新仓库，Contents 选 Read and write），粘贴令牌、设密码。之后在任何设备上输入密码就能写卡片。

## 把旧卡片搬过去（可选）

把旧仓库里的这几项上传到新仓库的相同位置：

- `data/cards/` 文件夹
- `data/index.json`
- `uploads/` 文件夹（插入的图片）
- `papers/` 文件夹（论文 PDF）

不要搬 `data/vault.json`：新仓库要重新做一次第一次设置。

## 把现在的网站恢复成这个版本

保留卡片，只换代码：用 zip 里的 `index.html`、`css/`、`js/`、`scripts/`、`tests/`、`package.json` 覆盖仓库里的同名文件。**不要**覆盖 `data/`、`uploads/`、`papers/`。

想找回保存当天的全部内容（包括当时的卡片）：在仓库页面点 **Tags → v1.0 → Download ZIP**。
