# effect mcp server

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=effect%20docs&config=eyJjb21tYW5kIjoiZG9ja2VyIHJ1biAtLXJtIC1pIHRpbXNtYXJ0L2VmZmVjdC1tY3AifQ%3D%3D)

This MCP server adds tools and resources for accessing Effect documentation.

## Usage

You can run with docker using:

```bash
docker run --rm -i timsmart/effect-mcp
```

## Claude Code Integration

To use this MCP server with Claude Code, run the following command:

```bash
claude mcp add-json effect-docs '{
  "command": "docker",
  "args": [
    "run",
    "--rm",
    "-i",
    "timsmart/effect-mcp"
  ],
  "env": {}
}' -s user
```
