# DxtSignatureTool

DxtSignatureTool 为 `.dxt`（或其他自定义扩展包）提供**签名**与**验签**能力，灵感来源于 Android APK V3 Scheme，具备完整性保护、发布者身份标识以及**密钥轮换**等现代特性。

---

## ✨ 功能特性

* 对整个 `.dxt` ZIP 包（除签名文件外）计算 SHA-256 哈希并生成/验证签名。
* 支持多种算法（默认 `SHA256withRSA`，可扩展至 ECDSA P-256 等）。
* 多版本签名列表，安装器按顺序（最新 → 最旧）验证，天然支持密钥轮换。
* 可通过本地 *trustedPublicKeys* 白名单或签名中附带 `certificate` 字段完成信任校验。
* CLI 友好：一行命令即可完成签名或验签。

---

## 📦 签名结构
签名信息存储在固定路径 `META-INF/dxt-signatures.json` 中，示例：

```json
{
  "signatures": [
    {
      "version": 1,
      "signingKeyId": "abc123",           // 发布者标识，可为公钥指纹
      "algorithm": "SHA256withRSA",
      "signature": "base64-encoded-sig",
      "certificate": "base64-encoded-PEM", // 可选
      "timestamp": 1719453678
    }
  ],
  "signedPayload": {
    "digestAlgorithm": "SHA-256",
    "digest": "sha256-of-entire-dxt-zip-excluding-this-signature",
    "dxtVersion": "1.0.0",
    "manifestDigest": "sha256(manifest.json)"
  }
}
```

> **说明**
> 1. `signatures` 可包含多条记录，安装器默认验证数组最后一条（最新）。
> 2. `signedPayload.digest` 为除 `dxt-signatures.json` 之外所有条目的哈希。
> 3. `manifestDigest` 用于防御内联篡改（需在安装时再次计算校验）。

---

## 🔏 签名流程
1. 读取原始 `.dxt`，排除现有 `META-INF/dxt-signatures.json`（若存在）。
2. 计算剩余内容的 SHA-256 哈希。
3. 用私钥对该摘要进行签名，得到 `signature` 字段。
4. 组装完整的 `dxt-signatures.json` 并写入 `META-INF/` 目录。

CLI 示例：
```bash
node dxt_signature_tool.js sign ./your.dxt ./private_key.pem abc123 ./output.dxt
```

---

## ✅ 验证流程
1. 解析 `META-INF/dxt-signatures.json`。
2. 取出 `signatures` 数组最后一条（或按需遍历全部）。
3. 根据 `signingKeyId` 在本地白名单 *trustedPublicKeys* 中查找公钥，或直接使用条目中的 `certificate`。
4. 使用公钥验证 `signature` 与计算所得摘要是否匹配。
5. 重新计算 `.dxt` 内容（不含签名文件）的哈希，确保与 `signedPayload.digest` 一致。
6. （可选）验证 `manifest.json` 哈希。

CLI 示例：
```bash
node dxt_signature_tool.js verify ./output.dxt abc123 ./public_key.pem
```

---

## 🔁 密钥轮换
当旧密钥需要替换时，仅需：
1. 生成新密钥并取得其 `signingKeyId`（推荐使用公钥 SHA-256 指纹）。
2. 使用**新私钥**再次执行 `sign`，工具会覆盖/追加 `signatures` 数组项。
3. 在安装侧更新 `trustedPublicKeys`：
```json
{
  "trustedSigners": {
    "abc123": "My Company Old Key",
    "def456": "My Company New Key 2025"
  }
}
```
安装器遇到旧包时依然能识别 `abc123`，新包将验证 `def456`。

---

## 🛠️ 安装与依赖
```bash
# 克隆仓库
$ git clone <repo-url> && cd DxtSignatureTool

# 安装依赖
$ npm install
```

依赖列表（见 `package.json`）：
* `adm-zip` – 读写 ZIP
* Node.js 内置 `crypto`、`fs`、`path`

---

## 🧩 典型 .dxt 目录结构
```text
my_extension.dxt (ZIP)
├── manifest.json
├── main.js
├── assets/
└── META-INF/
    └── dxt-signatures.json
```

---

## 🔒 安全建议
* 推荐使用 **ECDSA P-256 + SHA-256** 算法，提高性能并缩短签名长度。
* 在 `dxt-signatures.json` 中存储时间戳，并在安装器侧校验有效期或进行时间戳服务（TSA）绑定。
* 配合 OCSP/CRL 或远程 API 实现密钥吊销。
* `manifest.json` 中可添加 `publisher` 字段供 UI 展示，与签名身份匹配。

---

## License
MIT 