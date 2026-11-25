// Publishes the label definition to the labeller account. Prints it unless --publish is given.
import { declareLabeler } from "@skyware/labeler/scripts";
import { DEFINITIONS } from "../label/definition.js";

console.log(JSON.stringify(DEFINITIONS, null, 2));

if (!process.argv.includes("--publish")) {
  console.log("\nNothing was published. Run `npm run declare -- --publish` to write this to the account.");
  process.exit(0);
}

const { LABELER_DID: identifier, LABELER_PASSWORD: password, PDS_URL, LABELER_2FA_CODE: code } = process.env;
if (!identifier || !password) {
  console.error("Set LABELER_DID and LABELER_PASSWORD (the account password, not an app password).");
  process.exit(1);
}
await declareLabeler(
  { identifier, password, pds: PDS_URL || "https://bsky.social", ...(code ? { code } : {}) },
  DEFINITIONS,
  true,
);
console.log("\nPublished.");
