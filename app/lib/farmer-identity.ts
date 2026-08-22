import type { FarmerProfile } from "./types";

function prefix(value: string, length: number, fallback: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (cleaned || fallback).slice(0, length).padEnd(length, "X");
}

function identitySeed(profile: FarmerProfile) {
  const digits = profile.mobile.replace(/\D/g, "");
  return [
    digits,
    profile.name.trim().toLocaleLowerCase("en-IN"),
    profile.state.trim().toLocaleLowerCase("en-IN"),
    profile.district.trim().toLocaleLowerCase("en-IN"),
    profile.village.trim().toLocaleLowerCase("en-IN"),
  ].join("|");
}

function fallbackHash(bytes: Uint8Array) {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function generateInternalFarmerId(profile: FarmerProfile) {
  const bytes = new TextEncoder().encode(identitySeed(profile));
  let suffix = fallbackHash(bytes);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    suffix = Array.from(new Uint8Array(digest).slice(0, 4))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }
  return [
    "GC",
    prefix(profile.state, 2, "IN"),
    prefix(profile.district, 3, "LOC"),
    suffix.toUpperCase(),
  ].join("-");
}
