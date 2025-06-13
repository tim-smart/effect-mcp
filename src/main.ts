import { McpServer } from "@effect/ai"
import { NodeRuntime, NodeSink, NodeStream } from "@effect/platform-node"
import { Layer, Logger } from "effect"
import { ReferenceDocsTools } from "./ReferenceDocs.js"

McpServer.layerStdio({
  name: "effect-mcp",
  version: "0.1.0",
  stdin: NodeStream.stdin,
  stdout: NodeSink.stdout,
}).pipe(
  Layer.provide([ReferenceDocsTools]),
  Layer.provide(Logger.add(Logger.prettyLogger({ stderr: true }))),
  Layer.launch,
  NodeRuntime.runMain,
)
