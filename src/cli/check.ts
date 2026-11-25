// Shows how the detector judges a piece of text: npm run check -- "some text"
import { detect } from "../detect/match.js";

const text = process.argv.slice(2).join(" ");
if (!text) {
  console.error('Usage: npm run check -- "text to check"');
  process.exit(2);
}
console.log(detect([text]));
