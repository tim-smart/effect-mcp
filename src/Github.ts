import type {
  Api,
  RestEndpointMethodTypes,
} from "@octokit/plugin-rest-endpoint-methods"
import type { OctokitResponse } from "@octokit/types"
import {
  Chunk,
  Config,
  Data,
  Effect,
  Option,
  pipe,
  Redacted,
  Schedule,
  Stream,
} from "effect"
import { Octokit } from "octokit"

export class GithubError extends Data.TaggedError("GithubError")<{
  readonly cause: unknown
}> {}

export class Github extends Effect.Service<Github>()("app/Github", {
  effect: Effect.gen(function* () {
    const token = yield* Config.redacted("GITHUB_TOKEN").pipe(
      Config.withDefault(undefined),
    )
    const octokit = new Octokit(
      token && {
        auth: Redacted.value(token),
      },
    )

    const rest = octokit.rest

    const request = <A>(f: (_: Api["rest"]) => Promise<A>) =>
      Effect.withSpan(
        Effect.tryPromise({
          try: () => f(rest as any),
          catch: (cause) => new GithubError({ cause }),
        }),
        "Github.request",
      )

    const wrap =
      <A, Args extends Array<any>>(
        f: (_: Api["rest"]) => (...args: Args) => Promise<OctokitResponse<A>>,
      ) =>
      (...args: Args) =>
        Effect.map(
          Effect.tryPromise({
            try: () => f(rest as any)(...args),
            catch: (cause) => new GithubError({ cause }),
          }),
          (_) => _.data,
        )

    const stream = <A>(
      f: (_: Api["rest"], page: number) => Promise<OctokitResponse<Array<A>>>,
    ) =>
      Stream.paginateChunkEffect(0, (page) =>
        Effect.map(
          Effect.tryPromise({
            try: () => f(rest as any, page),
            catch: (cause) => new GithubError({ cause }),
          }),
          (_) => [
            Chunk.unsafeFromArray(_.data),
            maybeNextPage(page, _.headers.link),
          ],
        ),
      )

    const contents = wrap((rest) => rest.repos.getContent)
    type File = Extract<
      RestEndpointMethodTypes["repos"]["getContent"]["response"]["data"],
      { type: "file" }
    >
    const walk = (options: {
      readonly owner: string
      readonly repo: string
      readonly path: string
    }): Stream.Stream<File, GithubError> =>
      contents({
        owner: options.owner,
        repo: options.repo,
        path: options.path,
      }).pipe(
        Effect.retry({
          times: 5,
          schedule: Schedule.exponential(200, 1.5),
        }),
        Stream.map((content) =>
          Array.isArray(content)
            ? Chunk.unsafeFromArray(content)
            : Chunk.of(content),
        ),
        Stream.flattenChunks,
        Stream.flatMap(
          (content) =>
            content.type === "dir"
              ? walk({
                  owner: options.owner,
                  repo: options.repo,
                  path: content.path,
                })
              : content.type === "file"
                ? Stream.succeed(content as File)
                : Stream.empty,
          { concurrency: "unbounded" },
        ),
      )

    return { request, wrap, stream, walk } as const
  }),
}) {}

// == helpers

const maybeNextPage = (page: number, linkHeader?: string) =>
  pipe(
    Option.fromNullable(linkHeader),
    Option.filter((_) => _.includes(`rel="next"`)),
    Option.as(page + 1),
  )
