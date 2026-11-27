export type GovFacilityType = "Cold Storage" | "Warehouse / Godown";

export interface GovWarehouseRecord {
  id: string;
  name: string;
  facilityType: GovFacilityType;
  state: string;
  district: string;
  address: string;
  capacityMt: number | null;
  latitude: number | null;
  longitude: number | null;
  agency: string;
  registrationId?: string;
  isLiveOgd: boolean;
}

export function isValidOgdResourceId(resourceId: unknown): resourceId is string {
  return (
    typeof resourceId === "string" &&
    /^[a-zA-Z0-9-]{8,80}$/.test(resourceId.trim())
  );
}

function pickFirstString(
  row: Record<string, unknown>,
  keys: string[]
): string {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === "string" && val.trim()) {
      return val.trim().slice(0, 180);
    }
    if (typeof val === "number" && Number.isFinite(val)) {
      return String(val);
    }
  }
  return "";
}

function pickFirstNumber(
  row: Record<string, unknown>,
  keys: string[]
): number | null {
  for (const key of keys) {
    const val = row[key];
    if (typeof val === "number" && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === "string" && val.trim()) {
      const cleaned = val.replace(/,/g, "").trim();
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function normalizeOgdWarehouseRecords(
  rawRecords: unknown[],
  fallbackAgency = "data.gov.in Official Registry"
): GovWarehouseRecord[] {
  const results: GovWarehouseRecord[] = [];
  for (let i = 0; i < rawRecords.length; i++) {
    const item = rawRecords[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;

    const state = pickFirstString(row, [
      "state",
      "state_name",
      "statename",
      "State",
      "State_Name",
      "state_ut",
    ]);
    const district = pickFirstString(row, [
      "district",
      "district_name",
      "distname",
      "District",
      "District_Name",
      "city",
    ]);
    const rawName = pickFirstString(row, [
      "warehouse_name",
      "name_of_warehouse",
      "cold_storage_name",
      "name_of_cold_storage",
      "godown_name",
      "facility_name",
      "center_name",
      "centre_name",
      "unit_name",
      "name",
    ]);

    const name =
      rawName ||
      (district && state
        ? `Government Storage Facility — ${district}, ${state}`
        : state
        ? `Official Storage Hub — ${state}`
        : "");

    if (!name || (!state && !district)) continue;

    const rawType = pickFirstString(row, [
      "facility_type",
      "type",
      "category",
      "sector",
      "storage_type",
    ]).toLowerCase();
    const isCold =
      rawType.includes("cold") ||
      name.toLowerCase().includes("cold") ||
      rawType.includes("horticulture") ||
      rawType.includes("chiller");

    const capacityMt = pickFirstNumber(row, [
      "capacity_mt",
      "capacity_in_mt",
      "storage_capacity",
      "total_capacity",
      "capacity",
      "sanctioned_capacity",
    ]);
    const latitude = pickFirstNumber(row, ["latitude", "lat"]);
    const longitude = pickFirstNumber(row, ["longitude", "lon", "lng"]);

    const address =
      pickFirstString(row, ["address", "location", "village_town", "place"]) ||
      [district, state].filter(Boolean).join(", ");
    const agency =
      pickFirstString(row, ["agency", "authority", "organisation", "owner"]) ||
      fallbackAgency;
    const registrationId =
      pickFirstString(row, [
        "registration_no",
        "wdra_reg_no",
        "reg_no",
        "id",
      ]) || undefined;

    results.push({
      id: `ogd-${i + 1}-${(registrationId || district || state || "hub")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 32)}`,
      name,
      facilityType: isCold ? "Cold Storage" : "Warehouse / Godown",
      state: state || "India",
      district: district || state || "Regional",
      address,
      capacityMt: capacityMt !== null && capacityMt >= 0 ? capacityMt : null,
      latitude:
        latitude !== null && latitude >= -90 && latitude <= 90
          ? latitude
          : null,
      longitude:
        longitude !== null && longitude >= -180 && longitude <= 180
          ? longitude
          : null,
      agency,
      registrationId,
      isLiveOgd: true,
    });
  }
  return results;
}

export const OFFICIAL_GOV_COLD_STORAGE_CATALOG: GovWarehouseRecord[] = [
  {
    id: "gov-pb-ludhiana-cwc",
    name: "CWC Central Warehouse — Ludhiana (Gill Road)",
    facilityType: "Warehouse / Godown",
    state: "Punjab",
    district: "Ludhiana",
    address: "Gill Road Grain Market Complex, Ludhiana, Punjab 141003",
    capacityMt: 24500,
    latitude: 30.8842,
    longitude: 75.8573,
    agency: "Central Warehousing Corporation (CWC) · WDRA",
    registrationId: "WDRA-PB-0118",
    isLiveOgd: false,
  },
  {
    id: "gov-pb-jalandhar-nhb",
    name: "PSWC & NHB Potato Cold Storage — Jalandhar",
    facilityType: "Cold Storage",
    state: "Punjab",
    district: "Jalandhar",
    address: "Hoshiarpur Road Agri Cluster, Jalandhar, Punjab 144004",
    capacityMt: 12000,
    latitude: 31.326,
    longitude: 75.5762,
    agency: "National Horticulture Board (NHB) · PSWC",
    registrationId: "NHB-PB-4092",
    isLiveOgd: false,
  },
  {
    id: "gov-pb-amritsar-cold",
    name: "Markfed Controlled Atmosphere Cold Store — Amritsar",
    facilityType: "Cold Storage",
    state: "Punjab",
    district: "Amritsar",
    address: "Verka Industrial & Mandi Belt, Amritsar, Punjab 143501",
    capacityMt: 9500,
    latitude: 31.653,
    longitude: 74.933,
    agency: "Punjab Markfed · NHB Cold Chain",
    registrationId: "NHB-PB-2241",
    isLiveOgd: false,
  },
  {
    id: "gov-pb-patiala-wdra",
    name: "Punjab State Warehousing Corp (PSWC) — Patiala",
    facilityType: "Warehouse / Godown",
    state: "Punjab",
    district: "Patiala",
    address: "Sanaur Road Grain Complex, Patiala, Punjab 147001",
    capacityMt: 31000,
    latitude: 30.3398,
    longitude: 76.3869,
    agency: "PSWC · WDRA Accredited",
    registrationId: "WDRA-PB-0205",
    isLiveOgd: false,
  },
  {
    id: "gov-pb-bathinda-wdra",
    name: "Malwa Cotton & Wheat Scientific Godown — Bathinda",
    facilityType: "Warehouse / Godown",
    state: "Punjab",
    district: "Bathinda",
    address: "Dabwali Road Mandi Hub, Bathinda, Punjab 151001",
    capacityMt: 18400,
    latitude: 30.211,
    longitude: 74.9455,
    agency: "PSWC · WDRA Accredited",
    registrationId: "WDRA-PB-0314",
    isLiveOgd: false,
  },
  {
    id: "gov-pb-moga-cold",
    name: "Doaba Multi-Chamber Cold Storage — Moga",
    facilityType: "Cold Storage",
    state: "Punjab",
    district: "Moga",
    address: "Ferozepur GT Road, Moga, Punjab 142001",
    capacityMt: 8200,
    latitude: 30.8165,
    longitude: 75.1717,
    agency: "National Horticulture Board (NHB)",
    registrationId: "NHB-PB-3180",
    isLiveOgd: false,
  },
  {
    id: "gov-hr-karnal-cwc",
    name: "HSWC & CWC Rice Silo Complex — Karnal",
    facilityType: "Warehouse / Godown",
    state: "Haryana",
    district: "Karnal",
    address: "NH-44 New Anaj Mandi, Karnal, Haryana 132001",
    capacityMt: 28000,
    latitude: 29.6857,
    longitude: 76.9905,
    agency: "Haryana Warehousing Corp · WDRA",
    registrationId: "WDRA-HR-0092",
    isLiveOgd: false,
  },
  {
    id: "gov-hr-hisar-cold",
    name: "Hisar Integrated Horticulture Cold Store",
    facilityType: "Cold Storage",
    state: "Haryana",
    district: "Hisar",
    address: "Sirsa Road Agro Park, Hisar, Haryana 125001",
    capacityMt: 7400,
    latitude: 29.1492,
    longitude: 75.7217,
    agency: "NHB Cold Chain Mission",
    registrationId: "NHB-HR-1844",
    isLiveOgd: false,
  },
  {
    id: "gov-mh-nashik-cold",
    name: "LASALGAON NAFED Onion Cold & Ventilated Store — Nashik",
    facilityType: "Cold Storage",
    state: "Maharashtra",
    district: "Nashik",
    address: "Lasalgaon APMC Market Yard, Nashik, Maharashtra 422306",
    capacityMt: 16500,
    latitude: 20.1456,
    longitude: 74.2286,
    agency: "NAFED · NHB Cold Chain",
    registrationId: "NHB-MH-5012",
    isLiveOgd: false,
  },
  {
    id: "gov-mh-nagpur-wdra",
    name: "MSWC Kalamna Cotton & Pulses Godown — Nagpur",
    facilityType: "Warehouse / Godown",
    state: "Maharashtra",
    district: "Nagpur",
    address: "Kalamna Market Yard, Kamptee Road, Nagpur, Maharashtra 440035",
    capacityMt: 22000,
    latitude: 21.1745,
    longitude: 79.1391,
    agency: "MSWC · WDRA Accredited",
    registrationId: "WDRA-MH-0421",
    isLiveOgd: false,
  },
  {
    id: "gov-mp-indore-wdra",
    name: "MPWLC Dewas Naka Grain & Soy Godown — Indore",
    facilityType: "Warehouse / Godown",
    state: "Madhya Pradesh",
    district: "Indore",
    address: "Laxmibai Nagar Mandi Complex, Indore, Madhya Pradesh 452006",
    capacityMt: 35000,
    latitude: 22.7483,
    longitude: 75.8754,
    agency: "MP Warehousing & Logistics Corp · WDRA",
    registrationId: "WDRA-MP-0190",
    isLiveOgd: false,
  },
  {
    id: "gov-up-barabanki-cold",
    name: "UP Horticulture Potato Cold Chain Hub — Barabanki",
    facilityType: "Cold Storage",
    state: "Uttar Pradesh",
    district: "Barabanki",
    address: "Deva Road Agri Corridor, Barabanki, Uttar Pradesh 225001",
    capacityMt: 11800,
    latitude: 26.9422,
    longitude: 81.1869,
    agency: "NHB · UP State Horticulture Dept",
    registrationId: "NHB-UP-6320",
    isLiveOgd: false,
  },
  {
    id: "gov-gj-rajkot-wdra",
    name: "GSWC Saurashtra Groundnut & Cotton Depot — Rajkot",
    facilityType: "Warehouse / Godown",
    state: "Gujarat",
    district: "Rajkot",
    address: "Bedi Marketing Yard Road, Rajkot, Gujarat 360003",
    capacityMt: 19600,
    latitude: 22.3039,
    longitude: 70.8022,
    agency: "GSWC · WDRA Accredited",
    registrationId: "WDRA-GJ-0277",
    isLiveOgd: false,
  },
  {
    id: "gov-rj-kota-wdra",
    name: "RSWC Hadoti Mustard & Wheat Warehouse — Kota",
    facilityType: "Warehouse / Godown",
    state: "Rajasthan",
    district: "Kota",
    address: "Bhamashah Mandi Industrial Area, Kota, Rajasthan 324005",
    capacityMt: 21500,
    latitude: 25.1342,
    longitude: 75.8576,
    agency: "RSWC · WDRA Accredited",
    registrationId: "WDRA-RJ-0148",
    isLiveOgd: false,
  },
  {
    id: "gov-ka-tumakuru-cold",
    name: "KSWC Cold Chain & Spice Storage — Tumakuru",
    facilityType: "Cold Storage",
    state: "Karnataka",
    district: "Tumakuru",
    address: "Batawadi APMC Yard, Tumakuru, Karnataka 572103",
    capacityMt: 9200,
    latitude: 13.3392,
    longitude: 77.114,
    agency: "Karnataka State Warehousing · NHB",
    registrationId: "NHB-KA-3049",
    isLiveOgd: false,
  },
];

export function filterGovWarehouses(params: {
  records: GovWarehouseRecord[];
  stateFilter: string;
  facilityTypeFilter: "all" | "cold_storage" | "warehouse";
  searchQuery: string;
}): GovWarehouseRecord[] {
  const cleanState = params.stateFilter.trim().toLowerCase();
  const q = params.searchQuery.trim().toLowerCase();

  return params.records.filter((rec) => {
    if (
      cleanState &&
      cleanState !== "all india" &&
      !rec.state.toLowerCase().includes(cleanState) &&
      !rec.district.toLowerCase().includes(cleanState)
    ) {
      return false;
    }

    if (
      params.facilityTypeFilter === "cold_storage" &&
      rec.facilityType !== "Cold Storage"
    ) {
      return false;
    }
    if (
      params.facilityTypeFilter === "warehouse" &&
      rec.facilityType !== "Warehouse / Godown"
    ) {
      return false;
    }

    if (!q) return true;
    return (
      rec.name.toLowerCase().includes(q) ||
      rec.district.toLowerCase().includes(q) ||
      rec.state.toLowerCase().includes(q) ||
      rec.address.toLowerCase().includes(q) ||
      rec.agency.toLowerCase().includes(q) ||
      rec.facilityType.toLowerCase().includes(q)
    );
  });
}
