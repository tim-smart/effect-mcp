# effect mcp server

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=effect%20docs&config=eyJjb21tYW5kIjoiZG9ja2VyIHJ1biAtLXJtIC1pIHRpbXNtYXJ0L2VmZmVjdC1tY3AifQ%3D%3D)

This MCP server adds tools and resources for accessing Effect documentation.

## Usage

You can run with docker using:

```bash
docker run --rm -i timsmart/effect-mcp
```

If you hit the github rate limit (for accessing the effect website docs), you can use the `GITHUB_TOKEN` environment variable to authenticate:

```bash
docker run --rm -i -e GITHUB_TOKEN=your_token timsmart/effect-mcp
```
