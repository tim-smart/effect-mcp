# effect mcp server

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=effect%20docs&config=eyJjb21tYW5kIjoibnB4IC15IGVmZmVjdC1tY3AifQ%3D%3D)

This MCP server adds tools and resources for accessing Effect documentation.

## Usage

You can run with docker using:

```bash
docker run --rm -i timsmart/effect-mcp
```

Or use npx:

```bash
npx -y effect-mcp
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
    "effect-mcp",
  ],
  "env": {}
}' -s user
```
