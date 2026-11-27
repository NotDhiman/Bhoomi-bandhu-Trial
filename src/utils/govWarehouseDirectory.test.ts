import test from "node:test";
import assert from "node:assert/strict";
import {
  filterGovWarehouseRecords,
  normalizeOgdWarehouseRecords,
} from "./govWarehouseDirectory.ts";

test("normalizeOgdWarehouseRecords parses WDRA warehouse and NHB cold storage fields", () => {
  const normalized = normalizeOgdWarehouseRecords([
    {
      warehouse_name: "Punjab State Warehousing Corp Khanna",
      state_name: "Punjab",
      district_name: "Ludhiana",
      address: "GT Road, Khanna, Ludhiana",
      capacity_in_mt: "12,500",
      wdra_reg_no: "WDRA-PB-1042",
      sector: "SWC",
    },
    {
      cold_storage_name: "Doaba Agri Cold Storage",
      state: "Punjab",
      district: "Jalandhar",
      storage_capacity: "4200 MT",
      category: "Horticulture Cold Chain",
    },
  ]);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].facilityType, "Warehouse");
  assert.equal(normalized[0].state, "Punjab");
  assert.equal(normalized[0].capacityMt, 12500);
  assert.equal(normalized[0].registrationId, "WDRA-PB-1042");

  assert.equal(normalized[1].facilityType, "Cold Storage");
  assert.equal(normalized[1].district, "Jalandhar");
  assert.equal(normalized[1].capacityMt, 4200);
});

test("filterGovWarehouseRecords enforces state matching and keyword filtering", () => {
  const rows = normalizeOgdWarehouseRecords([
    {
      warehouse_name: "Khanna Grain Depot",
      state_name: "Punjab",
      district_name: "Ludhiana",
      capacity: "5000",
    },
    {
      cold_storage_name: "Nashik Onion Cold Chain",
      state_name: "Maharashtra",
      district_name: "Nashik",
      capacity: "3000",
    },
  ]);

  const punjabOnly = filterGovWarehouseRecords(rows, "Punjab", "");
  assert.equal(punjabOnly.length, 1);
  assert.equal(punjabOnly[0].state, "Punjab");

  const coldInAll = filterGovWarehouseRecords(rows, "All India", "cold");
  assert.equal(coldInAll.length, 1);
  assert.equal(coldInAll[0].name, "Nashik Onion Cold Chain");
});
