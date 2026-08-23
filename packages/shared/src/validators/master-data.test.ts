import { describe, expect, it } from "vitest";
import {
  createErpAccountSchema,
  createErpCustomerSchema,
  createErpProductSchema,
  createErpSupplierSchema,
} from "./master-data.js";

const validCustomer = {
  code: "C-001",
  name: "Cliente SA",
  taxId: "11111111000191",
};

describe("master data validators", () => {
  it("accepts a valid customer", () => {
    const parsed = createErpCustomerSchema.parse(validCustomer);
    expect(parsed.code).toBe("C-001");
    expect(parsed.status).toBe("active");
  });

  it("rejects non-digit tax ids", () => {
    expect(() =>
      createErpCustomerSchema.parse({ ...validCustomer, taxId: "11.111.111/0001-91" }),
    ).toThrow();
  });

  it("rejects invalid codes", () => {
    expect(() => createErpCustomerSchema.parse({ ...validCustomer, code: "Código ruim!" })).toThrow();
  });

  it("accepts a valid product with NCM", () => {
    const parsed = createErpProductSchema.parse({
      code: "SKU-1",
      name: "Produto A",
      ncm: "84713000",
      priceCents: 1000,
    });
    expect(parsed.unit).toBe("UN");
    expect(parsed.priceCents).toBe(1000);
  });

  it("accepts suppliers and accounts", () => {
    expect(createErpSupplierSchema.parse({ code: "S-1", name: "Fornecedor", taxId: "14000123000123" }).code).toBe("S-1");
    const account = createErpAccountSchema.parse({ code: "1.1.1", name: "Caixa", accountType: "asset" });
    expect(account.accountType).toBe("asset");
    expect(() => createErpAccountSchema.parse({ code: "9.9", name: "X", accountType: "magic" })).toThrow();
  });
});
