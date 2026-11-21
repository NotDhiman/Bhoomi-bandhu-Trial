import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Search,
} from "lucide-react";
import { FAQS_DATA } from "../data/bhoomiData";
import { useAuth } from "../context/AuthContext";

export function HelpPage() {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [openId, setOpenId] = useState<string | null>(FAQS_DATA[0]?.id || null);

  const { user, supportTickets, submitSupportTicket } = useAuth();
  const navigate = useNavigate();

  const [subject, setSubject] = useState("Scheme Application Help");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const filteredFaqs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS_DATA;
    return FAQS_DATA.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) {
      navigate("/auth");
      return;
    }
    if (message.trim().length < 5) {
      setError("Please describe your question in at least 5 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await submitSupportTicket({
        category: "support",
        subject,
        message: message.trim(),
        priority,
      });
      setMessage("");
      setPriority("normal");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#EAF4EE] text-[#2D6A4F] flex items-center justify-center shrink-0">
          <HelpCircle className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-[#1B2A20]">
            Help Centre
          </h1>
          <p className="text-sm text-[#4A5A4F]">
            Common questions answered simply, plus direct support requests.
          </p>
        </div>
      </div>

      {/* FAQ Search */}
      <div className="relative">
        <label htmlFor="faq-search" className="sr-only">
          Search frequently asked questions
        </label>
        <Search className="w-5 h-5 text-[#4A5A4F] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id="faq-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search FAQs..."
          className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-[#2D6A4F]/20 text-base focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30"
        />
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-2.5">
        {filteredFaqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div
              key={faq.id}
              className="bg-white rounded-2xl border border-[#2D6A4F]/15 overflow-hidden"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full min-h-[56px] px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-[#FAF8F3] transition-colors"
              >
                <div>
                  <p className="text-xs font-semibold text-[#2D6A4F]">
                    {faq.category}
                  </p>
                  <p className="font-semibold text-sm md:text-base text-[#1B2A20] mt-0.5">
                    {faq.question}
                  </p>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-5 h-5 text-[#2D6A4F] shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[#2D6A4F] shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-sm text-[#4A5A4F] leading-relaxed border-t border-[#2D6A4F]/10 pt-3">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Contact Support Form */}
      <section className="bg-white rounded-2xl border border-[#2D6A4F]/15 p-6 space-y-4">
        <h2 className="font-display font-semibold text-lg text-[#1B2A20]">
          Still need help?
        </h2>

        {submitted && (
          <div className="p-3.5 rounded-xl bg-[#EAF4EE] text-sm text-[#1B2A20] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
            <span>Your support request has been logged safely.</span>
          </div>
        )}

        <form onSubmit={handleSupportSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-700 bg-red-50 p-3 rounded-xl">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="help-subject"
                className="block text-sm font-medium mb-1"
              >
                Subject
              </label>
              <select
                id="help-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm"
              >
                <option value="Scheme Application Help">
                  Scheme Application Help
                </option>
                <option value="Warehouse Booking Issue">
                  Warehouse Booking Issue
                </option>
                <option value="Account or Profile Update">
                  Account or Profile Update
                </option>
                <option value="General Feedback">General Feedback</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="help-priority"
                className="block text-sm font-medium mb-1"
              >
                Priority
              </label>
              <select
                id="help-priority"
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "normal" | "urgent")
                }
                className="w-full h-11 px-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm"
              >
                <option value="normal">Normal Support</option>
                <option value="urgent">Urgent (Time-Sensitive)</option>
              </select>
            </div>
          </div>
          <div>
            <label
              htmlFor="help-message"
              className="block text-sm font-medium mb-1"
            >
              Message
            </label>
            <textarea
              id="help-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Explain what you need help with..."
              className="w-full p-3.5 rounded-xl bg-[#FAF8F3] border border-[#2D6A4F]/25 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[48px] px-6 rounded-xl bg-[#E9A23B] hover:bg-[#DC9428] text-[#1B2A20] font-semibold text-sm transition-colors"
          >
            {submitting
              ? "Submitting..."
              : user
              ? "Submit Support Request"
              : "Sign In to Contact Support"}
          </button>
        </form>

        {user && supportTickets.length > 0 && (
          <div className="pt-4 border-t border-[#2D6A4F]/10 space-y-2.5">
            <p className="text-xs font-semibold text-[#2D6A4F]">
              Your Recent Support Requests
            </p>
            {supportTickets.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl bg-[#FAF8F3] text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#1B2A20]">
                    {t.subject}
                  </span>
                  <span className="uppercase font-semibold text-[#2D6A4F] shrink-0">
                    {t.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-[#4A5A4F]">{t.message}</p>
                {t.employeeReply && (
                  <div className="p-2.5 rounded-lg bg-[#EAF4EE] text-[#1B2A20]">
                    <strong>
                      {t.assignedEmployeeName || "Support Team"}:
                    </strong>{" "}
                    {t.employeeReply}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
