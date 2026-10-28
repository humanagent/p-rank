import { describe, expect, test } from "bun:test";
import { isValidEmail, matchesClub, sign, verify } from "./session";

describe("sign / verify", () => {
  const key = "test-secret";
  test("round trips", () => {
    const v = JSON.stringify({ email: "a@b.co", exp: 1 });
    expect(verify(sign(v, key), key)).toBe(v);
  });
  test("rejects a wrong secret", () => {
    expect(verify(sign("x", key), "other")).toBeNull();
  });
  test("rejects a tampered body", () => {
    const [, mac] = sign('{"email":"a@b.co"}', key).split(".");
    const forged = Buffer.from('{"email":"coach@meridian.club"}').toString("base64url");
    expect(verify(`${forged}.${mac}`, key)).toBeNull();
  });
  test("rejects malformed tokens", () => {
    for (const t of ["", "abc", ".abc", "abc.", "a.b.c"]) expect(verify(t, key)).toBeNull();
  });
});

describe("matchesClub", () => {
  test("domain entry", () => {
    expect(matchesClub("Coach@Meridian.Club", "@meridian.club")).toBe(true);
    expect(matchesClub("me@gmail.com", "@meridian.club")).toBe(false);
  });
  test("domain entry does not match a lookalike domain", () => {
    expect(matchesClub("x@evilmeridian.club", "@meridian.club")).toBe(false);
  });
  test("exact entries and lists", () => {
    const list = " coach@x.com , @meridian.club ";
    expect(matchesClub("coach@x.com", list)).toBe(true);
    expect(matchesClub("other@x.com", list)).toBe(false);
    expect(matchesClub("a@meridian.club", list)).toBe(true);
  });
  test("empty list matches nobody", () => {
    expect(matchesClub("a@meridian.club", "")).toBe(false);
  });
});

test("isValidEmail", () => {
  expect(isValidEmail("a@b.co")).toBe(true);
  expect(isValidEmail("nope")).toBe(false);
  expect(isValidEmail("a b@c.de")).toBe(false);
});
