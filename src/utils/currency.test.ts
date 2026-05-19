import { describe, expect, it } from "vitest";
import { toKSH, usdToKSH } from "./currency";

describe("currency utilities", () => {
  it("formats all app money in Kenyan shillings", () => {
    expect(toKSH(1234567)).toBe("KSh 1,234,567.00");
    expect(toKSH(500, 0)).toBe("KSh 500");
    expect(usdToKSH(10, 130)).toBe("KSh 1,300.00");
  });
});
