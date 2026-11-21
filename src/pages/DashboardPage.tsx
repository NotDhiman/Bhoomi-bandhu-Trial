import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Compass,
  FileCheck2,
  HeartHandshake,
  HelpCircle,
  Landmark,
  MessageSquare,
  Shield,
  Sprout,
  Warehouse,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { SCHEMES_DATA } from "../data/bhoomiData";
import type { TranslationKey } from "../i18n/translations";
import { getRoleDisplayLabel } from "../utils/roles";

interface ServiceCardDef {
  to: string;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
}

const SERVICE_CARDS: ServiceCardDef[] = [
  {
    to: "/schemes",
    labelKey: "dashboard.cardSchemes",
    descKey: "dashboard.cardSchemesDesc",
    icon: BookOpen,
  },
  {
    to: "/insurance",
    labelKey: "dashboard.cardInsurance",
    descKey: "dashboard.cardInsuranceDesc",
    icon: Shield,
  },
  {
    to: "/warehouses",
    labelKey: "dashboard.cardStorage",
    descKey: "dashboard.cardStorageDesc",
    icon: Warehouse,
  },
  {
    to: "/loans",
    labelKey: "dashboard.cardLoans",
    descKey: "dashboard.cardLoansDesc",
    icon: Landmark,
  },
  {
    to: "/crop-advisor",
    labelKey: "dashboard.cardCropAdvisor",
    descKey: "dashboard.cardCropAdvisorDesc",
    icon: Compass,
  },
  {
    to: "/chat",
    labelKey: "dashboard.cardAiChat",
    descKey: "dashboard.cardAiChatDesc",
    icon: MessageSquare,
  },
  {
    to: "/wellbeing",
    labelKey: "dashboard.cardWellbeing",
    descKey: "dashboard.cardWellbeingDesc",
    icon: HeartHandshake,
  },
  {
    to: "/help",
    labelKey: "dashboard.cardHelp",
    descKey: "dashboard.cardHelpDesc",
    icon: HelpCircle,
  },
];

export function DashboardPage() {
  const { user, profile, isAdmin, savedSchemes, bookings } = useAuth();
  const { t } = useLanguage();

  const displayName = user
    ? profile?.name?.split(" ")[0] || "Friend"
    : "Kisan Friend";

  const featuredScheme = SCHEMES_DATA[0];

  const recentItems = [
    ...savedSchemes.slice(0, 2).map((s) => ({
      id: s.id,
      title: `Scheme saved: ${s.schemeName}`,
      meta: s.category,
      to: `/schemes/${s.schemeId}`,
    })),
    ...bookings.slice(0, 2).map((b) => ({
      id: b.id,
      title: `Storage ${b.status}: ${b.warehouseName}`,
      meta: `${b.quantity} ${b.unit} · ${b.cropType}`,
      to: `/warehouses/${b.warehouseId}`,
    })),
  ];

  return (
    <div className="space-y-8">
      {/* Greeting + Hero Advisory Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 bg-[#EAF4EE] rounded-2xl border border-[#2D6A4F]/15 p-6 md:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-[#2D6A4F] mb-2">
              {user
                ? `${getRoleDisplayLabel(profile?.role, isAdmin)} · ${profile?.state || "India"}`
                : t("dashboard.tagline")}
            </p>
            <h1 className="text-2xl md:text-4xl font-display font-bold text-[#1B2A20] leading-tight">
              {t("dashboard.namaste")}, {displayName}
            </h1>
            <p className="text-sm md:text-base text-[#4A5A4F] mt-3 max-w-xl leading-relaxed">
              {profile?.role === "warehouse_owner"
                ? t("dashboard.heroOwnerDesc")
                : t("dashboard.heroFarmerDesc")}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/eligibility"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E9A23B] hover:bg-[#DC9428] text-[#1B2A20] font-semibold text-sm inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>{t("dashboard.checkEligibility")}</span>
            </Link>
            <Link
              to={`/schemes/${featuredScheme.id}`}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white border border-[#2D6A4F]/25 text-[#2D6A4F] hover:bg-[#F2EFE6] font-semibold text-sm inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <span>
                {t("dashboard.viewScheme")}
                {" "}
                {featuredScheme.shortName}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-[#2D6A4F]/15 bg-white relative min-h-[220px]">
          <img
            src="/src/assets/images/hero_farmland_1795276858314.jpg"
            alt="Green Indian agricultural fields at sunrise"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover lg:h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-5 flex flex-col justify-end text-white">
            <p className="text-xs font-medium text-amber-200">
              {t("dashboard.rabiKharif")}
            </p>
            <p className="font-display font-semibold text-lg leading-snug mt-0.5">
              {t("dashboard.heroRightTitle")}
            </p>
            <Link
              to="/crop-advisor"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#E9A23B] hover:underline"
            >
              <span>{t("dashboard.openCropAdvisor")}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 8-Card Service Grid */}
      <section aria-labelledby="services-heading">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="services-heading"
            className="text-lg md:text-xl font-display font-semibold text-[#1B2A20]"
          >
            {t("dashboard.servicesTitle")}
          </h2>
          <Link
            to="/services"
            className="text-sm font-semibold text-[#2D6A4F] hover:underline whitespace-nowrap"
          >
            {t("dashboard.viewAllModules")}
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          {SERVICE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="bg-white rounded-2xl border border-[#2D6A4F]/15 p-4 md:p-5 hover:border-[#2D6A4F] hover:bg-[#EAF4EE]/40 transition-colors flex flex-col justify-between min-h-[120px]"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EAF4EE] text-[#2D6A4F] flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-display font-semibold text-sm md:text-base text-[#1B2A20]">
                    {t(card.labelKey)}
                  </p>
                  <p className="text-xs text-[#4A5A4F] mt-0.5 line-clamp-1">
                    {t(card.descKey)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Activity & Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#2D6A4F]/15 p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-[#1B2A20]">
              {t("dashboard.recentActivity")}
            </h2>
            {user && (
              <Link
                to="/profile"
                className="text-sm font-medium text-[#2D6A4F] hover:underline"
              >
                Full history
              </Link>
            )}
          </div>

          {!user ? (
            <div className="py-4 space-y-3">
              <p className="text-sm text-[#4A5A4F]">
                Sign in with your email or Google account to save schemes, track
                warehouse storage bookings, and keep AI chat notes across
                devices.
              </p>
              <Link
                to="/auth"
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#E9A23B] hover:bg-[#DC9428] text-[#1B2A20] font-semibold text-sm inline-flex items-center gap-2 transition-colors"
              >
                <span>Log In or Create Free Account</span>
              </Link>
            </div>
          ) : recentItems.length === 0 ? (
            <div className="py-4 space-y-3">
              <p className="text-sm text-[#4A5A4F]">
                No saved schemes or storage requests yet. Start by saving a
                scheme or requesting storage near your mandi.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/schemes"
                  className="text-sm font-semibold text-[#2D6A4F] hover:underline"
                >
                  Browse Schemes
                </Link>
                <span aria-hidden="true" className="text-[#4A5A4F]">
                  ·
                </span>
                <Link
                  to="/warehouses"
                  className="text-sm font-semibold text-[#2D6A4F] hover:underline"
                >
                  Explore Storage
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[#2D6A4F]/10">
              {recentItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  className="py-3.5 flex items-center justify-between gap-3 hover:bg-[#FAF8F3] px-2 -mx-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1B2A20] truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-[#4A5A4F] mt-0.5">{item.meta}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#2D6A4F]/15 p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#2D6A4F] mb-2">
              <Sprout className="w-5 h-5" />
              <h2 className="text-lg font-display font-semibold text-[#1B2A20]">
                {t("dashboard.askAiTitle")}
              </h2>
            </div>
            <p className="text-sm text-[#4A5A4F] leading-relaxed">
              {t("dashboard.askAiDesc")}
            </p>
          </div>
          <div className="mt-5">
            <Link
              to="/chat"
              className="w-full min-h-[44px] rounded-xl border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#EAF4EE] font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t("dashboard.startAiChat")}</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
