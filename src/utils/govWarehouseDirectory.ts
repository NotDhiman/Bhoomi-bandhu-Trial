export interface GovWarehouseRecord {
  id: string;
  name: string;
  facilityType: "Warehouse" | "Cold Storage";
  state: string;
  district: string;
  address: string;
  capacityMt: number | null;
  registrationId: string;
  operatorType: string;
}

function readFirstString(
  raw: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const direct = raw[key];
    if (typeof direct === "string" && direct.trim()) {
      return direct.trim();
    }
    if (typeof direct === "number" && Number.isFinite(direct)) {
      return String(direct);
    }
  }
  const lowerEntries = Object.entries(raw).map(([k, v]) => [
    k.toLowerCase(),
    v,
  ] as const);
  for (const key of keys) {
    const target = key.toLowerCase();
    for (const [k, v] of lowerEntries) {
      if (k === target || k.includes(target)) {
        if (typeof v === "string" && v.trim()) return v.trim();
        if (typeof v === "number" && Number.isFinite(v)) return String(v);
      }
    }
  }
  return "";
}

function parseCapacityMt(raw: Record<string, unknown>): number | null {
  const str = readFirstString(raw, [
    "capacity_mt",
    "capacity_in_mt",
    "storage_capacity",
    "capacity",
    "total_capacity",
    "cap_mt",
  ]);
  if (!str) return null;
  const cleaned = str.replace(/,/g, "").match(/[\d.]+/);
  if (!cleaned) return null;
  const num = Number(cleaned[0]);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
}

export function normalizeOgdWarehouseRecords(
  records: unknown[]
): GovWarehouseRecord[] {
  if (!Array.isArray(records)) return [];

  const normalized: GovWarehouseRecord[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const item = records[i];
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;

    const name = readFirstString(raw, [
      "warehouse_name",
      "name_of_warehouse",
      "cold_storage_name",
      "name_of_cold_storage",
      "facility_name",
      "godown_name",
      "name",
      "agency_name",
    ]);
    const state = readFirstString(raw, [
      "state",
      "state_name",
      "state_ut",
      "name_of_state",
    ]);
    const district = readFirstString(raw, [
      "district",
      "district_name",
      "city",
      "location",
    ]);
    const address = readFirstString(raw, [
      "address",
      "full_address",
      "village_town",
      "location",
    ]);
    const registrationId = readFirstString(raw, [
      "wdra_reg_no",
      "registration_no",
      "reg_no",
      "license_no",
    ]);
    const operatorType = readFirstString(raw, [
      "sector",
      "ownership",
      "warehouse_type",
      "category",
      "agency",
    ]);

    if (!name && !state && !district) continue;

    const combinedText = `${name} ${operatorType} ${address}`.toLowerCase();
    const facilityType: "Warehouse" | "Cold Storage" =
      combinedText.includes("cold") || combinedText.includes("chiller")
        ? "Cold Storage"
        : "Warehouse";

    normalized.push({
      id: registrationId || `gov-wh-${i + 1}`,
      name: name || `${district || state || "Regional"} Storage Unit`,
      facilityType,
      state: state || "India",
      district: district || "",
      address: address || [district, state].filter(Boolean).join(", "),
      capacityMt: parseCapacityMt(raw),
      registrationId,
      operatorType: operatorType || "Registered Storage Facility",
    });
  }

  return normalized;
}

export function filterGovWarehouseRecords(
  records: GovWarehouseRecord[],
  stateFilter: string,
  searchQuery: string
): GovWarehouseRecord[] {
  const cleanState = stateFilter.trim().toLowerCase();
  const cleanSearch = searchQuery.trim().toLowerCase();

  return records.filter((rec) => {
    const stateMatch =
      !cleanState ||
      cleanState === "all india" ||
      rec.state.toLowerCase().includes(cleanState);
    if (!stateMatch) return false;
    if (!cleanSearch) return true;
    return `${rec.name} ${rec.district} ${rec.state} ${rec.address} ${rec.facilityType} ${rec.operatorType}`
      .toLowerCase()
      .includes(cleanSearch);
  });
}
