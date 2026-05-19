import { defineConfig } from "vitest/config"
import path from "node:path"

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Next.js `server-only` guard is a build-time-only marker.
      // Under vitest we stub it to an empty module so files using
      // `import "server-only"` can be unit-tested directly.
      "server-only": path.resolve(__dirname, "__tests__/__stubs__/empty.ts"),
    },
  },
})
