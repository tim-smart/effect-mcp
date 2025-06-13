import { McpServer } from "@effect/ai"
import { HttpClient } from "@effect/platform"
import { NodeHttpClient } from "@effect/platform-node"
import { Effect, Layer } from "effect"

const CliReadme = McpServer.resource({
  uri: "readme://@effect/cli",
  name: "@effect/cli README",
  description: `README.md for the @effect/cli package, for implementing command line interfaces with Effect.`,
  content: HttpClient.get(
    "https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/cli/README.md",
  ).pipe(Effect.flatMap((_) => _.text)),
})

const PlatformReadme = McpServer.resource({
  uri: "readme://@effect/platform",
  name: "@effect/platform README",
  description: `README.md for the @effect/platform package.

Contains information about:
- HttpApi
- HttpClient
- HttpServer`,
  content: HttpClient.get(
    "https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/platform/README.md",
  ).pipe(Effect.flatMap((_) => _.text)),
})

const RpcReadme = McpServer.resource({
  uri: "readme://@effect/rpc",
  name: "@effect/rpc README",
  description: `README.md for the @effect/rpc package, for implementing rpc servers and clients.

Contains information about:
- RpcServer
- RpcClient
- RpcMiddleware`,
  content: HttpClient.get(
    "https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/rpc/README.md",
  ).pipe(Effect.flatMap((_) => _.text)),
})

const SqlReadme = McpServer.resource({
  uri: "readme://@effect/sql",
  name: "@effect/sql README",
  description: `README.md for the @effect/sql package, for interacting with SQL databases.`,
  content: HttpClient.get(
    "https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/sql/README.md",
  ).pipe(Effect.flatMap((_) => _.text)),
})

export const Readmes = Layer.mergeAll(
  CliReadme,
  PlatformReadme,
  RpcReadme,
  SqlReadme,
).pipe(Layer.provide(NodeHttpClient.layerUndici))
