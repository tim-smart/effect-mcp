import { AiTool, AiToolkit, McpServer } from "@effect/ai"
import { HttpClient, HttpClientResponse } from "@effect/platform"
import { NodeHttpClient } from "@effect/platform-node"
import {
  Duration,
  Effect,
  Layer,
  Option,
  Resource,
  Schedule,
  Schema,
} from "effect"
import fuzzysort from "fuzzysort"
import Minisearch from "minisearch"
import * as Prettier from "prettier"

const docUrls = [
  "https://raw.githubusercontent.com/tim-smart/effect-io-ai/refs/heads/main/json/_all.json",
]
const documentId = Schema.Number.annotations({
  description: "The unique identifier for the Effect documentation entry.",
})

const SearchResult = Schema.Struct({
  documentId,
  label: Schema.String,
}).annotations({
  description: "A search result from the Effect reference documentation.",
})

const toolkit = AiToolkit.make(
  AiTool.make("effect_doc_search", {
    description:
      "Searches the Effect reference documentation for a given query.",
    parameters: {
      query: Schema.String.annotations({
        description:
          "The search query to look for in the module documentation, e.g. `Effect.map` or `Stream.flatMap`.",
      }),
    },
    success: Schema.Array(SearchResult),
  })
    .annotate(AiTool.Readonly, true)
    .annotate(AiTool.Destructive, false),

  AiTool.make("get_effect_doc", {
    description: "Get the Effect documentation for a given document ID.",
    parameters: { documentId },
    success: Schema.String,
  })
    .annotate(AiTool.Readonly, true)
    .annotate(AiTool.Destructive, false),
)

const ToolkitLayer = toolkit
  .toLayer(
    Effect.gen(function* () {
      const docsClient = (yield* HttpClient.HttpClient).pipe(
        HttpClient.filterStatusOk,
        HttpClient.retry(retryPolicy),
      )

      const loadDocs = (url: string) =>
        Effect.flatMap(
          docsClient.get(url),
          HttpClientResponse.schemaBodyJson(DocEntry.Array),
        )

      const docs = yield* Resource.auto(
        Effect.forEach(docUrls, loadDocs, {
          concurrency: docUrls.length,
        }).pipe(
          Effect.map((_) => _.flat()),
          Effect.map((entries) => {
            const minisearch = new Minisearch<{
              id: number
              nameWithModule: string
              description: string
            }>({
              fields: ["nameWithModule", "description"],
            })
            minisearch.addAll(
              entries.map((entry, id) => ({
                id,
                nameWithModule: entry.nameWithModule,
                description: Option.getOrElse(entry.description, () => ""),
              })),
            )
            return { minisearch, entries }
          }),
        ),
        Schedule.spaced(Duration.hours(3)),
      )

      const search = (query: string) => {
        query = query.toLowerCase()
        return Resource.get(docs).pipe(
          Effect.map(({ minisearch, entries }) =>
            minisearch.search(query).map((result) => ({
              id: Number(result.id),
              entry: entries[result.id],
            })),
          ),
          Effect.annotateLogs("module", "ReferenceDocs"),
          Effect.annotateLogs("query", query),
        )
      }

      return toolkit.of({
        effect_doc_search: Effect.fn(function* ({ query }) {
          const results = yield* Effect.orDie(search(query))
          return results.map((result) => ({
            documentId: result.id,
            label: result.entry.nameWithModule,
          }))
        }),
        get_effect_doc: Effect.fn(function* ({ documentId }) {
          const doc = yield* Resource.get(docs).pipe(
            Effect.map((_) => _.entries[documentId]),
            Effect.orDie,
          )
          return yield* doc.asMarkdown
        }),
      })
    }),
  )
  .pipe(Layer.provide(NodeHttpClient.layerUndici))

export const ReferenceDocsTools = McpServer.toolkit(toolkit).pipe(
  Layer.provide(ToolkitLayer),
)

// schema

class DocEntry extends Schema.Class<DocEntry>("DocEntry")({
  _tag: Schema.String,
  module: Schema.Struct({
    name: Schema.String,
  }),
  project: Schema.String,
  name: Schema.String,
  description: Schema.optionalWith(Schema.String, {
    as: "Option",
    nullable: true,
  }),
  deprecated: Schema.Boolean,
  examples: Schema.Array(Schema.String),
  since: Schema.String,
  category: Schema.optionalWith(Schema.String, {
    as: "Option",
    nullable: true,
  }),
  signature: Schema.optionalWith(Schema.String, {
    as: "Option",
    nullable: true,
  }),
  sourceUrl: Schema.String,
}) {
  static readonly Array = Schema.Array(this)
  static readonly decode = Schema.decodeUnknown(this)
  static readonly decodeArray = Schema.decodeUnknown(this.Array)

  get url() {
    const project =
      this.project === "effect"
        ? "effect/effect"
        : this.project.replace(/^@/g, "")
    return `https://effect-ts.github.io/${project}/${this.module.name}.html#${this.name.toLowerCase()}`
  }

  get moduleTitle() {
    return this.module.name.replace(/\.[^/.]+$/, "")
  }

  get nameWithModule() {
    return `${this.moduleTitle}.${this.name}`
  }

  get isSignature() {
    return Option.isSome(this.signature)
  }

  get searchTerm(): string {
    return `/${this.project}/${this.moduleTitle}.${this.name}.${this._tag}`
  }

  readonly preparedFuzzySearch = fuzzysort.prepare(
    `${this.moduleTitle}.${this.name}`,
  )

  get asMarkdown(): Effect.Effect<string> {
    return Effect.gen(this, function* () {
      let description = Option.getOrElse(this.description, () => "")

      if (Option.isSome(this.signature)) {
        description +=
          "\n\n```ts\n" + (yield* prettify(this.signature.value)) + "\n```"
      }

      if (this.examples.length > 0) {
        description += "\n\n**Example**"
        for (const example of this.examples) {
          description += "\n\n```ts\n" + example + "\n```"
        }
      }

      return `# ${this.project}/${this.nameWithModule}

${description}`
    })
  }
}

// prettier

const prettify = (code: string) =>
  Effect.tryPromise(() =>
    Prettier.format(code, {
      parser: "typescript",
      semi: false,
    }),
  ).pipe(Effect.orElseSucceed(() => code))

// errors

const retryPolicy = Schedule.spaced(Duration.seconds(3))
