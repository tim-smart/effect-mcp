import { NodeHttpClient, NodePath } from "@effect/platform-node"
import { Cache, Duration, Effect, Exit, Layer, pipe, Schedule } from "effect"
import { Array } from "effect/collections"
import { Option } from "effect/data"
import { Path } from "effect/platform"
import { Schema } from "effect/schema"
import { AiTool, AiToolkit, McpServer } from "effect/unstable/ai"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"
import Minisearch from "minisearch"
import * as Prettier from "prettier"
import { Markdown } from "./Markdown.js"
import { guides, readmes } from "./Readmes.js"

const docUrls = [
  "https://raw.githubusercontent.com/tim-smart/effect-io-ai/refs/heads/main/json/_all.json",
]
const websiteContentUrl =
  "https://raw.githubusercontent.com/tim-smart/effect-io-ai/refs/heads/main/website/content.json"

const websiteUrl = (path: string) =>
  `https://raw.githubusercontent.com/effect-ts/website/refs/heads/main/${path}`

const documentId = Schema.Number.annotate({
  description: "The unique identifier for the Effect documentation entry.",
})

const SearchResult = Schema.Struct({
  documentId,
  title: Schema.String,
  description: Schema.String,
}).annotate({
  description: "A search result from the Effect reference documentation.",
})

const toolkit = AiToolkit.make(
  AiTool.make("effect_docs_search", {
    description:
      "Searches the Effect documentation. Result content can be accessed with the `get_effect_doc` tool.",
    parameters: {
      query: Schema.String.annotate({
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
    description:
      "Get the Effect documentation for a documentId. The content might be paginated. Use the `page` parameter to specify which page to retrieve.",
    parameters: {
      documentId,
      page: Schema.optional(Schema.Number).annotate({
        description: "The page number to retrieve for the document content.",
      }),
    },
    success: Schema.Struct({
      content: Schema.String,
      page: Schema.Number,
      totalPages: Schema.Number,
    }),
  })
    .annotate(AiTool.Readonly, true)
    .annotate(AiTool.Destructive, false),
)

interface DocumentEntry {
  readonly id: number
  readonly title: string
  readonly description: string
  readonly content: Effect.Effect<string>
}

const ToolkitLayer = pipe(
  toolkit.toLayer(
    Effect.gen(function* () {
      const path_ = yield* Path.Path
      const defaultClient = yield* HttpClient.HttpClient
      const docsClient = defaultClient.pipe(
        HttpClient.filterStatusOk,
        HttpClient.retry({
          times: 5,
          schedule: retryPolicy,
        }),
      )
      const contentClient = defaultClient.pipe(
        HttpClient.filterStatusOk,
        HttpClient.retry({
          times: 3,
          schedule: Schedule.spaced(Duration.millis(500)),
        }),
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

      // Guides documentation
      for (const guide of guides) {
        addDoc({
          title: guide.title,
          description: guide.description,
          content: contentClient.get(guide.url).pipe(
            Effect.flatMap((response) => response.text),
            Effect.orDie,
          ),
        })
      }

      // Readme documentation
      for (const readme of readmes) {
        addDoc({
          title: readme.title,
          description: readme.description,
          content: contentClient.get(readme.url).pipe(
            Effect.flatMap((response) => response.text),
            Effect.orDie,
          ),
        })
      }

      // Website documentation
      yield* docsClient.get(websiteContentUrl).pipe(
        Effect.flatMap(
          HttpClientResponse.schemaBodyJson(Schema.Array(Schema.String)),
        ),
        Effect.flatMap(
          Effect.forEach(
            (filePath) =>
              docsClient.get(websiteUrl(filePath)).pipe(
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
                Effect.tapCause((cause) =>
                  Effect.logWarning(
                    `Failed to load website doc ${filePath}`,
                    cause,
                  ),
                ),
                Effect.ignore,
              ),
            { concurrency: 10, discard: true },
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

      yield* Effect.forEach(docUrls, loadDocs, { concurrency: 5 }).pipe(
        Effect.map((entries) => {
          for (const entry of entries.flat()) {
            addDoc({
              title: entry.nameWithModule,
              content: entry.asMarkdown,
              description: `Reference documentation for ${entry.nameWithModule} (${entry._tag}) from "${entry.project}"`,
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

      const cache = yield* Cache.makeWith({
        lookup: (id: number) =>
          docs[id].content.pipe(Effect.map((_) => _.split("\n"))),
        capacity: 512,
        timeToLive: (exit) =>
          Exit.isSuccess(exit) ? Duration.hours(12) : Duration.minutes(1),
      })

      return toolkit.of({
        effect_docs_search: Effect.fnUntraced(function* ({ query }) {
          const results = yield* Effect.orDie(search(query))
          return {
            results: results.map((result) => ({
              documentId: result.id,
              title: result.title,
              description: result.description,
            })),
          }
        }),
        get_effect_doc: Effect.fnUntraced(function* ({ documentId, page = 1 }) {
          const pageSize = 500
          const lines = yield* Cache.get(cache, documentId)
          const pages = Math.ceil(lines.length / pageSize)
          const offset = (page - 1) * pageSize
          return {
            content: lines.slice(offset, offset + pageSize).join("\n"),
            page,
            totalPages: pages,
          }
        }),
      })
    }),
  ),
  Layer.provide([
    NodeHttpClient.layerUndici,
    NodePath.layerPosix,
    Markdown.layer,
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
  description: Schema.OptionFromOptional(Schema.String),
  deprecated: Schema.Boolean,
  examples: Schema.Array(Schema.String),
  since: Schema.String,
  category: Schema.OptionFromOptional(Schema.String),
  signature: Schema.OptionFromOptional(Schema.String),
  sourceUrl: Schema.String,
}) {
  static readonly Array = Schema.Array(this)
  static readonly decode = Schema.decodeUnknownEffect(this)
  static readonly decodeArray = Schema.decodeUnknownEffect(this.Array)

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

const retryPolicy = Schedule.spaced(Duration.seconds(1))
