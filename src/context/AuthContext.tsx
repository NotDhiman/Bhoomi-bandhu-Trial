import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  deleteApp,
  initializeApp,
} from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from "../firebase";
import {
  SEEDED_DEMO_BOOKINGS,
  SEEDED_DEMO_CONSULTATIONS,
  SEEDED_DEMO_TICKETS,
  SEEDED_PARTNER_COMPANIES,
  SEEDED_PSYCHIATRISTS,
  SEEDED_WAREHOUSES,
  type PartnerCompanyItem,
  type PsychiatristProfileItem,
  type SchemeItem,
  type WarehouseItem,
} from "../data/bhoomiData";
import {
  ADMIN_BOOTSTRAP_EMAIL,
  DEMO_ACCOUNTS,
  isValidRole,
  matchDemoCredential,
  type DemoAccountCredential,
  type UserRole,
} from "../utils/roles";
import {
  buildNoReplyAccessEmail,
  validateEmployeeProvisionInput,
  validateFirstLoginPasswordChange,
} from "../utils/employeeAccess";

export type { UserRole } from "../utils/roles";

export interface AuthUserSummary {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  isDemoSession?: boolean;
}

export interface UserProfileData {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  state: string;
  district: string;
  landSizeAcres: number;
  primaryCrops: string[];
  specialization?: string;
  qualification?: string;
  department?: string;
  availableForConsult?: boolean;
  notificationsEnabled: boolean;
  mustChangePassword?: boolean;
}

export interface SupportEmployeeRecord {
  id: string;
  uid: string;
  name: string;
  email: string;
  department: string;
  status: "pending_first_login" | "active";
  mustChangePassword: boolean;
  emailDeliveryStatus: "sent" | "outbox_generated";
  lastEmailSubject?: string;
  createdBy: string;
  createdAtLabel: string;
}

export interface AutomatedMailRecord {
  id: string;
  fromAddress: string;
  replyTo: string;
  toEmail: string;
  employeeName: string;
  subject: string;
  bodyPreview: string;
  deliveryMode: "smtp" | "outbox_generated";
  sentAtLabel: string;
}

export interface SavedSchemeRecord {
  id: string;
  userId: string;
  schemeId: string;
  schemeName: string;
  category: string;
}

export interface BookingRecord {
  id: string;
  farmerId: string;
  farmerName: string;
  warehouseId: string;
  warehouseOwnerId: string;
  warehouseName: string;
  cropType: string;
  quantity: number;
  unit: "kg" | "quintal" | "ton";
  startDate: string;
  durationMonths: number;
  estimatedCostInr: number;
  notes?: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
}

export interface NotificationRecord {
  id: string;
  userId: string;
  category: "scheme" | "warehouse" | "system";
  title: string;
  description: string;
  read: boolean;
}

export interface SupportTicketRecord {
  id: string;
  userId: string;
  category: "support" | "wellbeing";
  subject: string;
  message: string;
  priority?: "normal" | "urgent";
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  employeeReply?: string;
  status: "open" | "in_review" | "resolved";
}

export interface ConsultationRecord {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerState?: string;
  psychiatristId: string;
  psychiatristName: string;
  preferredSlot: string;
  language: string;
  concernTopic: string;
  notes: string;
  doctorResponse?: string;
  status: "requested" | "scheduled" | "completed" | "cancelled";
}

interface AuthContextValue {
  user: AuthUserSummary | null;
  profile: UserProfileData | null;
  authReady: boolean;
  isAdmin: boolean;
  isDemoMode: boolean;
  savedSchemes: SavedSchemeRecord[];
  bookings: BookingRecord[];
  ownerIncomingBookings: BookingRecord[];
  warehouses: WarehouseItem[];
  partnerCompanies: PartnerCompanyItem[];
  psychiatrists: PsychiatristProfileItem[];
  consultations: ConsultationRecord[];
  psychiatristRequests: ConsultationRecord[];
  notifications: NotificationRecord[];
  supportTickets: SupportTicketRecord[];
  allSupportTickets: SupportTicketRecord[];
  allUsers: UserProfileData[];
  allBookings: BookingRecord[];
  allConsultations: ConsultationRecord[];
  supportEmployees: SupportEmployeeRecord[];
  mailOutbox: AutomatedMailRecord[];
  signInWithGoogle: (preferredRole?: UserRole) => Promise<void>;
  signUpWithEmail: (params: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    specialization?: string;
    qualification?: string;
    department?: string;
  }) => Promise<void>;
  logInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfileData>) => Promise<void>;
  toggleSaveScheme: (scheme: SchemeItem) => Promise<boolean>;
  isSchemeSaved: (schemeId: string) => boolean;
  createWarehouseBooking: (payload: {
    warehouse: WarehouseItem;
    cropType: string;
    quantity: number;
    unit: "kg" | "quintal" | "ton";
    startDate: string;
    durationMonths: number;
    estimatedCostInr: number;
    notes: string;
  }) => Promise<void>;
  updateBookingStatus: (
    bookingId: string,
    status: "approved" | "rejected" | "cancelled"
  ) => Promise<void>;
  createWarehouseListing: (payload: {
    name: string;
    cityState: string;
    totalCapacityMt: number;
    availableCapacityMt: number;
    pricePerQuintalMonth: number;
    facilities: string[];
    description: string;
  }) => Promise<void>;
  submitSupportTicket: (payload: {
    category: "support" | "wellbeing";
    subject: string;
    message: string;
    priority?: "normal" | "urgent";
  }) => Promise<void>;
  updateSupportTicket: (payload: {
    ticketId: string;
    status: "open" | "in_review" | "resolved";
    employeeReply?: string;
    priority?: "normal" | "urgent";
    claimTicket?: boolean;
  }) => Promise<void>;
  bookPsychiatristSession: (payload: {
    psychiatrist: PsychiatristProfileItem;
    preferredSlot: string;
    language: string;
    concernTopic: string;
    notes: string;
  }) => Promise<void>;
  updateConsultationStatus: (payload: {
    consultationId: string;
    status: "scheduled" | "completed" | "cancelled";
    doctorResponse?: string;
  }) => Promise<void>;
  togglePsychiatristAvailability: (available: boolean) => Promise<void>;
  addPartnerCompany: (payload: {
    name: string;
    category: "loan" | "insurance";
    interestOrPremium: string;
    coverageOrLimit: string;
    eligibilitySummary: string;
    contactHelpline: string;
    websiteUrl?: string;
  }) => Promise<void>;
  togglePartnerCompanyStatus: (
    companyId: string,
    nextStatus: "active" | "paused"
  ) => Promise<void>;
  deletePartnerCompany: (companyId: string) => Promise<void>;
  adminUpdateUserRole: (uid: string, nextRole: UserRole) => Promise<void>;
  markNotificationRead: (notifId: string) => Promise<void>;
  provisionSupportEmployee: (payload: {
    name: string;
    email: string;
    department?: string;
    tempPassword: string;
  }) => Promise<{
    employee: SupportEmployeeRecord;
    emailRecord: AutomatedMailRecord;
  }>;
  completeFirstLoginPasswordChange: (payload: {
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function sanitizeStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function buildInitialDemoUsers(): UserProfileData[] {
  const fromAccounts: UserProfileData[] = DEMO_ACCOUNTS.filter(
    (acc) => !acc.isAdminDemo
  ).map((acc) => ({
    uid: acc.id,
    name: acc.name,
    email: acc.email,
    role: acc.role,
    phone: acc.phone,
    state: acc.state,
    district: acc.district,
    landSizeAcres: acc.landSizeAcres,
    primaryCrops: acc.primaryCrops,
    specialization: acc.specialization,
    qualification: acc.qualification,
    department: acc.department,
    availableForConsult: acc.role === "psychiatrist" ? true : undefined,
    notificationsEnabled: true,
  }));

  return [
    ...fromAccounts,
    {
      uid: "farmer-ramesh-mp",
      name: "Rameshwar Patidar",
      email: "rameshwar.patidar@example.in",
      role: "farmer",
      phone: "+91 98261 22410",
      state: "Madhya Pradesh",
      district: "Indore",
      landSizeAcres: 5.5,
      primaryCrops: ["Soybean", "Wheat"],
      notificationsEnabled: true,
    },
    {
      uid: "farmer-lakshmi-tn",
      name: "Lakshmi Narayanan",
      email: "lakshmi.fpo@example.in",
      role: "farmer",
      phone: "+91 94430 88211",
      state: "Tamil Nadu",
      district: "Thanjavur",
      landSizeAcres: 3.0,
      primaryCrops: ["Paddy", "Groundnut"],
      notificationsEnabled: true,
    },
    {
      uid: "psych-harjinder",
      name: "Dr. Harjinder Singh Brar",
      email: "dr.harjinder@bhoomibandhu.in",
      role: "psychiatrist",
      phone: "+91 98155 60122",
      state: "Punjab",
      district: "Chandigarh",
      landSizeAcres: 0,
      primaryCrops: [],
      specialization: "Harvest Burnout, Sleep Recovery & Stress Resilience",
      qualification: "MD Psychiatry, PGIMER Chandigarh",
      availableForConsult: true,
      notificationsEnabled: true,
    },
  ];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [demoAccount, setDemoAccount] = useState<DemoAccountCredential | null>(
    null
  );
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseAdmin, setFirebaseAdmin] = useState(false);
  const pendingGoogleRoleRef = useRef<UserRole>("farmer");

  // Live Firestore collections
  const [savedSchemes, setSavedSchemes] = useState<SavedSchemeRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [ownerIncomingBookings, setOwnerIncomingBookings] = useState<
    BookingRecord[]
  >([]);
  const [firestoreWarehouses, setFirestoreWarehouses] = useState<
    WarehouseItem[]
  >([]);
  const [firestoreCompanies, setFirestoreCompanies] = useState<
    PartnerCompanyItem[]
  >([]);
  const [firestorePsychiatrists, setFirestorePsychiatrists] = useState<
    PsychiatristProfileItem[]
  >([]);
  const [farmerConsultations, setFarmerConsultations] = useState<
    ConsultationRecord[]
  >([]);
  const [psychiatristRequests, setPsychiatristRequests] = useState<
    ConsultationRecord[]
  >([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicketRecord[]>(
    []
  );
  const [staffTickets, setStaffTickets] = useState<SupportTicketRecord[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfileData[]>([]);
  const [adminBookings, setAdminBookings] = useState<BookingRecord[]>([]);
  const [adminConsultations, setAdminConsultations] = useState<
    ConsultationRecord[]
  >([]);
  const [adminSupportEmployees, setAdminSupportEmployees] = useState<
    SupportEmployeeRecord[]
  >([]);
  const [adminMailOutbox, setAdminMailOutbox] = useState<AutomatedMailRecord[]>(
    []
  );

  // Interactive Sandbox State (persists across role switches in the same browser session)
  const [demoUsers, setDemoUsers] = useState<UserProfileData[]>(() =>
    buildInitialDemoUsers()
  );
  const [demoProvisionedAccounts, setDemoProvisionedAccounts] = useState<
    DemoAccountCredential[]
  >([]);
  const [demoSupportEmployees, setDemoSupportEmployees] = useState<
    SupportEmployeeRecord[]
  >(() => {
    const vikram = DEMO_ACCOUNTS.find((a) => a.id === "demo-support-1");
    return vikram
      ? [
          {
            id: vikram.id,
            uid: vikram.id,
            name: vikram.name,
            email: vikram.email,
            department: vikram.department || "Farmer Help & Operations Desk",
            status: "active",
            mustChangePassword: false,
            emailDeliveryStatus: "sent",
            lastEmailSubject:
              "Access Granted — BhoomiBandhu Support Desk (Active)",
            createdBy: "admin-bootstrap",
            createdAtLabel: "Active Employee",
          },
        ]
      : [];
  });
  const [demoMailOutbox, setDemoMailOutbox] = useState<AutomatedMailRecord[]>(
    []
  );
  const [demoCompanies, setDemoCompanies] = useState<PartnerCompanyItem[]>(
    () => SEEDED_PARTNER_COMPANIES
  );
  const [demoPsychiatrists, setDemoPsychiatrists] = useState<
    PsychiatristProfileItem[]
  >(() => SEEDED_PSYCHIATRISTS);
  const [demoConsultations, setDemoConsultations] = useState<
    ConsultationRecord[]
  >(() => SEEDED_DEMO_CONSULTATIONS);
  const [demoTickets, setDemoTickets] = useState<SupportTicketRecord[]>(
    () => SEEDED_DEMO_TICKETS
  );
  const [demoBookings, setDemoBookings] = useState<BookingRecord[]>(
    () => SEEDED_DEMO_BOOKINGS
  );
  const [demoWarehouses, setDemoWarehouses] = useState<WarehouseItem[]>([]);
  const [demoSavedSchemes, setDemoSavedSchemes] = useState<SavedSchemeRecord[]>(
    [
      {
        id: "saved-demo-1",
        userId: "demo-farmer-1",
        schemeId: "pm-kisan",
        schemeName: "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
        category: "Income Support",
      },
    ]
  );
  const [demoNotifications, setDemoNotifications] = useState<
    NotificationRecord[]
  >([
    {
      id: "notif-demo-1",
      userId: "demo-farmer-1",
      category: "system",
      title: "Welcome to BhoomiBandhu",
      description:
        "Explore government schemes, live crop weather advice, and confidential psychiatrist consultations.",
      read: false,
    },
  ]);

  const isDemoMode = demoAccount !== null && !firebaseUser;
  const isAdmin = isDemoMode ? Boolean(demoAccount?.isAdminDemo) : firebaseAdmin;

  const user: AuthUserSummary | null = useMemo(() => {
    if (firebaseUser) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || "",
        displayName: firebaseUser.displayName || "",
        emailVerified: firebaseUser.emailVerified,
        isDemoSession: false,
      };
    }
    if (demoAccount) {
      return {
        uid: demoAccount.id,
        email: demoAccount.email,
        displayName: demoAccount.name,
        emailVerified: true,
        isDemoSession: true,
      };
    }
    return null;
  }, [firebaseUser, demoAccount]);

  // Public non-PII listeners (warehouses, partner companies, psychiatrists)
  useEffect(() => {
    const unsubWh = onSnapshot(
      collection(db, "warehouses"),
      (snapshot) => {
        const loaded: WarehouseItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: String(data.ownerId || ""),
            name: String(data.name || ""),
            cityState: String(data.cityState || ""),
            distanceKm: Number(data.distanceKm ?? 5.5),
            totalCapacityMt: Number(data.totalCapacityMt ?? 500),
            availableCapacityMt: Number(data.availableCapacityMt ?? 200),
            pricePerQuintalMonth: Number(data.pricePerQuintalMonth ?? 20),
            rating: 4.7,
            facilities: Array.isArray(data.facilities)
              ? data.facilities.map(String)
              : ["Dry Grain Storage"],
            description: String(data.description || ""),
            status: data.status === "paused" ? "paused" : "active",
            mapX: 52,
            mapY: 42,
            isCatalog: false,
          };
        });
        setFirestoreWarehouses(loaded);
      },
      (err) => {
        console.warn("Warehouses listener notice:", err.message);
      }
    );

    const unsubCompanies = onSnapshot(
      collection(db, "partner_companies"),
      (snapshot) => {
        const loaded: PartnerCompanyItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || ""),
            category: data.category === "insurance" ? "insurance" : "loan",
            interestOrPremium: String(data.interestOrPremium || ""),
            coverageOrLimit: String(data.coverageOrLimit || ""),
            eligibilitySummary: String(data.eligibilitySummary || ""),
            contactHelpline: String(data.contactHelpline || ""),
            websiteUrl: data.websiteUrl ? String(data.websiteUrl) : undefined,
            status: data.status === "paused" ? "paused" : "active",
            createdBy: String(data.createdBy || ""),
          };
        });
        setFirestoreCompanies(loaded);
      },
      (err) => {
        console.warn("Partner companies listener notice:", err.message);
      }
    );

    const unsubPsych = onSnapshot(
      collection(db, "psychiatrists"),
      (snapshot) => {
        const loaded: PsychiatristProfileItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || d.id),
            name: String(data.name || ""),
            qualification: String(data.qualification || "MD Psychiatry"),
            specialization: String(
              data.specialization || "Farmer Mental Health & Stress Support"
            ),
            languages: Array.isArray(data.languages)
              ? data.languages.map(String)
              : ["Hindi", "English"],
            experienceYears: Number(data.experienceYears ?? 5),
            state: String(data.state || "India"),
            bio: String(data.bio || ""),
            availableForConsult: data.availableForConsult !== false,
          };
        });
        setFirestorePsychiatrists(loaded);
      },
      (err) => {
        console.warn("Psychiatrists listener notice:", err.message);
      }
    );

    return () => {
      unsubWh();
      unsubCompanies();
      unsubPsych();
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) {
        setFirebaseAdmin(false);
        setSavedSchemes([]);
        setBookings([]);
        setOwnerIncomingBookings([]);
        setFarmerConsultations([]);
        setPsychiatristRequests([]);
        setNotifications([]);
        setSupportTickets([]);
        setStaffTickets([]);
        setAdminUsers([]);
        setAdminBookings([]);
        setAdminConsultations([]);
        setAdminSupportEmployees([]);
        setAdminMailOutbox([]);
        setAuthReady(true);
        return;
      }

      // Firebase login supersedes demo session
      setDemoAccount(null);

      const isBootstrapAdmin =
        fbUser.emailVerified && fbUser.email === ADMIN_BOOTSTRAP_EMAIL;
      let adminDocExists = false;
      try {
        const adminSnap = await getDoc(doc(db, "admins", fbUser.uid));
        adminDocExists = adminSnap.exists();
      } catch {
        adminDocExists = false;
      }
      setFirebaseAdmin(isBootstrapAdmin || adminDocExists);

      try {
        const userRef = doc(db, "users", fbUser.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const fallbackName =
            fbUser.displayName?.trim() ||
            fbUser.email?.split("@")[0] ||
            "Kisan Friend";
          const chosenRole = pendingGoogleRoleRef.current;
          const safeRole: UserRole =
            chosenRole === "warehouse_owner" || chosenRole === "psychiatrist"
              ? chosenRole
              : "farmer";
          await setDoc(userRef, {
            uid: fbUser.uid,
            name: sanitizeStr(fallbackName, 100),
            email: sanitizeStr(fbUser.email || "user@bhoomibandhu.in", 160),
            role: safeRole,
            phone: "",
            state: "Punjab",
            district: "",
            landSizeAcres: safeRole === "farmer" ? 2.5 : 0,
            primaryCrops: safeRole === "farmer" ? ["Wheat", "Paddy"] : [],
            ...(safeRole === "psychiatrist"
              ? { availableForConsult: true }
              : {}),
            notificationsEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        console.warn("Profile init notice:", err);
      }

      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  const effectiveProfile: UserProfileData | null = useMemo(() => {
    if (isDemoMode && demoAccount) {
      if (demoAccount.isAdminDemo) {
        return {
          uid: demoAccount.id,
          name: demoAccount.name,
          email: demoAccount.email,
          role: "farmer",
          phone: demoAccount.phone,
          state: demoAccount.state,
          district: demoAccount.district,
          landSizeAcres: 0,
          primaryCrops: [],
          department: demoAccount.department,
          notificationsEnabled: true,
        };
      }
      const found = demoUsers.find((u) => u.uid === demoAccount.id);
      if (found) return found;
    }
    return profile;
  }, [isDemoMode, demoAccount, demoUsers, profile]);

  // User-scoped Firestore listeners (strictly when signed into Firebase)
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const unsubProfile = onSnapshot(
      doc(db, "users", firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const roleVal: UserRole = isValidRole(d.role) ? d.role : "farmer";
          setProfile({
            uid: String(d.uid || firebaseUser.uid),
            name: String(d.name || firebaseUser.displayName || "Farmer"),
            email: String(d.email || firebaseUser.email || ""),
            role: roleVal,
            phone: String(d.phone || ""),
            state: String(d.state || "Punjab"),
            district: String(d.district || ""),
            landSizeAcres: Number(d.landSizeAcres ?? 2.5),
            primaryCrops: Array.isArray(d.primaryCrops)
              ? d.primaryCrops.map(String)
              : [],
            specialization: d.specialization
              ? String(d.specialization)
              : undefined,
            qualification: d.qualification
              ? String(d.qualification)
              : undefined,
            department: d.department ? String(d.department) : undefined,
            availableForConsult:
              typeof d.availableForConsult === "boolean"
                ? d.availableForConsult
                : undefined,
            notificationsEnabled: d.notificationsEnabled !== false,
            mustChangePassword: Boolean(d.mustChangePassword),
          });
        }
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.GET,
          `users/${firebaseUser.uid}`
        )
    );

    const unsubSaved = onSnapshot(
      query(
        collection(db, "saved_schemes"),
        where("userId", "==", firebaseUser.uid)
      ),
      (snap) => {
        setSavedSchemes(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: String(data.userId),
              schemeId: String(data.schemeId),
              schemeName: String(data.schemeName),
              category: String(data.category),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "saved_schemes")
    );

    const unsubBookings = onSnapshot(
      query(
        collection(db, "bookings"),
        where("farmerId", "==", firebaseUser.uid)
      ),
      (snap) => {
        setBookings(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              farmerId: String(data.farmerId),
              farmerName: String(data.farmerName),
              warehouseId: String(data.warehouseId),
              warehouseOwnerId: String(data.warehouseOwnerId),
              warehouseName: String(data.warehouseName),
              cropType: String(data.cropType),
              quantity: Number(data.quantity),
              unit: data.unit,
              startDate: String(data.startDate),
              durationMonths: Number(data.durationMonths),
              estimatedCostInr: Number(data.estimatedCostInr),
              notes: data.notes ? String(data.notes) : undefined,
              status: data.status,
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "bookings")
    );

    const unsubOwnerBookings = onSnapshot(
      query(
        collection(db, "bookings"),
        where("warehouseOwnerId", "==", firebaseUser.uid)
      ),
      (snap) => {
        setOwnerIncomingBookings(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              farmerId: String(data.farmerId),
              farmerName: String(data.farmerName),
              warehouseId: String(data.warehouseId),
              warehouseOwnerId: String(data.warehouseOwnerId),
              warehouseName: String(data.warehouseName),
              cropType: String(data.cropType),
              quantity: Number(data.quantity),
              unit: data.unit,
              startDate: String(data.startDate),
              durationMonths: Number(data.durationMonths),
              estimatedCostInr: Number(data.estimatedCostInr),
              notes: data.notes ? String(data.notes) : undefined,
              status: data.status,
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "bookings")
    );

    const unsubConsultations = onSnapshot(
      query(
        collection(db, "psychiatrist_consultations"),
        where("farmerId", "==", firebaseUser.uid)
      ),
      (snap) => {
        setFarmerConsultations(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              farmerId: String(data.farmerId),
              farmerName: String(data.farmerName),
              farmerState: data.farmerState
                ? String(data.farmerState)
                : undefined,
              psychiatristId: String(data.psychiatristId),
              psychiatristName: String(data.psychiatristName),
              preferredSlot: String(data.preferredSlot),
              language: String(data.language),
              concernTopic: String(data.concernTopic),
              notes: String(data.notes),
              doctorResponse: data.doctorResponse
                ? String(data.doctorResponse)
                : undefined,
              status: data.status,
            };
          })
        );
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          "psychiatrist_consultations"
        )
    );

    const unsubPsychRequests = onSnapshot(
      query(
        collection(db, "psychiatrist_consultations"),
        where("psychiatristId", "==", firebaseUser.uid)
      ),
      (snap) => {
        setPsychiatristRequests(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              farmerId: String(data.farmerId),
              farmerName: String(data.farmerName),
              farmerState: data.farmerState
                ? String(data.farmerState)
                : undefined,
              psychiatristId: String(data.psychiatristId),
              psychiatristName: String(data.psychiatristName),
              preferredSlot: String(data.preferredSlot),
              language: String(data.language),
              concernTopic: String(data.concernTopic),
              notes: String(data.notes),
              doctorResponse: data.doctorResponse
                ? String(data.doctorResponse)
                : undefined,
              status: data.status,
            };
          })
        );
      },
      (err) =>
        handleFirestoreError(
          err,
          OperationType.LIST,
          "psychiatrist_consultations"
        )
    );

    const unsubNotifs = onSnapshot(
      query(
        collection(db, "notifications"),
        where("userId", "==", firebaseUser.uid)
      ),
      (snap) => {
        setNotifications(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: String(data.userId),
              category: data.category,
              title: String(data.title),
              description: String(data.description),
              read: Boolean(data.read),
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "notifications")
    );

    const unsubTickets = onSnapshot(
      query(
        collection(db, "support_tickets"),
        where("userId", "==", firebaseUser.uid)
      ),
      (snap) => {
        setSupportTickets(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: String(data.userId),
              category: data.category,
              subject: String(data.subject),
              message: String(data.message),
              priority: data.priority === "urgent" ? "urgent" : "normal",
              assignedEmployeeId: data.assignedEmployeeId
                ? String(data.assignedEmployeeId)
                : undefined,
              assignedEmployeeName: data.assignedEmployeeName
                ? String(data.assignedEmployeeName)
                : undefined,
              employeeReply: data.employeeReply
                ? String(data.employeeReply)
                : undefined,
              status: data.status,
            };
          })
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "support_tickets")
    );

    return () => {
      unsubProfile();
      unsubSaved();
      unsubBookings();
      unsubOwnerBookings();
      unsubConsultations();
      unsubPsychRequests();
      unsubNotifs();
      unsubTickets();
    };
  }, [authReady, firebaseUser]);

  // Role-elevated Firebase listeners (Support Staff & Admin)
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const isStaff = profile?.role === "support_staff";
    const unsubs: Array<() => void> = [];

    if (firebaseAdmin || isStaff) {
      unsubs.push(
        onSnapshot(
          collection(db, "support_tickets"),
          (snap) => {
            setStaffTickets(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  userId: String(data.userId),
                  category: data.category,
                  subject: String(data.subject),
                  message: String(data.message),
                  priority: data.priority === "urgent" ? "urgent" : "normal",
                  assignedEmployeeId: data.assignedEmployeeId
                    ? String(data.assignedEmployeeId)
                    : undefined,
                  assignedEmployeeName: data.assignedEmployeeName
                    ? String(data.assignedEmployeeName)
                    : undefined,
                  employeeReply: data.employeeReply
                    ? String(data.employeeReply)
                    : undefined,
                  status: data.status,
                };
              })
            );
          },
          (err) =>
            handleFirestoreError(err, OperationType.LIST, "support_tickets")
        )
      );
    } else {
      setStaffTickets([]);
    }

    if (firebaseAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, "users"),
          (snap) => {
            setAdminUsers(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  uid: String(data.uid || d.id),
                  name: String(data.name || "User"),
                  email: String(data.email || ""),
                  role: isValidRole(data.role) ? data.role : "farmer",
                  phone: String(data.phone || ""),
                  state: String(data.state || "India"),
                  district: String(data.district || ""),
                  landSizeAcres: Number(data.landSizeAcres ?? 0),
                  primaryCrops: Array.isArray(data.primaryCrops)
                    ? data.primaryCrops.map(String)
                    : [],
                  specialization: data.specialization
                    ? String(data.specialization)
                    : undefined,
                  qualification: data.qualification
                    ? String(data.qualification)
                    : undefined,
                  department: data.department
                    ? String(data.department)
                    : undefined,
                  availableForConsult:
                    typeof data.availableForConsult === "boolean"
                      ? data.availableForConsult
                      : undefined,
                  notificationsEnabled: data.notificationsEnabled !== false,
                  mustChangePassword: Boolean(data.mustChangePassword),
                };
              })
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "users")
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, "support_employees"),
          (snap) => {
            setAdminSupportEmployees(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  uid: String(data.uid || d.id),
                  name: String(data.name || ""),
                  email: String(data.email || ""),
                  department: String(
                    data.department || "Farmer Help & Operations Desk"
                  ),
                  status:
                    data.status === "active"
                      ? "active"
                      : "pending_first_login",
                  mustChangePassword: Boolean(data.mustChangePassword),
                  emailDeliveryStatus:
                    data.emailDeliveryStatus === "sent"
                      ? "sent"
                      : "outbox_generated",
                  lastEmailSubject: data.lastEmailSubject
                    ? String(data.lastEmailSubject)
                    : undefined,
                  createdBy: String(data.createdBy || ""),
                  createdAtLabel: "Provisioned",
                };
              })
            );
          },
          (err) =>
            handleFirestoreError(err, OperationType.LIST, "support_employees")
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, "mail_outbox"),
          (snap) => {
            setAdminMailOutbox(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  fromAddress: String(
                    data.fromAddress ||
                      "BhoomiBandhu Support Access <noreply@bhoomibandhu.in>"
                  ),
                  replyTo: String(data.replyTo || "noreply@bhoomibandhu.in"),
                  toEmail: String(data.toEmail || ""),
                  employeeName: String(data.employeeName || ""),
                  subject: String(data.subject || ""),
                  bodyPreview: String(data.bodyPreview || ""),
                  deliveryMode:
                    data.deliveryMode === "smtp" ? "smtp" : "outbox_generated",
                  sentAtLabel: "Automated Dispatch",
                };
              })
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "mail_outbox")
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, "bookings"),
          (snap) => {
            setAdminBookings(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  farmerId: String(data.farmerId),
                  farmerName: String(data.farmerName),
                  warehouseId: String(data.warehouseId),
                  warehouseOwnerId: String(data.warehouseOwnerId),
                  warehouseName: String(data.warehouseName),
                  cropType: String(data.cropType),
                  quantity: Number(data.quantity),
                  unit: data.unit,
                  startDate: String(data.startDate),
                  durationMonths: Number(data.durationMonths),
                  estimatedCostInr: Number(data.estimatedCostInr),
                  notes: data.notes ? String(data.notes) : undefined,
                  status: data.status,
                };
              })
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, "bookings")
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, "psychiatrist_consultations"),
          (snap) => {
            setAdminConsultations(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  farmerId: String(data.farmerId),
                  farmerName: String(data.farmerName),
                  farmerState: data.farmerState
                    ? String(data.farmerState)
                    : undefined,
                  psychiatristId: String(data.psychiatristId),
                  psychiatristName: String(data.psychiatristName),
                  preferredSlot: String(data.preferredSlot),
                  language: String(data.language),
                  concernTopic: String(data.concernTopic),
                  notes: String(data.notes),
                  doctorResponse: data.doctorResponse
                    ? String(data.doctorResponse)
                    : undefined,
                  status: data.status,
                };
              })
            );
          },
          (err) =>
            handleFirestoreError(
              err,
              OperationType.LIST,
              "psychiatrist_consultations"
            )
        )
      );
    } else {
      setAdminUsers([]);
      setAdminBookings([]);
      setAdminConsultations([]);
      setAdminSupportEmployees([]);
      setAdminMailOutbox([]);
    }

    return () => {
      for (const u of unsubs) u();
    };
  }, [authReady, firebaseUser, firebaseAdmin, profile?.role]);

  // Merged lists for UI
  const warehouses = useMemo(() => {
    const merged = isDemoMode
      ? [...demoWarehouses]
      : [...firestoreWarehouses];
    for (const seeded of SEEDED_WAREHOUSES) {
      if (!merged.some((w) => w.id === seeded.id)) {
        merged.push(seeded);
      }
    }
    return merged;
  }, [isDemoMode, demoWarehouses, firestoreWarehouses]);

  const partnerCompanies = useMemo(() => {
    if (isDemoMode) return demoCompanies;
    const merged = [...firestoreCompanies];
    for (const seeded of SEEDED_PARTNER_COMPANIES) {
      if (!merged.some((c) => c.id === seeded.id)) {
        merged.push(seeded);
      }
    }
    return merged;
  }, [isDemoMode, demoCompanies, firestoreCompanies]);

  const psychiatrists = useMemo(() => {
    if (isDemoMode) return demoPsychiatrists;
    const merged = [...firestorePsychiatrists];
    for (const seeded of SEEDED_PSYCHIATRISTS) {
      if (!merged.some((p) => p.id === seeded.id)) {
        merged.push(seeded);
      }
    }
    return merged;
  }, [isDemoMode, demoPsychiatrists, firestorePsychiatrists]);

  const effectiveSavedSchemes = isDemoMode
    ? demoSavedSchemes.filter((s) => s.userId === user?.uid)
    : savedSchemes;

  const effectiveBookings = isDemoMode
    ? demoBookings.filter((b) => b.farmerId === user?.uid)
    : bookings;

  const effectiveOwnerBookings = isDemoMode
    ? demoBookings.filter((b) => b.warehouseOwnerId === user?.uid)
    : ownerIncomingBookings;

  const effectiveConsultations = isDemoMode
    ? demoConsultations.filter((c) => c.farmerId === user?.uid)
    : farmerConsultations;

  const effectivePsychRequests = isDemoMode
    ? demoConsultations.filter((c) => c.psychiatristId === user?.uid)
    : psychiatristRequests;

  const effectiveNotifications = isDemoMode
    ? demoNotifications.filter((n) => n.userId === user?.uid)
    : notifications;

  const effectiveSupportTickets = isDemoMode
    ? demoTickets.filter((t) => t.userId === user?.uid)
    : supportTickets;

  const effectiveAllSupportTickets = isDemoMode ? demoTickets : staffTickets;
  const effectiveAllUsers = isDemoMode ? demoUsers : adminUsers;
  const effectiveAllBookings = isDemoMode ? demoBookings : adminBookings;
  const effectiveAllConsultations = isDemoMode
    ? demoConsultations
    : adminConsultations;

  const effectiveSupportEmployees = useMemo(() => {
    if (isDemoMode) return demoSupportEmployees;
    const merged = [...adminSupportEmployees];
    for (const u of adminUsers) {
      if (
        u.role === "support_staff" &&
        !merged.some(
          (emp) =>
            emp.uid === u.uid ||
            emp.email.toLowerCase() === u.email.toLowerCase()
        )
      ) {
        merged.push({
          id: u.uid,
          uid: u.uid,
          name: u.name,
          email: u.email,
          department: u.department || "Farmer Help & Operations Desk",
          status: u.mustChangePassword ? "pending_first_login" : "active",
          mustChangePassword: Boolean(u.mustChangePassword),
          emailDeliveryStatus: "sent",
          createdBy: "admin",
          createdAtLabel: "Directory User",
        });
      }
    }
    return merged;
  }, [isDemoMode, demoSupportEmployees, adminSupportEmployees, adminUsers]);

  const effectiveMailOutbox = isDemoMode ? demoMailOutbox : adminMailOutbox;

  const isOperationNotAllowed = (err: unknown): boolean => {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code || "")
        : "";
    const msg = err instanceof Error ? err.message : String(err);
    return (
      code.includes("auth/operation-not-allowed") ||
      msg.includes("auth/operation-not-allowed")
    );
  };

  // Auth methods
  const signInWithGoogle = async (preferredRole: UserRole = "farmer") => {
    setDemoAccount(null);
    const safeRole: UserRole =
      preferredRole === "warehouse_owner" || preferredRole === "psychiatrist"
        ? preferredRole
        : "farmer";
    pendingGoogleRoleRef.current = safeRole;
    const cred = await signInWithPopup(auth, googleProvider);
    const userRef = doc(db, "users", cred.user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const displayName = sanitizeStr(
        cred.user.displayName || cred.user.email?.split("@")[0] || "Kisan Friend",
        100
      );
      await setDoc(userRef, {
        uid: cred.user.uid,
        name: displayName,
        email: sanitizeStr(cred.user.email || "", 160),
        role: safeRole,
        phone: "",
        state: "Punjab",
        district: "",
        landSizeAcres: safeRole === "farmer" ? 2.5 : 0,
        primaryCrops: safeRole === "farmer" ? ["Wheat"] : [],
        ...(safeRole === "psychiatrist" ? { availableForConsult: true } : {}),
        notificationsEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (safeRole === "psychiatrist") {
        await setDoc(doc(db, "psychiatrists", cred.user.uid), {
          userId: cred.user.uid,
          name: displayName,
          qualification: "MD Psychiatry",
          specialization: "Farmer Mental Health & Stress Support",
          languages: ["Hindi", "English"],
          experienceYears: 5,
          state: "India",
          bio: "Confidential rural mental health specialist.",
          availableForConsult: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  };

  const signUpWithEmail: AuthContextValue["signUpWithEmail"] = async ({
    name,
    email,
    password,
    role,
    specialization,
    qualification,
    department,
  }) => {
    setDemoAccount(null);
    const cleanName = sanitizeStr(name, 100);
    const cleanEmail = sanitizeStr(email.trim(), 160);
    const safeRole: UserRole =
      role === "warehouse_owner" || role === "psychiatrist"
        ? role
        : "farmer";

    const duplicateInSandbox =
      DEMO_ACCOUNTS.some(
        (acc) => acc.email.toLowerCase() === cleanEmail.toLowerCase()
      ) ||
      demoProvisionedAccounts.some(
        (acc) => acc.email.toLowerCase() === cleanEmail.toLowerCase()
      );
    if (duplicateInSandbox) {
      throw new Error(
        "An account with this email already exists in this session. Please log in instead."
      );
    }

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );
      await updateProfile(cred.user, { displayName: cleanName });
      try {
        await sendEmailVerification(cred.user);
      } catch {
        // ignore throttle
      }
      await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        name: cleanName,
        email: cleanEmail,
        role: safeRole,
        phone: "",
        state: "Punjab",
        district: "",
        landSizeAcres: safeRole === "farmer" ? 2.5 : 0,
        primaryCrops: safeRole === "farmer" ? ["Wheat"] : [],
        ...(specialization?.trim()
          ? { specialization: sanitizeStr(specialization, 100) }
          : {}),
        ...(qualification?.trim()
          ? { qualification: sanitizeStr(qualification, 100) }
          : {}),
        ...(department?.trim()
          ? { department: sanitizeStr(department, 80) }
          : {}),
        ...(safeRole === "psychiatrist" ? { availableForConsult: true } : {}),
        notificationsEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (safeRole === "psychiatrist") {
        await setDoc(doc(db, "psychiatrists", cred.user.uid), {
          userId: cred.user.uid,
          name: cleanName,
          qualification: sanitizeStr(qualification || "MD Psychiatry", 100),
          specialization: sanitizeStr(
            specialization || "Rural Stress & Farmer Well-Being",
            120
          ),
          languages: ["Hindi", "English"],
          experienceYears: 5,
          state: "India",
          bio: "Confidential consultation specialist on BhoomiBandhu.",
          availableForConsult: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      if (!isOperationNotAllowed(err)) {
        throw err;
      }

      // Firebase Email/Password provider is not enabled in Console yet:
      // seamlessly provision a local session account (never Admin/Support Staff) so signup works right away.
      const sandboxUid = `local-${safeRole}-${Date.now()}`;
      const badgeLabel =
        safeRole === "warehouse_owner"
          ? "Warehouse"
          : safeRole === "psychiatrist"
          ? "Doctor"
          : "Farmer";

      const sandboxCred: DemoAccountCredential = {
        id: sandboxUid,
        role: safeRole,
        label: `${badgeLabel} Session Account`,
        badge: badgeLabel,
        name: cleanName,
        email: cleanEmail,
        password,
        state: "Punjab",
        district: "",
        phone: "",
        landSizeAcres: safeRole === "farmer" ? 2.5 : 0,
        primaryCrops: safeRole === "farmer" ? ["Wheat"] : [],
        specialization: specialization?.trim()
          ? sanitizeStr(specialization, 100)
          : safeRole === "psychiatrist"
          ? "Rural Stress & Farmer Well-Being"
          : undefined,
        qualification: qualification?.trim()
          ? sanitizeStr(qualification, 100)
          : safeRole === "psychiatrist"
          ? "MD Psychiatry"
          : undefined,
        summary: "Session-scoped account created while Email/Password auth is pending Firebase Console setup.",
      };

      const sandboxProfile: UserProfileData = {
        uid: sandboxUid,
        name: cleanName,
        email: cleanEmail,
        role: safeRole,
        phone: "",
        state: "Punjab",
        district: "",
        landSizeAcres: safeRole === "farmer" ? 2.5 : 0,
        primaryCrops: safeRole === "farmer" ? ["Wheat"] : [],
        specialization: sandboxCred.specialization,
        qualification: sandboxCred.qualification,
        availableForConsult: safeRole === "psychiatrist" ? true : undefined,
        notificationsEnabled: true,
      };

      setDemoProvisionedAccounts((prev) => [sandboxCred, ...prev]);
      setDemoUsers((prev) => [sandboxProfile, ...prev]);

      if (safeRole === "psychiatrist") {
        setDemoPsychiatrists((prev) => [
          {
            id: sandboxUid,
            userId: sandboxUid,
            name: cleanName,
            qualification: sandboxCred.qualification || "MD Psychiatry",
            specialization:
              sandboxCred.specialization ||
              "Rural Stress & Farmer Well-Being",
            languages: ["Hindi", "English"],
            experienceYears: 5,
            state: "India",
            bio: "Confidential consultation specialist on BhoomiBandhu.",
            availableForConsult: true,
          },
          ...prev,
        ]);
      }

      setDemoNotifications((prev) => [
        {
          id: `notif-welcome-${Date.now()}`,
          userId: sandboxUid,
          category: "system",
          title: "Welcome to BhoomiBandhu (Session Account)",
          description:
            "Email/Password provider is not enabled in Firebase Console yet, so this account runs in local session mode. Use Google Sign-In for cloud persistence.",
          read: false,
        },
        ...prev,
      ]);

      setDemoAccount(sandboxCred);
      setAuthReady(true);
    }
  };

  const logInWithEmail = async (email: string, password: string) => {
    const cleanEmail = email.trim();
    const matchedDemo = matchDemoCredential(cleanEmail, password);
    if (matchedDemo) {
      setDemoAccount(matchedDemo);
      setAuthReady(true);
      return;
    }
    const matchedProvisioned = demoProvisionedAccounts.find(
      (acc) =>
        acc.email.toLowerCase() === cleanEmail.toLowerCase() &&
        acc.password === password
    );
    if (matchedProvisioned) {
      setDemoAccount(matchedProvisioned);
      setAuthReady(true);
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
      setDemoAccount(null);
    } catch (err) {
      if (isOperationNotAllowed(err)) {
        throw new Error("FIREBASE_EMAIL_PASSWORD_DISABLED");
      }
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      if (isOperationNotAllowed(err)) {
        throw new Error("FIREBASE_EMAIL_PASSWORD_DISABLED");
      }
      throw err;
    }
  };

  const logOut = async () => {
    setDemoAccount(null);
    setProfile(null);
    if (firebaseUser) {
      await signOut(auth);
    }
  };

  const updateUserProfile = async (updates: Partial<UserProfileData>) => {
    if (!user || !profile) {
      throw new Error("Please sign in to save your profile.");
    }
    if (isDemoMode) {
      setDemoUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? {
                ...u,
                name: sanitizeStr(updates.name ?? u.name, 100),
                phone: sanitizeStr(updates.phone ?? u.phone, 24),
                state: sanitizeStr(updates.state ?? u.state, 80),
                district: sanitizeStr(updates.district ?? u.district, 80),
                landSizeAcres: Number(updates.landSizeAcres ?? u.landSizeAcres),
                primaryCrops: (updates.primaryCrops ?? u.primaryCrops)
                  .slice(0, 10)
                  .map((c) => sanitizeStr(c, 40)),
                specialization:
                  updates.specialization !== undefined
                    ? sanitizeStr(updates.specialization, 100)
                    : u.specialization,
                qualification:
                  updates.qualification !== undefined
                    ? sanitizeStr(updates.qualification, 100)
                    : u.qualification,
                department:
                  updates.department !== undefined
                    ? sanitizeStr(updates.department, 80)
                    : u.department,
                notificationsEnabled:
                  updates.notificationsEnabled ?? u.notificationsEnabled,
              }
            : u
        )
      );
      return;
    }

    const path = `users/${user.uid}`;
    try {
      await updateDoc(doc(db, "users", user.uid), {
        name: sanitizeStr(updates.name ?? profile.name, 100),
        phone: sanitizeStr(updates.phone ?? profile.phone, 24),
        state: sanitizeStr(updates.state ?? profile.state, 80),
        district: sanitizeStr(updates.district ?? profile.district, 80),
        landSizeAcres: Number(updates.landSizeAcres ?? profile.landSizeAcres),
        primaryCrops: (updates.primaryCrops ?? profile.primaryCrops)
          .slice(0, 10)
          .map((c) => sanitizeStr(c, 40)),
        ...(updates.specialization !== undefined
          ? { specialization: sanitizeStr(updates.specialization, 100) }
          : {}),
        ...(updates.qualification !== undefined
          ? { qualification: sanitizeStr(updates.qualification, 100) }
          : {}),
        ...(updates.department !== undefined
          ? { department: sanitizeStr(updates.department, 80) }
          : {}),
        notificationsEnabled:
          updates.notificationsEnabled ?? profile.notificationsEnabled,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const isSchemeSaved = (schemeId: string) =>
    effectiveSavedSchemes.some((s) => s.schemeId === schemeId);

  const toggleSaveScheme = async (scheme: SchemeItem): Promise<boolean> => {
    if (!user) throw new Error("AUTH_REQUIRED");
    const existing = effectiveSavedSchemes.find(
      (s) => s.schemeId === scheme.id
    );
    if (isDemoMode) {
      if (existing) {
        setDemoSavedSchemes((prev) => prev.filter((s) => s.id !== existing.id));
        return false;
      }
      setDemoSavedSchemes((prev) => [
        ...prev,
        {
          id: `saved-${Date.now()}`,
          userId: user.uid,
          schemeId: scheme.id,
          schemeName: scheme.name,
          category: scheme.category,
        },
      ]);
      setDemoNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          userId: user.uid,
          category: "scheme",
          title: `Saved: ${scheme.shortName}`,
          description: "Added to your saved schemes list for easy reference.",
          read: false,
        },
        ...prev,
      ]);
      return true;
    }

    if (existing) {
      try {
        await deleteDoc(doc(db, "saved_schemes", existing.id));
        return false;
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.DELETE,
          `saved_schemes/${existing.id}`
        );
      }
    } else {
      try {
        await addDoc(collection(db, "saved_schemes"), {
          userId: user.uid,
          schemeId: sanitizeStr(scheme.id, 80),
          schemeName: sanitizeStr(scheme.name, 140),
          category: sanitizeStr(scheme.category, 60),
          savedAt: serverTimestamp(),
        });
        await addDoc(collection(db, "notifications"), {
          userId: user.uid,
          category: "scheme",
          title: `Saved: ${sanitizeStr(scheme.shortName, 80)}`,
          description: "Added to your saved schemes list for easy reference.",
          read: false,
          createdAt: serverTimestamp(),
        });
        return true;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "saved_schemes");
      }
    }
  };

  const createWarehouseBooking: AuthContextValue["createWarehouseBooking"] =
    async (payload) => {
      if (!user) throw new Error("AUTH_REQUIRED");
      if (isDemoMode) {
        const newBk: BookingRecord = {
          id: `booking-${Date.now()}`,
          farmerId: user.uid,
          farmerName: sanitizeStr(profile?.name || user.displayName || "Farmer", 100),
          warehouseId: payload.warehouse.id,
          warehouseOwnerId: payload.warehouse.ownerId,
          warehouseName: payload.warehouse.name,
          cropType: sanitizeStr(payload.cropType, 60),
          quantity: Number(payload.quantity),
          unit: payload.unit,
          startDate: sanitizeStr(payload.startDate, 20),
          durationMonths: Math.trunc(payload.durationMonths),
          estimatedCostInr: Number(payload.estimatedCostInr),
          notes: payload.notes.trim()
            ? sanitizeStr(payload.notes, 400)
            : undefined,
          status: "pending",
        };
        setDemoBookings((prev) => [newBk, ...prev]);
        setDemoNotifications((prev) => [
          {
            id: `notif-${Date.now()}`,
            userId: user.uid,
            category: "warehouse",
            title: `Storage request sent: ${payload.warehouse.name}`,
            description: `${payload.quantity} ${payload.unit} of ${payload.cropType} for ${payload.durationMonths} month(s).`,
            read: false,
          },
          ...prev,
        ]);
        return;
      }

      try {
        await addDoc(collection(db, "bookings"), {
          farmerId: user.uid,
          farmerName: sanitizeStr(
            profile?.name || user.displayName || "Farmer",
            100
          ),
          warehouseId: sanitizeStr(payload.warehouse.id, 128),
          warehouseOwnerId: sanitizeStr(payload.warehouse.ownerId, 128),
          warehouseName: sanitizeStr(payload.warehouse.name, 120),
          cropType: sanitizeStr(payload.cropType, 60),
          quantity: Number(payload.quantity),
          unit: payload.unit,
          startDate: sanitizeStr(payload.startDate, 20),
          durationMonths: Math.trunc(payload.durationMonths),
          estimatedCostInr: Number(payload.estimatedCostInr),
          ...(payload.notes.trim()
            ? { notes: sanitizeStr(payload.notes, 400) }
            : {}),
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, "notifications"), {
          userId: user.uid,
          category: "warehouse",
          title: `Storage request sent: ${sanitizeStr(payload.warehouse.name, 80)}`,
          description: `${payload.quantity} ${payload.unit} of ${payload.cropType} for ${payload.durationMonths} month(s).`,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "bookings");
      }
    };

  const updateBookingStatus: AuthContextValue["updateBookingStatus"] = async (
    bookingId,
    status
  ) => {
    if (!user) throw new Error("AUTH_REQUIRED");
    if (isDemoMode) {
      setDemoBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status } : b))
      );
      return;
    }
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `bookings/${bookingId}`
      );
    }
  };

  const createWarehouseListing: AuthContextValue["createWarehouseListing"] =
    async (payload) => {
      if (!user) throw new Error("AUTH_REQUIRED");
      if (isDemoMode) {
        setDemoWarehouses((prev) => [
          {
            id: `wh-demo-${Date.now()}`,
            ownerId: user.uid,
            name: sanitizeStr(payload.name, 120),
            cityState: sanitizeStr(payload.cityState, 120),
            distanceKm: 4.5,
            totalCapacityMt: Number(payload.totalCapacityMt),
            availableCapacityMt: Number(payload.availableCapacityMt),
            pricePerQuintalMonth: Number(payload.pricePerQuintalMonth),
            rating: 4.8,
            facilities: payload.facilities
              .slice(0, 8)
              .map((f) => sanitizeStr(f, 40)),
            description: sanitizeStr(payload.description, 600),
            status: "active",
            mapX: 52,
            mapY: 42,
            isCatalog: false,
          },
          ...prev,
        ]);
        return;
      }
      try {
        await addDoc(collection(db, "warehouses"), {
          ownerId: user.uid,
          name: sanitizeStr(payload.name, 120),
          cityState: sanitizeStr(payload.cityState, 120),
          distanceKm: 4.5,
          totalCapacityMt: Number(payload.totalCapacityMt),
          availableCapacityMt: Number(payload.availableCapacityMt),
          pricePerQuintalMonth: Number(payload.pricePerQuintalMonth),
          facilities: payload.facilities
            .slice(0, 8)
            .map((f) => sanitizeStr(f, 40)),
          description: sanitizeStr(payload.description, 600),
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "warehouses");
      }
    };

  const submitSupportTicket: AuthContextValue["submitSupportTicket"] = async (
    payload
  ) => {
    if (!user) throw new Error("AUTH_REQUIRED");
    const priority = payload.priority === "urgent" ? "urgent" : "normal";
    if (isDemoMode) {
      setDemoTickets((prev) => [
        {
          id: `ticket-${Date.now()}`,
          userId: user.uid,
          category: payload.category,
          subject: sanitizeStr(payload.subject, 120),
          message: sanitizeStr(payload.message, 1000),
          priority,
          status: "open",
        },
        ...prev,
      ]);
      return;
    }
    try {
      await addDoc(collection(db, "support_tickets"), {
        userId: user.uid,
        category: payload.category,
        subject: sanitizeStr(payload.subject, 120),
        message: sanitizeStr(payload.message, 1000),
        priority,
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "support_tickets");
    }
  };

  const updateSupportTicket: AuthContextValue["updateSupportTicket"] = async ({
    ticketId,
    status,
    employeeReply,
    priority,
    claimTicket,
  }) => {
    if (!user) throw new Error("AUTH_REQUIRED");
    const staffName = sanitizeStr(
      profile?.name || user.displayName || "Support Employee",
      100
    );
    if (isDemoMode) {
      setDemoTickets((prev) =>
        prev.map((t) => {
          if (t.id !== ticketId) return t;
          return {
            ...t,
            status,
            ...(priority ? { priority } : {}),
            ...(employeeReply !== undefined
              ? { employeeReply: sanitizeStr(employeeReply, 1000) }
              : {}),
            ...(claimTicket || !t.assignedEmployeeId
              ? {
                  assignedEmployeeId: user.uid,
                  assignedEmployeeName: staffName,
                }
              : {}),
          };
        })
      );
      return;
    }

    const payload: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (priority) payload.priority = priority;
    if (employeeReply !== undefined && employeeReply.trim()) {
      payload.employeeReply = sanitizeStr(employeeReply, 1000);
    }
    if (claimTicket) {
      payload.assignedEmployeeId = user.uid;
      payload.assignedEmployeeName = staffName;
    }
    try {
      await updateDoc(doc(db, "support_tickets", ticketId), payload);
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `support_tickets/${ticketId}`
      );
    }
  };

  const bookPsychiatristSession: AuthContextValue["bookPsychiatristSession"] =
    async (payload) => {
      if (!user) throw new Error("AUTH_REQUIRED");
      const farmerName = sanitizeStr(
        profile?.name || user.displayName || "Farmer",
        100
      );
      const farmerState = sanitizeStr(profile?.state || "India", 80);
      if (isDemoMode) {
        setDemoConsultations((prev) => [
          {
            id: `consult-${Date.now()}`,
            farmerId: user.uid,
            farmerName,
            farmerState,
            psychiatristId: payload.psychiatrist.userId,
            psychiatristName: payload.psychiatrist.name,
            preferredSlot: sanitizeStr(payload.preferredSlot, 60),
            language: sanitizeStr(payload.language, 40),
            concernTopic: sanitizeStr(payload.concernTopic, 120),
            notes: sanitizeStr(payload.notes, 1000),
            status: "requested",
          },
          ...prev,
        ]);
        return;
      }

      try {
        await addDoc(collection(db, "psychiatrist_consultations"), {
          farmerId: user.uid,
          farmerName,
          farmerState,
          psychiatristId: sanitizeStr(payload.psychiatrist.userId, 128),
          psychiatristName: sanitizeStr(payload.psychiatrist.name, 100),
          preferredSlot: sanitizeStr(payload.preferredSlot, 60),
          language: sanitizeStr(payload.language, 40),
          concernTopic: sanitizeStr(payload.concernTopic, 120),
          notes: sanitizeStr(payload.notes, 1000),
          status: "requested",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          "psychiatrist_consultations"
        );
      }
    };

  const updateConsultationStatus: AuthContextValue["updateConsultationStatus"] =
    async ({ consultationId, status, doctorResponse }) => {
      if (!user) throw new Error("AUTH_REQUIRED");
      if (isDemoMode) {
        setDemoConsultations((prev) =>
          prev.map((c) =>
            c.id === consultationId
              ? {
                  ...c,
                  status,
                  ...(doctorResponse !== undefined && doctorResponse.trim()
                    ? { doctorResponse: sanitizeStr(doctorResponse, 1000) }
                    : {}),
                }
              : c
          )
        );
        return;
      }

      const payload: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (doctorResponse !== undefined && doctorResponse.trim()) {
        payload.doctorResponse = sanitizeStr(doctorResponse, 1000);
      }
      try {
        await updateDoc(
          doc(db, "psychiatrist_consultations", consultationId),
          payload
        );
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `psychiatrist_consultations/${consultationId}`
        );
      }
    };

  const togglePsychiatristAvailability = async (available: boolean) => {
    if (!user) throw new Error("AUTH_REQUIRED");
    if (isDemoMode) {
      setDemoPsychiatrists((prev) =>
        prev.map((p) =>
          p.userId === user.uid ? { ...p, availableForConsult: available } : p
        )
      );
      setDemoUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid ? { ...u, availableForConsult: available } : u
        )
      );
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        availableForConsult: available,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "psychiatrists", user.uid), {
        availableForConsult: available,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `psychiatrists/${user.uid}`
      );
    }
  };

  const addPartnerCompany: AuthContextValue["addPartnerCompany"] = async (
    payload
  ) => {
    if (!user || !isAdmin) throw new Error("ADMIN_REQUIRED");
    if (isDemoMode) {
      setDemoCompanies((prev) => [
        {
          id: `comp-${Date.now()}`,
          name: sanitizeStr(payload.name, 120),
          category: payload.category,
          interestOrPremium: sanitizeStr(payload.interestOrPremium, 100),
          coverageOrLimit: sanitizeStr(payload.coverageOrLimit, 120),
          eligibilitySummary: sanitizeStr(payload.eligibilitySummary, 300),
          contactHelpline: sanitizeStr(payload.contactHelpline, 60),
          websiteUrl: payload.websiteUrl?.trim()
            ? sanitizeStr(payload.websiteUrl, 200)
            : undefined,
          status: "active",
          createdBy: user.uid,
        },
        ...prev,
      ]);
      return;
    }

    try {
      await addDoc(collection(db, "partner_companies"), {
        name: sanitizeStr(payload.name, 120),
        category: payload.category,
        interestOrPremium: sanitizeStr(payload.interestOrPremium, 100),
        coverageOrLimit: sanitizeStr(payload.coverageOrLimit, 120),
        eligibilitySummary: sanitizeStr(payload.eligibilitySummary, 300),
        contactHelpline: sanitizeStr(payload.contactHelpline, 60),
        ...(payload.websiteUrl?.trim()
          ? { websiteUrl: sanitizeStr(payload.websiteUrl, 200) }
          : {}),
        status: "active",
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "partner_companies");
    }
  };

  const togglePartnerCompanyStatus = async (
    companyId: string,
    nextStatus: "active" | "paused"
  ) => {
    if (!user || !isAdmin) throw new Error("ADMIN_REQUIRED");
    if (isDemoMode) {
      setDemoCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, status: nextStatus } : c))
      );
      return;
    }
    try {
      await updateDoc(doc(db, "partner_companies", companyId), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `partner_companies/${companyId}`
      );
    }
  };

  const deletePartnerCompany = async (companyId: string) => {
    if (!user || !isAdmin) throw new Error("ADMIN_REQUIRED");
    if (isDemoMode) {
      setDemoCompanies((prev) => prev.filter((c) => c.id !== companyId));
      return;
    }
    try {
      await deleteDoc(doc(db, "partner_companies", companyId));
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.DELETE,
        `partner_companies/${companyId}`
      );
    }
  };

  const adminUpdateUserRole = async (uid: string, nextRole: UserRole) => {
    if (!user || !isAdmin) throw new Error("ADMIN_REQUIRED");
    if (isDemoMode) {
      setDemoUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: nextRole } : u))
      );
      return;
    }
    try {
      await updateDoc(doc(db, "users", uid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const markNotificationRead = async (notifId: string) => {
    if (!user) return;
    if (isDemoMode) {
      setDemoNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
      return;
    }
    try {
      await updateDoc(doc(db, "notifications", notifId), {
        read: true,
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `notifications/${notifId}`
      );
    }
  };

  const provisionSupportEmployee: AuthContextValue["provisionSupportEmployee"] =
    async ({ name, email, department, tempPassword }) => {
      if (!user || !isAdmin) throw new Error("ADMIN_REQUIRED");

      const cleanName = sanitizeStr(name, 100);
      const cleanEmail = sanitizeStr(email.trim().toLowerCase(), 160);
      const cleanDept = sanitizeStr(
        department?.trim() || "Farmer Help & Operations Desk",
        80
      );

      const check = validateEmployeeProvisionInput({
        name: cleanName,
        email: cleanEmail,
        tempPassword,
        department: cleanDept,
      });
      if (!check.valid) {
        throw new Error(check.error || "Invalid support employee details.");
      }

      const duplicate = effectiveSupportEmployees.some(
        (e) => e.email.toLowerCase() === cleanEmail
      );
      if (duplicate) {
        throw new Error(
          `A support employee with email ${cleanEmail} already exists.`
        );
      }

      const portalUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : "https://bhoomibandhu.in";

      let deliveryMode: "smtp" | "outbox_generated" = "outbox_generated";
      let generatedMail = buildNoReplyAccessEmail({
        employeeName: cleanName,
        employeeEmail: cleanEmail,
        tempPassword,
        department: cleanDept,
        portalUrl,
      });

      const idToken = firebaseUser ? await firebaseUser.getIdToken() : null;
      const mailRes = await fetch("/api/admin/send-employee-access-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          employeeName: cleanName,
          employeeEmail: cleanEmail,
          tempPassword,
          department: cleanDept,
          portalUrl,
          previewOnly: isDemoMode,
        }),
      });
      if (mailRes.ok) {
        const mailJson = (await mailRes.json()) as {
          deliveryMode?: "smtp" | "outbox_generated";
          emailRecord?: typeof generatedMail;
        };
        if (mailJson.deliveryMode === "smtp") {
          deliveryMode = "smtp";
        }
        if (mailJson.emailRecord) {
          generatedMail = mailJson.emailRecord;
        }
      }

      const nowLabel = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      if (isDemoMode) {
        const newUid = `support-emp-${Date.now()}`;
        const cred: DemoAccountCredential = {
          id: newUid,
          role: "support_staff",
          label: "Support Employee",
          badge: "Support Staff",
          name: cleanName,
          email: cleanEmail,
          password: tempPassword,
          state: "India",
          district: "",
          phone: "",
          landSizeAcres: 0,
          primaryCrops: [],
          department: cleanDept,
          summary:
            "Admin-provisioned Support Desk employee (must update password on first login).",
        };

        const empRecord: SupportEmployeeRecord = {
          id: newUid,
          uid: newUid,
          name: cleanName,
          email: cleanEmail,
          department: cleanDept,
          status: "pending_first_login",
          mustChangePassword: true,
          emailDeliveryStatus:
            deliveryMode === "smtp" ? "sent" : "outbox_generated",
          lastEmailSubject: generatedMail.subject,
          createdBy: user.uid,
          createdAtLabel: `Added ${nowLabel}`,
        };

        const outboxRecord: AutomatedMailRecord = {
          id: `mail-${Date.now()}`,
          fromAddress: generatedMail.fromAddress,
          replyTo: generatedMail.replyTo,
          toEmail: generatedMail.toEmail,
          employeeName: generatedMail.employeeName,
          subject: generatedMail.subject,
          bodyPreview: generatedMail.bodyText,
          deliveryMode,
          sentAtLabel: nowLabel,
        };

        setDemoProvisionedAccounts((prev) => [cred, ...prev]);
        setDemoUsers((prev) => [
          {
            uid: newUid,
            name: cleanName,
            email: cleanEmail,
            role: "support_staff",
            phone: "",
            state: "India",
            district: "",
            landSizeAcres: 0,
            primaryCrops: [],
            department: cleanDept,
            notificationsEnabled: true,
            mustChangePassword: true,
          },
          ...prev,
        ]);
        setDemoSupportEmployees((prev) => [empRecord, ...prev]);
        setDemoMailOutbox((prev) => [outboxRecord, ...prev]);

        return { employee: empRecord, emailRecord: outboxRecord };
      }

      // Live Firebase mode: create Firebase Auth user via secondary app so Admin stays signed in
      const secondaryApp = initializeApp(
        firebaseConfig,
        `bhoomi-emp-provision-${Date.now()}`
      );
      let newUid = "";
      try {
        const secondaryAuth = getAuth(secondaryApp);
        const cred = await createUserWithEmailAndPassword(
          secondaryAuth,
          cleanEmail,
          tempPassword
        );
        await updateProfile(cred.user, { displayName: cleanName });
        newUid = cred.user.uid;
        await signOut(secondaryAuth);
      } catch (err) {
        if (isOperationNotAllowed(err)) {
          throw new Error(
            "Enable Email/Password in Firebase Console (Authentication > Sign-in method) to create live employee passwords, or use the Admin Sandbox Preview profile to test onboarding right now."
          );
        }
        throw err;
      } finally {
        await deleteApp(secondaryApp);
      }

      try {
        await setDoc(doc(db, "users", newUid), {
          uid: newUid,
          name: cleanName,
          email: cleanEmail,
          role: "support_staff",
          phone: "",
          state: "India",
          district: "",
          landSizeAcres: 0,
          primaryCrops: [],
          department: cleanDept,
          notificationsEnabled: true,
          mustChangePassword: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, "support_employees", newUid), {
          uid: newUid,
          name: cleanName,
          email: cleanEmail,
          department: cleanDept,
          status: "pending_first_login",
          mustChangePassword: true,
          emailDeliveryStatus:
            deliveryMode === "smtp" ? "sent" : "outbox_generated",
          lastEmailSubject: sanitizeStr(generatedMail.subject, 160),
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const mailDocRef = await addDoc(collection(db, "mail_outbox"), {
          fromAddress: sanitizeStr(generatedMail.fromAddress, 160),
          replyTo: sanitizeStr(generatedMail.replyTo, 160),
          toEmail: cleanEmail,
          employeeName: cleanName,
          subject: sanitizeStr(generatedMail.subject, 160),
          bodyPreview: sanitizeStr(generatedMail.bodyText, 1200),
          deliveryMode,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });

        return {
          employee: {
            id: newUid,
            uid: newUid,
            name: cleanName,
            email: cleanEmail,
            department: cleanDept,
            status: "pending_first_login",
            mustChangePassword: true,
            emailDeliveryStatus:
              deliveryMode === "smtp" ? "sent" : "outbox_generated",
            lastEmailSubject: generatedMail.subject,
            createdBy: user.uid,
            createdAtLabel: `Added ${nowLabel}`,
          },
          emailRecord: {
            id: mailDocRef.id,
            fromAddress: generatedMail.fromAddress,
            replyTo: generatedMail.replyTo,
            toEmail: generatedMail.toEmail,
            employeeName: generatedMail.employeeName,
            subject: generatedMail.subject,
            bodyPreview: generatedMail.bodyText,
            deliveryMode,
            sentAtLabel: nowLabel,
          },
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `support_employees/${newUid}`);
      }
    };

  const completeFirstLoginPasswordChange: AuthContextValue["completeFirstLoginPasswordChange"] =
    async ({ newPassword, confirmPassword }) => {
      if (!user || !effectiveProfile) {
        throw new Error("Please log in first.");
      }

      const currentDemoCred = isDemoMode
        ? demoProvisionedAccounts.find((a) => a.id === user.uid)
        : undefined;

      const check = validateFirstLoginPasswordChange({
        currentTempPassword: currentDemoCred?.password,
        newPassword,
        confirmPassword,
      });
      if (!check.valid) {
        throw new Error(check.error || "Invalid new password.");
      }

      if (isDemoMode) {
        setDemoProvisionedAccounts((prev) =>
          prev.map((a) =>
            a.id === user.uid ? { ...a, password: newPassword } : a
          )
        );
        setDemoAccount((prev) =>
          prev && prev.id === user.uid ? { ...prev, password: newPassword } : prev
        );
        setDemoUsers((prev) =>
          prev.map((u) =>
            u.uid === user.uid ? { ...u, mustChangePassword: false } : u
          )
        );
        setDemoSupportEmployees((prev) =>
          prev.map((emp) =>
            emp.uid === user.uid
              ? {
                  ...emp,
                  mustChangePassword: false,
                  status: "active",
                }
              : emp
          )
        );
        return;
      }

      if (!firebaseUser) {
        throw new Error("Active session required to update password.");
      }

      await updatePassword(firebaseUser, newPassword);

      try {
        await updateDoc(doc(db, "users", firebaseUser.uid), {
          mustChangePassword: false,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `users/${firebaseUser.uid}`
        );
      }

      try {
        await updateDoc(doc(db, "support_employees", firebaseUser.uid), {
          status: "active",
          mustChangePassword: false,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Ignore if user record was not created via support_employees
      }
    };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: effectiveProfile,
        authReady,
        isAdmin,
        isDemoMode,
        savedSchemes: effectiveSavedSchemes,
        bookings: effectiveBookings,
        ownerIncomingBookings: effectiveOwnerBookings,
        warehouses,
        partnerCompanies,
        psychiatrists,
        consultations: effectiveConsultations,
        psychiatristRequests: effectivePsychRequests,
        notifications: effectiveNotifications,
        supportTickets: effectiveSupportTickets,
        allSupportTickets: effectiveAllSupportTickets,
        allUsers: effectiveAllUsers,
        allBookings: effectiveAllBookings,
        allConsultations: effectiveAllConsultations,
        supportEmployees: effectiveSupportEmployees,
        mailOutbox: effectiveMailOutbox,
        signInWithGoogle,
        signUpWithEmail,
        logInWithEmail,
        resetPassword,
        logOut,
        updateUserProfile,
        toggleSaveScheme,
        isSchemeSaved,
        createWarehouseBooking,
        updateBookingStatus,
        createWarehouseListing,
        submitSupportTicket,
        updateSupportTicket,
        bookPsychiatristSession,
        updateConsultationStatus,
        togglePsychiatristAvailability,
        addPartnerCompany,
        togglePartnerCompanyStatus,
        deletePartnerCompany,
        adminUpdateUserRole,
        markNotificationRead,
        provisionSupportEmployee,
        completeFirstLoginPasswordChange,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
