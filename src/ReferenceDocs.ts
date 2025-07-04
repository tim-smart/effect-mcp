import { AiTool, AiToolkit, McpServer } from "@effect/ai"
import { HttpClient, HttpClientResponse, Path } from "@effect/platform"
import { NodeHttpClient, NodePath } from "@effect/platform-node"
import {
  Array,
  Cache,
  Duration,
  Effect,
  Layer,
  Option,
  pipe,
  Schedule,
  Schema,
} from "effect"
import Minisearch from "minisearch"
import * as Prettier from "prettier"
import { Markdown } from "./Markdown.js"
import { readmes } from "./Readmes.js"

const docUrls = [
  "https://raw.githubusercontent.com/tim-smart/effect-io-ai/refs/heads/main/json/_all.json",
]
const websiteContentUrl =
  "https://raw.githubusercontent.com/tim-smart/effect-io-ai/refs/heads/main/website/content.json"

const websiteUrl = (path: string) =>
  `https://raw.githubusercontent.com/effect-ts/website/refs/heads/main/${path}`

const documentId = Schema.Number.annotations({
  description: "The unique identifier for the Effect documentation entry.",
})

const SearchResult = Schema.Struct({
  documentId,
  title: Schema.String,
  description: Schema.optional(Schema.String),
}).annotations({
  description: "A search result from the Effect reference documentation.",
})

const toolkit = AiToolkit.make(
  AiTool.make("effect_doc_search", {
    description:
      "Searches the Effect documentation. Result content can be accessed with the `get_effect_doc` tool.",
    parameters: {
      query: Schema.String.annotations({
        description: "The search query to look for in the documentation.",
      }),
    },
    success: Schema.Struct({
      results: Schema.Array(SearchResult),
    }),
  })
    .annotate(AiTool.Readonly, true)
    .annotate(AiTool.Destructive, false),

  AiTool.make("get_effect_doc", {
    description: "Get the Effect documentation for a documentId.",
    parameters: { documentId },
    success: Schema.String,
  })
    .annotate(AiTool.Readonly, true)
    .annotate(AiTool.Destructive, false),
)

interface DocumentEntry {
  readonly id: number
  readonly title: string
  readonly description?: string
  readonly content: Effect.Effect<string>
}

const ToolkitLayer = pipe(
  toolkit.toLayer(
    Effect.gen(function* () {
      const path_ = yield* Path.Path
      const client = yield* HttpClient.HttpClient
      const docsClient = client.pipe(
        HttpClient.filterStatusOk,
        HttpClient.retry(retryPolicy),
      )
      const markdown = yield* Markdown
      const docs = Array.empty<DocumentEntry>()
      const minisearch = new Minisearch<DocumentEntry>({
        fields: ["title", "description"],
        searchOptions: {
          boost: { title: 2 },
        },
      })
      const addDoc = (doc: Omit<DocumentEntry, "id">) => {
        const entry: DocumentEntry = {
          id: docs.length,
          title: doc.title,
          description: doc.description,
          content: doc.content,
        }
        docs.push(entry)
        minisearch.add(entry)
      }

      // Readme documentation
      for (const readme of readmes) {
        addDoc({
          title: readme.title,
          description: readme.description,
          content: client.get(readme.url).pipe(
            Effect.flatMap((response) => response.text),
            Effect.orDie,
          ),
        })
      }

      // Website documentation
      yield* pipe(
        client.get(websiteContentUrl),
        Effect.flatMap(
          HttpClientResponse.schemaBodyJson(Schema.Array(Schema.String)),
        ),
        Effect.flatMap(
          Effect.forEach(
            (filePath) =>
              client.get(websiteUrl(filePath)).pipe(
                Effect.flatMap((_) => _.text),
                Effect.flatMap((md) => markdown.process(md)),
                Effect.map((file) => {
                  const dirname = path_.basename(path_.dirname(filePath))
                  addDoc({
                    title:
                      dirname !== "docs"
                        ? `${dirname.replace("-", " ")} - ${file.title}`
                        : file.title,
                    description: file.description,
                    content: Effect.succeed(file.content),
                  })
                }),
              ),
            { concurrency: "unbounded", discard: true },
          ),
        ),
        Effect.forkScoped,
      )

      // Reference documentation
      const loadDocs = (url: string) =>
        Effect.flatMap(
          docsClient.get(url),
          HttpClientResponse.schemaBodyJson(DocEntry.Array),
        )

      yield* Effect.forEach(docUrls, loadDocs, {
        concurrency: docUrls.length,
      }).pipe(
        Effect.map((entries) => {
          for (const entry of entries.flat()) {
            addDoc({
              title: entry.nameWithModule,
              content: entry.asMarkdown,
            })
          }
        }),
        Effect.forkScoped,
      )

      const search = (query: string) =>
        Effect.sync(() =>
          minisearch
            .search(query)
            .slice(0, 50)
            .map((result) => docs[result.id]),
        )

      const cache = yield* Cache.make({
        lookup: (id: number) => docs[id].content,
        capacity: 512,
        timeToLive: Duration.hours(12),
      })

      return toolkit.of({
        effect_doc_search: Effect.fn(function* ({ query }) {
          const results = yield* Effect.orDie(search(query))
          return {
            results: results.map((result) => ({
              documentId: result.id,
              title: result.title,
              description: result.description,
            })),
          }
        }),
        get_effect_doc: ({ documentId }) => cache.get(documentId),
      })
    }),
  ),
  Layer.provide([
    NodeHttpClient.layerUndici,
    NodePath.layerPosix,
    Markdown.Default,
  ]),
)

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
