# Writing Effect Guide

## Pre-requisites

- Have the Effect MCP server installed and running.
  - `npx -y effect-mcp@latest`

## Critical information

**Important**: When requiring more information about Effect, use the `effect_docs_search` MCP
tool. It is an authoritative source of information about Effect and its
ecosystem.

## Writing basic Effect's

Prefer `Effect.gen` when writing Effect's. It is a powerful way to create
an Effect in a async/await style, which is more readable and maintainable.

```ts
import { Effect, Random } from "effect"

Effect.gen(function* () {
  // Use `yield*` to run another Effect
  yield* Effect.sleep("1 second")

  const bool = yield* Random.nextBoolean
  if (bool) {
    // When failing with Effect.fail/die etc. always use `return yield*` so
    // TypeScript can correctly narrow conditional types
    return yield* Effect.fail("Random boolean was true")
  }

  // You can return a success value directly
  return "Returned value"
}).pipe(
  // You can use the `pipe` method to add additional operations
  Effect.withSpan("tracing span"),
)
```

## Writing Effect functions

If you need to write a function that returns an Effect, prefer using
`Effect.fn`. It allows you to use the `yield*` syntax inside the function body,
and also add a span for observability.

```ts
import { Effect, Random } from "effect"

const myEffectFn = Effect.fn("myEffectFn")(
  function* (x: number, y: number) {
    const bool = yield* Random.nextBoolean
    if (bool) {
      // When failing with Effect.fail/die etc. always use `return yield*` so
      // TypeScript can correctly narrow conditional types
      return yield* Effect.fail("Random boolean was true")
    }
    return x + y
  },
  // You can add "pipe" operations as additional arguments
  Effect.annotateLogs({
    some: "annotation",
  }),
  // You can also access the arguments of the function in pipe operations
  (effect, x, y) => Effect.annotateLogs(effect, { x, y }),
)

// call the Effect function
myEffectFn(1, 2).pipe(Effect.runPromise)

// You can also omit the function span name if you don't need it
const withNoSpan = Effect.fn(function* (x: number, y: number) {
  yield* Effect.log("Calculating sum", { x, y })
  return x + y
})
```

## Avoid try / catch

**Critical**: Inside of Effect's, use `Effect.try` or `Effect.tryPromise` instead of `try /
catch`.

```ts
import { Effect, Schema } from "effect"

// Use Schema to define a custom error type
class JsonError extends Schema.TaggedError<JsonError>("JsonError")({
  cause: Schema.Defect,
}) {}

Effect.gen(function* () {
  // Use Effect.try to handle synchronous errors
  const result = yield* Effect.try({
    // Use the try block to execute code that may throw an error
    try: () => JSON.parse('{"invalidJson": }'),
    // Use the catch block to transform the error into a specific one
    catch: (cause) => new JsonError({ cause }),
  })

  // Use Effect.tryPromise to handle asynchronous errors
  const asyncResult = yield* Effect.tryPromise({
    // Use the try block to execute a Promise that may throw an error
    try: () => fetch("https://api.example.com/data").then((res) => res.json()),
    // Use the catch block to transform the error into a specific one
    catch: (cause) => new JsonError({ cause }),
  })

  return { result, asyncResult }
})
```

## Error handling with Effect

When you need to handle errors in Effect, use the following functions:

- `Effect.catchAll`: to handle all errors and recover from them.
- `Effect.catchAllCause`: to handle all errors including defects and recover
  from them.
- `Effect.catchTag`: to handle specific errors.
- `Effect.catchTags`: to handle multiple specific errors.
- `Effect.catchIf`: to handle errors based on a condition.

```ts
import { Effect, Random, Schema } from "effect"

// Use Schema to define some custom error types
class ErrorA extends Schema.TaggedError<ErrorA>("ErrorA")({
  cause: Schema.Defect,
}) {}

class ErrorB extends Schema.TaggedError<ErrorB>("ErrorB")({
  cause: Schema.Defect,
}) {}

class ErrorC extends Schema.TaggedError<ErrorC>("ErrorC")({
  cause: Schema.Defect,
}) {}

Effect.gen(function* () {
  const number = yield* Random.nextIntBetween(1, 4)

  if (number === 1) {
    // Simulate an error of type ErrorA
    return yield* Effect.fail(
      new ErrorA({ cause: new Error("Error A occurred") }),
    )
  } else if (number === 2) {
    // Simulate an error of type ErrorB
    return yield* Effect.fail(
      new ErrorB({ cause: new Error("Error B occurred") }),
    )
  } else if (number === 3) {
    // Simulate an error of type ErrorC
    return yield* Effect.fail(
      new ErrorC({ cause: new Error("Error C occurred") }),
    )
  }

  return "Success"
}).pipe(
  // Handle all errors and recover from them
  Effect.catchAll((error) => Effect.log("Got an error:", error)),
  // Or handle a specific error
  Effect.catchTag("ErrorA", (error) => Effect.log("Caught ErrorA:", error)),
  // Or handle multiple specific errors with a single handler
  Effect.catchTag("ErrorA", "ErrorB", (error) =>
    Effect.log("Caught ErrorA / ErrorB:", error),
  ),
  // Or handle multiple specific errors
  Effect.catchTags({
    ErrorA: (error) => Effect.log("Caught ErrorA:", error),
    ErrorB: (error) => Effect.log("Caught ErrorB:", error),
  }),
  // Or use a condition to handle errors
  Effect.catchIf(
    (error) => error._tag === "ErrorC",
    (error) => Effect.log("Caught ErrorC:", error),
  ),
)
```

## Writing Effect services

**VITAL INFORMATION: Most Effect code should be written as services**.

Services represent a collection of related Effect functions that can be composed together and
reused across your application. They are a powerful way to structure your
application and make it more maintainable.

```ts
import { Effect, Schema } from "effect"

export class Database extends Effect.Service<Database>()("Database", {
  // If you are using other Effect services, you can list them here
  dependencies: [],

  // ESSENTIAL: Always use the `scoped:` option
  scoped: Effect.gen(function* () {
    const query = Effect.fn("Database.query")(function* (sql: string) {
      // Add attributes to the current span for observability
      yield* Effect.annotateCurrentSpan({ sql })
      return { rows: [] } // Simulated result
    })

    // Return the service methods with `as const` to ensure type safety
    return { query } as const
  }),
}) {}

// Use Schema to define a custom service error type
export class UserServiceError extends Schema.TaggedError<UserServiceError>(
  "UserServiceError",
)({
  cause: Schema.optional(Schema.Defect),
}) {}

export class UserService extends Effect.Service<UserService>()("UserService", {
  // If you are using other Effect services, you can list them here.
  // `ServiceName.Default` is the default Layer that Effect.Service defines for
  // you.
  dependencies: [Database.Default],

  // ESSENTIAL: Always use the `scoped:` option
  scoped: Effect.gen(function* () {
    // Access other services at the top of the constructor

    // `yield*` the service class (it is actually a Context.Tag) to access it's interface
    const database = yield* Database

    const getAll = database.query("SELECT * FROM users").pipe(
      Effect.map((result) => result.rows),
      // Map the errors to the custom service error type
      Effect.mapError((cause) => new UserServiceError({ cause })),
    )

    return { getAll } as const
  }),
}) {}
```

### Type-first services

Another way of using the Effect dependency injection system is to define
services using `Context.Tag`.

```ts
import { Effect, Context, Layer } from "effect"

export class StripeClient extends Context.Tag("StripeClient")<
  StripeClient,
  {
    readonly methodA: (arg: string) => Effect.Effect<string>
    readonly methodB: (arg: number) => Effect.Effect<number>
  }
>() {
  // Define a Layer for the service
  static readonly Default = Layer.succeed(StripeClient, {
    methodA: (arg) => Effect.succeed(`Result A: ${arg}`),
    methodB: (arg) => Effect.succeed(arg * 2),
  })
}

Effect.gen(function* () {
  // Use `yield*` to access the service
  const stripe = yield* StripeClient

  // Call a method on the service
  const resultA = yield* stripeClient.methodA("some argument")
  const resultB = yield* stripeClient.methodB(42)

  return { resultA, resultB }
}).pipe(
  // Provide the service implementation with Effect.provideService
  Effect.provideService(StripeClient, {
    methodA: (arg) => Effect.succeed(`Result A: ${arg}`),
    methodB: (arg) => Effect.succeed(arg * 2),
  }),
  // Or provide the service implementation with a Layer
  // Essential: There should be only one `Effect.provide` in an Effect
  // application.
  Effect.provide(StripeClient.Default),
)
```

To re-iterate an essential point: **There should be only one `Effect.provide` in
an Effect application**. This means that you should provide all your services
at the top level of your application as a single Layer.

You can use functions from the `Layer` module to compose multiple Layers
together. Use the `effect_docs_search` MCP tool to find more information about
Layer composition.

## Defining the domain / entities with Effect

All domain entities should be defined using `Schema`. This allows you to
define the structure of your data, validate it, and use it in your Effect
services and functions.

For more information about `Schema`, use the `effect_docs_search` MCP tool to
search for the `Schema` README documentation.

```ts
import { Schema } from "effect"

// Define a UserId type
export const UserId = Schema.String.pipe(
  Schema.brand("UserId", {
    description: "A unique identifier for a user",
  }),
)
export type UserId = (typeof UserId).Type

// Define a User entity with Schema
export class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
  // Prefer using `Schema.DateTimeUtc` for date/time fields
  createdAt: Schema.DateTimeUtc,
}) {}

// Define a User error type with Schema
export class UserError extends Schema.TaggedError<UserError>("UserError")({
  cause: Schema.optional(Schema.Defect),
  message: Schema.String,
}) {}
```

### Using `Model` from `@effect/sql`

You can also use the `Model` module from `@effect/sql` to define your domain
entities. It allows you to define multiple schemas for the same entity in one
class, which allows you to have different views of the same data.

```ts
import { DateTime, Option, Schema } from "effect"
import { Model } from "@effect/sql"

export class User extends Model.Class<User>("User")({
  id: Model.Generated(UserId),
  firstName: Schema.NonEmptyTrimmedString,
  lastName: Schema.NonEmptyTrimmedString,
  dateOfBirth: Model.FieldOption(Model.Date),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

// The schema to use when accessing the database
User

// The schema to use when sending data to the client
User.json

// The schemas to use when inserting data
User.insert // For the database
User.jsonCreate // When receiving data from the client
User.insert.make({
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: Option.some(DateTime.unsafeNow()),
})

// The schemas to use when updating data
User.update // For the database
User.jsonUpdate // When receiving data from the client
User.update.make({
  id: UserId.make(123),
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: Option.some(DateTime.unsafeNow()),
})
```

## Adding observability

It is essential to add observability to your Effect code. This allows you to
trace the execution of your code, log important events, and monitor the
performance of your application.

Use:

- `Effect.withSpan` to add a tracing span to an Effect.
- `Effect.fn("span name")` to create a function with a tracing span.
- `Effect.annotateCurrentSpan` to add attributes to the current tracing span.
- `Effect.log` to log messages with the Effect logging system.

```ts
import { Effect } from "effect"

const withSpan = Effect.gen(function* () {
  // Add an attribute to the current span
  yield* Effect.annotateCurrentSpan({
    some: "annotation",
  })

  // Log a message with the Effect logging system at different levels
  yield* Effect.logInfo("This is a info message")
  yield* Effect.logWarning("This is a warning message")
  yield* Effect.logError("This is an error message")
  yield* Effect.logFatal("This is an fatal message")
  yield* Effect.logDebug("This is a debug message")
  yield* Effect.logTrace("This is a trace message")
}).pipe(
  // Add a tracing span to the Effect
  Effect.withSpan("my-span"),
)

const fnWithSpan = Effect.fn("myFunction")(function* (x: number, y: number) {
  // Add an attribute to the current span
  yield* Effect.annotateCurrentSpan({ x, y })

  // Log a message with the Effect logging system
  yield* Effect.logInfo("Calculating sum", { x, y })

  return x + y
})
```

## Testing Effect code

Use `vitest` to test your Effect code. It is a powerful testing framework that
allows you to write tests in a readable and maintainable way. Use the
`@effect/vitest` package to easily integrate Effect with Vitest.

```ts
import { Effect, TestClock } from "effect"
import { describe, it, assert } from "@effect/vitest"

const effectToTest = Effect.succeed("Hello, World!")

describe("My Effect tests", () => {
  // Always use `it.scoped` to run Effect tests
  it.scoped("should run an Effect and assert the result", () =>
    Effect.gen(function* () {
      const result = yield* effectToTest
      assert.strictEqual(result, "Hello, World!")
    }),
  )

  it.scoped("should handle errors in Effect", () =>
    Effect.gen(function* () {
      const errorEffect = Effect.fail("An error occurred")

      // Use `Effect.flip` to put the error in the success channel
      const error = yield* errorEffect.pipe(Effect.flip)

      assert.strictEqual(error, "An error occurred")
    }),
  )
})
```

## Common Effect modules

- `HttpApi` modules from `@effect/platform`: Write HTTP APIs using Effect & the
  `Schema` module. Search for the `@effect/platform` README with the
  `effect_docs_search` MCP tool for more information.
- `HttpClient` modules from `@effect/platform`: Write HTTP clients using Effect.
  Search for the `@effect/platform` README with the `effect_docs_search` MCP
  tool for more information.
- `@effect/sql` package: Write SQL queries using Effect
  - `@effect/sql-pg` package: Write SQL queries using Effect and PostgreSQL.
  - `@effect/sql-sqlite` package: Write SQL queries using Effect and SQLite.
  - `@effect/sql-mysql2` package: Write SQL queries using Effect and MySQL.
- `ManagedRuntime` from `effect`: Integrate Effect with 3rd party frameworks like
  React. Search for `ManagedRuntime` with the `effect_docs_search` MCP tool
  for more information.

Reminder: Use the `effect_docs_search` MCP tool to find more information about
Effect and its ecosystem. It includes documentation for many other Effect
modules and packages.
