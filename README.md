
<div align="right">
  <details>
    <summary >🌐 Language</summary>
    <div>
      <div align="center">
        <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=en">English</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=zh-CN">简体中文</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=zh-TW">繁體中文</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=ja">日本語</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=ko">한국어</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=hi">हिन्दी</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=th">ไทย</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=fr">Français</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=de">Deutsch</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=es">Español</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=it">Italiano</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=ru">Русский</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=pt">Português</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=nl">Nederlands</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=pl">Polski</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=ar">العربية</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=fa">فارسی</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=tr">Türkçe</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=vi">Tiếng Việt</a>
        | <a href="https://openaitx.github.io/view.html?user=tim-smart&project=effect-mcp&lang=id">Bahasa Indonesia</a>
      </div>
    </div>
  </details>
</div>

# effect mcp server

This MCP server adds tools and resources for accessing Effect documentation.

## Usage

You can run with docker using:

```bash
docker run --rm -i timsmart/effect-mcp
```

Or use npx:

```bash
npx -y effect-mcp@latest
```

## Cursor
To use this MCP server with Cursor, please add the following to your cursor `mcp.json`:

```json
"effect-docs": {
  "command": "npx",
  "args": ["-y", "effect-mcp@latest"]
}
```

## Claude Code Integration

To use this MCP server with Claude Code, run the following command:

```bash
claude mcp add-json effect-docs '{
  "command": "npx",
  "args": [
    "-y",
    "effect-mcp@latest"
  ],
  "env": {}
}' -s user
```
