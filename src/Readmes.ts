import { NodeHttpClient } from "@effect/platform-node"
import { Effect, Layer, Schedule } from "effect"
import { Array } from "effect/collections"
import { McpServer } from "effect/unstable/ai"
import { HttpClient } from "effect/unstable/http"

export const guides = [
  {
    name: "writing-effect-code",
    title:
      "Writing Effect Code Guide - Learn the basics of writing Effect code",
    description: `Essential information for writing Effect code, including:

- Writing basic Effect code
- Writing Effect functions
- Error handling in Effect
- Defining & using Effect services
- Declaring your domain models with Schema
- Adding observability to your Effect code
- Testing Effect code
- Common patterns in Effect code (HttpApi, HttpClient, ManagedRuntime etc.)`,
    url: "https://raw.githubusercontent.com/tim-smart/effect-mcp/refs/heads/main/AGENTS.md",
  },
] as const

export const readmes = [
  {
    package: "@effect/cli",
    name: "@effect/cli README",
    title: "@effect/cli README - Command Line Interfaces",
    description: `README.md for the @effect/cli package, for implementing command line interfaces with Effect.`,
    url: "https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/cli/README.md",
  },
  {
    package: "@effect/platform",
    name: "@effect/platform README",
    title:
      "@effect/platform README - HttpApi, HttpClient, HttpServer, HttpLayerRouter",
    description: `README.md for the @effect/platform package.

Contains information about:
- HttpApi
- HttpClient
- HttpServer
- HttpLayerRouter`,
    url: "https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/platform/README.md",
  },
  {
    package: "@effect/rpc",
    name: "@effect/rpc README",
    title: "@effect/rpc README - RpcServer, RpcClient, RpcMiddleware",
    description: `README.md for the @effect/rpc package, for implementing rpc servers and clients.
Contains information about:
- RpcServer
- RpcClient
- RpcMiddleware`,
    url: "https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/rpc/README.md",
  },
  {
    package: "@effect/sql",
    name: "@effect/sql README",
    title: "@effect/sql README - SQL client and database interaction",
    description: `README.md for the @effect/sql package, for interacting with SQL databases.`,
    url: "https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/sql/README.md",
  },
] as const

export const Readmes = Layer.mergeAll(
  ...Array.map(guides, (guide) =>
    McpServer.resource({
      uri: `effect://guide/${guide.name}`,
      name: guide.title,
      description: guide.description,
      content: HttpClient.get(guide.url).pipe(
        Effect.flatMap((response) => response.text),
        Effect.retry({
          schedule: Schedule.spaced(500),
          times: 3,
        }),
      ),
    }),
  ),
  ...Array.map(readmes, (readme) =>
    McpServer.resource({
      uri: `effect://readme/${readme.package}`,
      name: readme.name,
      description: readme.description,
      content: HttpClient.get(readme.url).pipe(
        Effect.flatMap((response) => response.text),
        Effect.retry({
          schedule: Schedule.spaced(500),
          times: 3,
        }),
      ),
    }),
  ),
).pipe(Layer.provide(NodeHttpClient.layerUndici))
