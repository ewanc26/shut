import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { postText, profileText } from "../../src/detect/record.js";

describe("postText", () => {
  it("collects text, tags, alt text and link card copy", () => {
    const segments = postText({
      text: "text",
      tags: ["outline"],
      facets: [{ features: [{ $type: "app.bsky.richtext.facet#tag", tag: "facet" }] }],
      embed: {
        $type: "app.bsky.embed.recordWithMedia",
        media: { images: [{ alt: "alt" }], external: { title: "title", description: "description", uri: "u" } },
      },
    });
    assert.deepEqual(segments, ["text", "#outline", "#facet", "alt", "title", "description"]);
  });

  it("survives records that do not match the schema", () => {
    assert.deepEqual(postText(null), []);
    assert.deepEqual(postText({ text: 5, tags: "x", facets: [null, { features: 1 }], embed: "x" }), []);
  });
});

describe("profileText", () => {
  it("collects the display name and bio", () => {
    assert.deepEqual(profileText({ displayName: "name", description: "bio", avatar: {} }), ["name", "bio"]);
  });
});
