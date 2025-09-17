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
