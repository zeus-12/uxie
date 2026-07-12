import { app, safeStorage } from "electron";
import { readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import type { Settings } from "../ipc-contract";

const DEFAULT: Settings = { llm: { baseUrl: "", apiKey: "", model: "" } };

const file = () => join(app.getPath("userData"), "settings.json");

// The API key is encrypted at rest via the OS keychain when available. On a
// system without one (e.g. headless Linux), it falls back to plaintext.
function seal(value: string): string {
  if (!value) return "";
  if (safeStorage.isEncryptionAvailable()) {
    return "enc:" + safeStorage.encryptString(value).toString("base64");
  }
  return "raw:" + value;
}

// Returns "" (not throwing) if the ciphertext can't be decrypted — e.g. keychain
// reset — so a lost key never blanks the rest of the config.
function unseal(value: string): string {
  try {
    if (value.startsWith("enc:")) {
      return safeStorage.decryptString(Buffer.from(value.slice(4), "base64"));
    }
  } catch {
    return "";
  }
  if (value.startsWith("raw:")) return value.slice(4);
  return value;
}

export function getSettings(): Settings {
  try {
    const raw = JSON.parse(readFileSync(file(), "utf8")) as Settings;
    return {
      llm: {
        baseUrl: raw.llm?.baseUrl ?? "",
        model: raw.llm?.model ?? "",
        apiKey: raw.llm?.apiKey ? unseal(raw.llm.apiKey) : "",
      },
    };
  } catch {
    return DEFAULT;
  }
}

export function setSettings(settings: Settings): void {
  const onDisk: Settings = {
    llm: { ...settings.llm, apiKey: seal(settings.llm.apiKey) },
  };
  const tmp = file() + ".tmp";
  writeFileSync(tmp, JSON.stringify(onDisk, null, 2));
  renameSync(tmp, file());
}
