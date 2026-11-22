import { describe, expect, it } from "vitest";

import { isPrivateIpAddress } from "@/server/article/safe-fetch";

describe("isPrivateIpAddress", () => {
  it.each([
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.16.0.1",
    "192.168.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ])("rejects private or reserved address %s", (address) => {
    expect(isPrivateIpAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPrivateIpAddress(address)).toBe(false);
    },
  );
});
