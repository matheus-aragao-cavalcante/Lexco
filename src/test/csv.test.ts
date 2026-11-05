import { describe, expect, it } from "vitest";
import { csvCelula, csvLinha } from "@/lib/csv";

describe("csv", () => {
  it("duplica aspas internas e usa ; como separador", () => {
    expect(csvLinha(['Ação "A"', "x;y", undefined])).toBe('"Ação ""A""";"x;y";""\n');
  });

  it("neutraliza fórmulas", () => {
    expect(csvCelula("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCelula("+55 11")).toBe("\"'+55 11\"");
    expect(csvCelula("-1")).toBe("\"'-1\"");
    expect(csvCelula("@SUM")).toBe("\"'@SUM\"");
    expect(csvCelula("normal")).toBe('"normal"');
  });
});
