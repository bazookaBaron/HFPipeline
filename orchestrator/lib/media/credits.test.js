"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { htmlToText, cleanAuthor, shortCredit, fullCredit, MAX_SHORT } = require("./credits");
const { normalizeLicense } = require("./license");

const BYSA4 = normalizeLicense("CC BY-SA 4.0");

test("Artist HTML from Commons becomes plain text", () => {
  // recorded values (fixtures/commons-search-kingfisher.json)
  assert.strictEqual(cleanAuthor('<a rel="nofollow" class="external text" href="https://www.flickr.com/people/91807245@N00">marirs</a>'), "marirs");
  assert.strictEqual(cleanAuthor('<div class="fn value">\nSean D Silva</div>'), "Sean D Silva");
  assert.strictEqual(cleanAuthor('<span class="int-own-work" lang="en">Own work</span>'), "");
  assert.strictEqual(cleanAuthor('<a href="//commons.wikimedia.org/wiki/User:Foo_Bar" title="User:Foo Bar">User:Foo Bar</a> (<a href="x">talk</a>)'), "Foo Bar");
  assert.strictEqual(htmlToText("Ren&eacute; &amp; Co &#8211; 2008"), "Ren&eacute; & Co – 2008");
  assert.strictEqual(cleanAuthor("Photo by: Jane Doe (https://example.org/jane)"), "Jane Doe");
  assert.strictEqual(cleanAuthor("Copyright World Economic Forum (www.weforum.org)"), "World Economic Forum (www.weforum.org)");
});

test("short credit format and <= 70 chars", () => {
  const s = shortCredit({ kind: "photo", source: "commons", author: "Prateek Karandikar", licence: BYSA4 });
  assert.strictEqual(s, "Photo: Prateek Karandikar / Wikimedia Commons · CC BY-SA 4.0");
  const long = shortCredit({
    kind: "photo",
    source: "commons",
    author: "Bureau of Public Affairs of the Department of State of the United States of America",
    licence: BYSA4,
  });
  assert.ok(long.length <= MAX_SHORT, long);
  assert.ok(long.endsWith("/ Wikimedia Commons · CC BY-SA 4.0"), "licence is never dropped: " + long);
  assert.match(long, /…/);
  const many = shortCredit({ kind: "photo", source: "commons", author: "Ann Lee, Beatrice Longname and Carl Third", licence: BYSA4 });
  assert.ok(many.length <= MAX_SHORT, many);
  assert.match(many, /Photo: Ann Lee et al\. \//);
});

test("kind labels, NASA, Openverse, illustration, no author", () => {
  assert.strictEqual(shortCredit({ kind: "logo", source: "commons", author: "", licence: normalizeLicense("Public domain") }), "Logo: Wikimedia Commons · Public domain");
  assert.strictEqual(shortCredit({ kind: "photo", source: "nasa", author: "NASA/Carla Thomas", licence: normalizeLicense("Public domain") }), "Photo: NASA / Carla Thomas · Public domain");
  assert.strictEqual(shortCredit({ kind: "photo", source: "nasa", author: "", licence: normalizeLicense("Public domain") }), "Photo: NASA · Public domain");
  assert.strictEqual(
    shortCredit({ kind: "photo", source: "openverse", provider: "flickr", author: "markhillary", licence: normalizeLicense("by", { version: "2.0" }) }),
    "Photo: markhillary / Flickr · CC BY 2.0"
  );
  assert.strictEqual(shortCredit({ kind: "illustration", source: "illustration" }), "Illustration: AI-generated");
});

test("full credit has title, author, page URL, licence URL and the changes note", () => {
  const f = fullCredit({
    kind: "photo",
    source: "commons",
    title: "Kingfisher Airlines tail",
    author: "Prateek Karandikar",
    pageUrl: "https://commons.wikimedia.org/wiki/File:Kingfisher_Airlines_tail.JPG",
    licence: BYSA4,
  });
  assert.strictEqual(
    f,
    '"Kingfisher Airlines tail" · by Prateek Karandikar · Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Kingfisher_Airlines_tail.JPG · CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/) · cropped/scaled'
  );
  assert.match(fullCredit({ source: "illustration", model: "gemini-3.1-flash-image" }), /AI-generated .*not a photograph/);
});

test("GODL-India credit", () => {
  assert.strictEqual(
    shortCredit({ kind: "photo", source: "commons", author: "Press Information Bureau", licence: normalizeLicense("GODL-India") }),
    "Photo: Press Information Bureau / Wikimedia Commons · GODL-India"
  );
});
