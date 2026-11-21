import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookmarkCheck,
  CheckCircle2,
  Edit3,
  LogIn,
  LogOut,
  User,
  Warehouse,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { INDIAN_STATES } from "../data/bhoomiData";
import { getRoleDisplayLabel } from "../utils/roles";

export function ProfilePage() {
  const {
    user,
    profile,
    isAdmin,
    savedSchemes,
    bookings,
    updateUserProfile,
    updateBookingStatus,
    logOut,
  } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [state, setState] = useState("Punjab");
  const [district, setDistrict] = useState("");
  const [landSizeAcres, setLandSizeAcres] = useState("2.5");
  const [cropsText, setCropsText] = useState("");
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setPhone(profile.phone);
      setState(profile.state || "Punjab");
      setDistrict(profile.district);
      setLandSizeAcres(String(profile.landSizeAcres ?? 2.5));
      setCropsText(profile.primaryCrops.join(", "));
      setNotifEnabled(profile.notificationsEnabled);
    }
  }, [profile]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-[#2D6A4F]/15 p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#EAF4EE] text-[#2D6A4F] flex items-center justify-center mx-auto">
          <User className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-display font-bold text-[#1B2A20]">
          Your Farmer Profile
        </h1>
        <p className="text-sm text-[#4A5A4F]">
          Sign in or create an account to manage your farm details, saved
          schemes, and storage booking history.
        </p>
        <Link
          to="/auth"
          className="min-h-[48px] px-7 rounded-xl bg-[#E9A23B] hover:bg-[#DC9428] text-[#1B2A20] font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          <span>Log In / Sign Up</span>
        </Link>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice("");
    try {
      await updateUserProfile({
        name: name.trim() || profile?.name || "Farmer",
        phone: phone.trim(),
        state,
        district: district.trim(),
        landSizeAcres: Number(landSizeAcres) || 0,
        primaryCrops: cropsText
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        role: profile?.role,
        notificationsEnabled: notifEnabled,
      });
      setEditing(false);
      setSavedNotice("Profile details updated safely.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logOut();
    navigate("/auth");
  };

  const roleLabel = getRoleDisplayLabel(profile?.role, isAdmin);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-[#2D6A4F]/15 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#EAF4EE] text-[#2D6A4F] flex items-center justify-center font-display font-bold text-2xl shrink-0">
            {(profile?.name || user.email || "F").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-semibold text-[#2D6A4F]">
              {roleLabel} ·{" "}
              {user.emailVerified ? "Verified Account" : "Email Verification Pending"}
            </p>
            <h1 className="text-xl md:text-2xl font-display font-bold text-[#1B2A20]">
              {profile?.name || user.displayName || "User"}
            </h1>
            <p className="text-xs text-[#4A5A4F]">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((prev) => !prev)}
            className="min-h-[44px] px-4 rounded-xl border border-[#2D6A4F] text-[#2D6A4F] hover:bg-[#EAF4EE] font-semibold text-sm inline-flex items-center gap-1.5 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            <span>{editing ? "Cancel" : "Edit Profile"}</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] px-4 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 font-semibold text-sm inline-flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#EAF4EE] border border-[#2D6A4F]/25 text-sm font-medium text-[#1B2A20] flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-[#2D6A4F]" />
          <span>{savedNotice}</span>
        </div>
      )}

      {editing ? (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl border border-[#2D6A4F]/15 p-6 space-y-4"
        >
          <h2 className="font-display font-semibold text-lg">
            Edit Personal & Farm Info
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98..."
                className="w-full h-11 px-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm"
              >
                {INDIAN_STATES.filter((s) => s !== "All India").map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Ludhiana"
                className="w-full h-11 px-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm"
              />
            </div>
            {!isAdmin && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Land Size (Acres)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={landSizeAcres}
                    onChange={(e) => setLandSizeAcres(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Primary Crops (comma separated)
                  </label>
                  <input
                    type="text"
                    value={cropsText}
                    onChange={(e) => setCropsText(e.target.value)}
                    placeholder="Wheat, Paddy, Mustard"
                    className="w-full h-11 px-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm"
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">
                Account Role
              </label>
              <input
                type="text"
                readOnly
                value={roleLabel}
                className="w-full h-11 px-3.5 rounded-xl bg-[#F2EFE6] border border-[#2D6A4F]/15 text-sm text-[#4A5A4F]"
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="pref-notif"
                type="checkbox"
                checked={notifEnabled}
                onChange={(e) => setNotifEnabled(e.target.checked)}
                className="w-4 h-4 accent-[#2D6A4F]"
              />
              <label htmlFor="pref-notif" className="text-sm font-medium">
                Receive scheme &amp; booking alerts
              </label>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-6 rounded-xl bg-[#E9A23B] hover:bg-[#DC9428] text-[#1B2A20] font-semibold text-sm transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="bg-white rounded-2xl border border-[#2D6A4F]/15 p-5 space-y-2">
            <h2 className="font-display font-semibold text-base text-[#1B2A20]">
              Profile &amp; Account Details
            </h2>
            <p className="text-sm text-[#4A5A4F]">
              Location: {profile?.district ? `${profile.district}, ` : ""}
              {profile?.state || "India"}
            </p>
            {isAdmin ? (
              <>
                <p className="text-sm text-[#4A5A4F]">
                  Access Level: Super Administrator
                </p>
                <p className="text-sm text-[#4A5A4F]">
                  Workspaces: Admin Portal, Psychiatrist Desk, Support Desk
                </p>
              </>
            ) : profile?.role === "psychiatrist" ? (
              <>
                <p className="text-sm text-[#4A5A4F]">
                  Qualification: {profile.qualification || "MD Psychiatry"}
                </p>
                <p className="text-sm text-[#4A5A4F]">
                  Specialization: {profile.specialization || "Rural Stress Care"}
                </p>
              </>
            ) : profile?.role === "support_staff" ? (
              <p className="text-sm text-[#4A5A4F]">
                Department: {profile.department || "Farmer Help Operations"}
              </p>
            ) : (
              <>
                <p className="text-sm text-[#4A5A4F] tabular-nums">
                  Land Holding: {profile?.landSizeAcres ?? 0} acres
                </p>
                <p className="text-sm text-[#4A5A4F]">
                  Crops:{" "}
                  {profile?.primaryCrops?.length
                    ? profile.primaryCrops.join(", ")
                    : "Not set"}
                </p>
              </>
            )}
            <p className="text-sm text-[#4A5A4F]">
              Phone: {profile?.phone || "Not added yet"}
            </p>
          </section>

          {isAdmin ? (
            <section className="bg-white rounded-2xl border border-[#2D6A4F]/15 p-5 space-y-3">
              <h2 className="font-display font-semibold text-base text-[#1B2A20]">
                Admin Workspaces
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Link
                  to="/admin"
                  className="min-h-[40px] px-3 rounded-xl bg-[#EAF4EE] text-[#2D6A4F] text-sm font-semibold flex items-center"
                >
                  Admin Portal Dashboard
                </Link>
                <Link
                  to="/psychiatrist"
                  className="min-h-[40px] px-3 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/15 text-[#1B2A20] text-sm font-medium flex items-center hover:bg-[#EAF4EE]"
                >
                  Psychiatrist Desk
                </Link>
                <Link
                  to="/support-desk"
                  className="min-h-[40px] px-3 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/15 text-[#1B2A20] text-sm font-medium flex items-center hover:bg-[#EAF4EE]"
                >
                  Support Desk
                </Link>
                <Link
                  to="/notifications"
                  className="min-h-[40px] px-3 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/15 text-[#1B2A20] text-sm font-medium flex items-center hover:bg-[#EAF4EE]"
                >
                  Notifications
                </Link>
              </div>
            </section>
          ) : (
            <section className="bg-white rounded-2xl border border-[#2D6A4F]/15 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-base text-[#1B2A20]">
                  Saved Schemes ({savedSchemes.length})
                </h2>
                <Link
                  to="/schemes"
                  className="text-xs font-semibold text-[#2D6A4F] hover:underline"
                >
                  Browse
                </Link>
              </div>
              {savedSchemes.length === 0 ? (
                <p className="text-sm text-[#4A5A4F]">No schemes saved yet.</p>
              ) : (
                <div className="space-y-2">
                  {savedSchemes.map((s) => (
                    <Link
                      key={s.id}
                      to={`/schemes/${s.schemeId}`}
                      className="flex items-center gap-2 text-sm font-medium text-[#2D6A4F] hover:underline"
                    >
                      <BookmarkCheck className="w-4 h-4 shrink-0" />
                      <span className="truncate">{s.schemeName}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Storage Bookings History */}
      {!isAdmin && (
      <section className="bg-white rounded-2xl border border-[#2D6A4F]/15 p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-[#2D6A4F]" />
            <h2 className="font-display font-semibold text-lg text-[#1B2A20]">
              My Storage Booking Requests
            </h2>
          </div>
          <Link
            to="/warehouses"
            className="text-sm font-semibold text-[#2D6A4F] hover:underline"
          >
            Find Storage
          </Link>
        </div>

        {bookings.length === 0 ? (
          <p className="text-sm text-[#4A5A4F]">
            You have not submitted any storage booking requests yet.
          </p>
        ) : (
          <div className="divide-y divide-[#2D6A4F]/10">
            {bookings.map((bk) => (
              <div
                key={bk.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold text-sm text-[#1B2A20]">
                    {bk.warehouseName} · {bk.cropType} ({bk.quantity} {bk.unit})
                  </p>
                  <p className="text-xs text-[#4A5A4F] mt-0.5 tabular-nums">
                    Starts {bk.startDate} · {bk.durationMonths} mo · Est. Rs.{" "}
                    {bk.estimatedCostInr.toLocaleString("en-IN")} · Status:{" "}
                    <strong className="uppercase text-[#2D6A4F]">
                      {bk.status}
                    </strong>
                  </p>
                </div>
                {bk.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => updateBookingStatus(bk.id, "cancelled")}
                    className="min-h-[38px] px-3.5 rounded-xl border border-red-200 text-red-700 text-xs font-semibold self-start sm:self-auto"
                  >
                    Cancel Request
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </div>
  );
}
