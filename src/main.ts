#!/usr/bin/env node
import { NodeRuntime, NodeSink, NodeStream } from "@effect/platform-node"
import { Layer, Logger } from "effect"
import { ReferenceDocsTools } from "./ReferenceDocs.js"
import { Readmes } from "./Readmes.js"
import { McpServer } from "effect/unstable/ai"

McpServer.layerStdio({
  name: "effect-mcp",
  version: "0.1.0",
  stdin: NodeStream.stdin,
  stdout: NodeSink.stdout,
}).pipe(
  Layer.provide([ReferenceDocsTools, Readmes]),
  Layer.provide(Layer.succeed(Logger.LogToStderr)(true)),
  Layer.launch,
  NodeRuntime.runMain,
)
