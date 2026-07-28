import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL("../data/generated.json", import.meta.url);

test("generated dataset contains the complete letter corpus", async () => {
  const data = JSON.parse(await readFile(dataUrl, "utf8"));
  assert.equal(data.letters.length, 306);
  assert.equal(new Set(data.letters.map((letter) => letter.id)).size, 306);
});

test("available entity layers are backed by real annotations", async () => {
  const data = JSON.parse(await readFile(dataUrl, "utf8"));
  for (const type of ["PER", "LOC", "BOK", "VER", "TIM", "OFF", "ORG", "KIN", "AST"]) {
    assert.ok(data.entityStats[type].mentionCount > 0, `${type} should have mentions`);
    assert.ok(data.entityStats[type].canonicalCount > 0, `${type} should have normalized entries`);
  }
});

test("structured letter metadata provides dates, summaries, and sources", async () => {
  const data = JSON.parse(await readFile(dataUrl, "utf8"));
  assert.equal(data.letters.filter((letter) => letter.dateLabel).length, 306);
  assert.equal(data.letters.filter((letter) => letter.summary).length, 306);
  assert.ok(data.letters.filter((letter) => letter.source).length >= 300);
});

test("all stored annotation spans resolve into their source letters", async () => {
  const data = JSON.parse(await readFile(dataUrl, "utf8"));
  const letters = new Map(data.letters.map((letter) => [letter.id, letter.text]));
  for (const [letterId, mentions] of Object.entries(data.entitiesByLetter)) {
    for (const mention of mentions) {
      assert.ok(mention.start >= 0, `${letterId} has an unresolved entity span`);
      assert.equal(letters.get(letterId).slice(mention.start, mention.end), mention.surface);
    }
  }
  for (const [letterId, events] of Object.entries(data.eventsByLetter)) {
    for (const event of events) {
      assert.ok(event.start >= 0, `${letterId} has an unresolved event span`);
      assert.equal(letters.get(letterId).slice(event.start, event.end), event.originalText);
    }
  }
});
