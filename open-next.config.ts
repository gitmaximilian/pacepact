import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  // `npm run build` runs the OpenNext build (so Cloudflare's default build settings work);
  // OpenNext itself builds Next.js with this command, which avoids calling itself.
  buildCommand: "npm run build:next",
};
