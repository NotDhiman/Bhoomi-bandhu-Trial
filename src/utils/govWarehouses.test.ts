import test from "node:test";
import assert from "node:assert/strict";
import {
  OFFICIAL_GOV_COLD_STORAGE_CATALOG,
  filterGovWarehouses,
  isValidOgdResourceId,
  normalizeOgdWarehouseRecords,
} from "./govWarehouses.ts";

test("isValidOgdResourceId allows valid UUIDs and slugs while blocking traversal or injection", () => {
  assert.equal(isValidOgdResourceId("9ef84268-d588-465a-a308-a864a43d0070"), true);
  assert.equal(isValidOgdResourceId("short"), false);
  assert.equal(isValidOgdResourceId("../etc/passwd"), false);
  assert.equal(isValidOgdResourceId("abc?api-key=evil"), false);
});

test("normalizeOgdWarehouseRecords maps heterogeneous data.gov.in schemas", () => {
  const normalized = normalizeOgdWarehouseRecords([
    {
      cold_storage_name: "Amritsar Co-op Cold Chain",
      state_name: "Punjab",
      district_name: "Amritsar",
      address: "GT Road, Amritsar",
      capacity_in_mt: "4,500",
      latitude: "31.63",
      longitude: "74.87",
      sector: "Cold Storage",
    },
    {
      warehouse_name: "Malwa WDRA Godown",
      state: "Madhya Pradesh",
      district: "Indore",
      capacity: 12000,
      wdra_reg_no: "WDRA-MP-889",
    },
    {
      // Invalid empty row skipped
      state: "",
      district: "",
    },
  ]);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].facilityType, "Cold Storage");
  assert.equal(normalized[0].capacityMt, 4500);
  assert.equal(normalized[0].latitude, 31.63);
  assert.equal(normalized[0].isLiveOgd, true);

  assert.equal(normalized[1].facilityType, "Warehouse / Godown");
  assert.equal(normalized[1].registrationId, "WDRA-MP-889");
});

test("filterGovWarehouses filters by state, facility type, and search text", () => {
  const pbCold = filterGovWarehouses({
    records: OFFICIAL_GOV_COLD_STORAGE_CATALOG,
    stateFilter: "Punjab",
    facilityTypeFilter: "cold_storage",
    searchQuery: "",
  });
  assert.ok(pbCold.length >= 2);
  assert.ok(pbCold.every((r) => r.state === "Punjab" && r.facilityType === "Cold Storage"));

  const searchMatch = filterGovWarehouses({
    records: OFFICIAL_GOV_COLD_STORAGE_CATALOG,
    stateFilter: "All India",
    facilityTypeFilter: "all",
    searchQuery: "Ludhiana",
  });
  assert.equal(searchMatch.length, 1);
  assert.equal(searchMatch[0].district, "Ludhiana");
});
