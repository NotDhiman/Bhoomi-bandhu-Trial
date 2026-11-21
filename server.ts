import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import fs from "fs";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  estimateMonthlyRainfallMm,
  inferRegionalSoilDefaults,
} from "./src/utils/cropAdvisor";
import {
  buildNoReplyAccessEmail,
  validateEmployeeProvisionInput,
} from "./src/utils/employeeAccess";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Foggy / Mist";
  if (code >= 51 && code <= 67) return "Rain / Drizzle";
  if (code >= 71 && code <= 77) return "Cold / Frost conditions";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  return "Seasonal conditions";
}

const SYSTEM_INSTRUCTION = `You are BhoomiBandhu ("A Trusted Friend for Every Farmer"), a warm, practical, and honest agricultural assistant for Indian farmers.

Core principles:
1. Language & Tone: Speak in simple, clear, respectful everyday English (and understand common Hindi agricultural terms like Kharif, Rabi, Zaid, Mandi, Quintal, Beegha, KCC, PM-KISAN, PMFBY). Avoid complex jargon or robotic bullet dumps.
2. Honesty & Safety:
   - Never fabricate government scheme amounts, deadlines, or official URLs if you are unsure. Tell the farmer to verify exact dates on the official portal (e.g., pmkisan.gov.in, pmfby.gov.in) or at their nearest Common Service Centre (CSC) / Krishi Vigyan Kendra (KVK).
   - Never give medical or psychiatric diagnoses. If a farmer expresses distress or mental health struggles, respond with warmth and gently share India's toll-free Tele-MANAS helpline (14416) and Kisan Call Centre (1800-180-1551).
   - Crop recommendations are suggestions based on soil and weather factors, never guaranteed yield promises.
3. Structure: Keep answers concise, actionable, and organized with short bullet points or numbered steps when explaining how to apply or what to check next.`;

interface IncomingMessage {
  role: "user" | "model";
  text: string;
}

type ChatMode = "balanced" | "fast" | "deep";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const ADMIN_BOOTSTRAP_EMAIL = "pranav25dhiman1107@gmail.com";

function readFirebaseApiKey(): string | null {
  try {
    const raw = fs.readFileSync(
      path.resolve(__dirname, "firebase-applet-config.json"),
      "utf-8"
    );
    const parsed = JSON.parse(raw) as { apiKey?: string };
    return parsed.apiKey || null;
  } catch {
    return null;
  }
}

async function verifyAdminBearerToken(
  authHeader: string | undefined
): Promise<{ ok: boolean; email?: string }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false };
  }
  const idToken = authHeader.slice(7).trim();
  const apiKey = readFirebaseApiKey();
  if (!idToken || !apiKey) return { ok: false };

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        apiKey
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return { ok: false };
    const data = (await resp.json()) as {
      users?: Array<{ email?: string; emailVerified?: boolean }>;
    };
    const account = data.users?.[0];
    if (
      account?.email?.toLowerCase() === ADMIN_BOOTSTRAP_EMAIL &&
      account?.emailVerified === true
    ) {
      return { ok: true, email: account.email };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "bhoomibandhu-api" });
  });

  app.get("/api/weather", async (req, res) => {
    const rawLocation = String(req.query.location || "").trim();
    if (rawLocation.length < 2) {
      res.status(400).json({
        error: "Please type a town, district, or city name (at least 2 characters).",
      });
      return;
    }

    try {
      const geoUrlIn = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        rawLocation
      )}&count=5&language=en&format=json&countryCode=IN`;
      const geoResIn = await fetch(geoUrlIn);
      if (!geoResIn.ok) {
        throw new Error(`Geocoding service responded with ${geoResIn.status}`);
      }
      let geoData = (await geoResIn.json()) as {
        results?: Array<{
          name: string;
          admin1?: string;
          country?: string;
          latitude: number;
          longitude: number;
        }>;
      };

      if (!geoData.results || geoData.results.length === 0) {
        const geoUrlGlobal = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          rawLocation
        )}&count=3&language=en&format=json`;
        const geoResGlobal = await fetch(geoUrlGlobal);
        if (geoResGlobal.ok) {
          geoData = (await geoResGlobal.json()) as typeof geoData;
        }
      }

      const place = geoData.results?.[0];
      if (!place) {
        res.status(404).json({
          error: `Could not find "${rawLocation}". Try a nearby district or city like Ludhiana, Nashik, Indore, or Jaipur.`,
        });
        return;
      }

      const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&daily=precipitation_sum&past_days=14&forecast_days=7&timezone=auto`;
      const wxRes = await fetch(forecastUrl);
      if (!wxRes.ok) {
        throw new Error(`Weather forecast service responded with ${wxRes.status}`);
      }

      const wxData = (await wxRes.json()) as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          precipitation?: number;
          weather_code?: number;
        };
        daily?: {
          precipitation_sum?: number[];
        };
      };

      const temperatureC = Math.round(wxData.current?.temperature_2m ?? 25);
      const humidityPct = Math.round(wxData.current?.relative_humidity_2m ?? 60);
      const precipSums = Array.isArray(wxData.daily?.precipitation_sum)
        ? wxData.daily.precipitation_sum
        : [];
      const rainfallMm = estimateMonthlyRainfallMm(
        precipSums,
        precipSums.length || 21
      );
      const weatherSummary = describeWeatherCode(
        wxData.current?.weather_code ?? 0
      );
      const regionLabel = place.admin1 || place.country || "";
      const soilDefaults = inferRegionalSoilDefaults(regionLabel);

      res.json({
        locationName: place.name,
        admin1: place.admin1 || "",
        country: place.country || "India",
        latitude: place.latitude,
        longitude: place.longitude,
        temperatureC,
        humidityPct,
        rainfallMm,
        weatherSummary,
        soilDefaults,
      });
    } catch (error) {
      console.error("Weather fetch error:", error);
      res.status(502).json({
        error: "Unable to fetch live weather for that location right now. Please try again.",
      });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            "Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets.",
        });
        return;
      }

      const body = req.body as {
        messages?: IncomingMessage[];
        mode?: ChatMode;
        language?: string;
      };

      const messages = Array.isArray(body?.messages) ? body.messages : [];
      const mode: ChatMode =
        body?.mode === "fast" || body?.mode === "deep" ? body.mode : "balanced";
      const requestedLanguage =
        typeof body?.language === "string" && body.language.trim()
          ? body.language.trim().slice(0, 40)
          : "English";

      const sanitized = messages
        .filter(
          (m) =>
            m &&
            (m.role === "user" || m.role === "model") &&
            typeof m.text === "string" &&
            m.text.trim().length > 0
        )
        .slice(-20);

      if (sanitized.length === 0) {
        res.status(400).json({ error: "Please enter a message before sending." });
        return;
      }

      const lastMessage = sanitized[sanitized.length - 1];
      if (lastMessage.role !== "user") {
        res.status(400).json({ error: "Latest message must be from the user." });
        return;
      }

      const history = sanitized.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text.trim() }],
      }));

      let model = "gemini-4-hydrogen";
      let thinkingLevel = ThinkingLevel.MEDIUM;

      if (mode === "fast") {
        model = "gemini-3.1-flash-lite";
        thinkingLevel = ThinkingLevel.MINIMAL;
      } else if (mode === "deep") {
        model = "gemini-4-hydrogen";
        thinkingLevel = ThinkingLevel.HIGH;
      }

      const languageHint =
        requestedLanguage.toLowerCase() === "english"
          ? ""
          : `\n4. Preferred Response Language: Respond clearly and naturally in ${requestedLanguage} unless the farmer specifically asks for another language.`;

      const chat = ai.chats.create({
        model,
        history,
        config: {
          systemInstruction: `${SYSTEM_INSTRUCTION}${languageHint}`,
          thinkingConfig: {
            thinkingLevel,
          },
        },
      });

      const response = await chat.sendMessage({
        message: lastMessage.text.trim(),
      });

      const replyText =
        response.text?.trim() ||
        "I could not generate a response right now. Please try asking again in simpler words.";

      res.json({
        reply: replyText,
        modelUsed: model,
        mode,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to reach Gemini AI.";
      console.error("Gemini chat error:", error);

      if (message.includes("403") || message.includes("API_KEY_INVALID")) {
        res.status(403).json({
          error:
            "Gemini API key was rejected. Please verify GEMINI_API_KEY in Settings > Secrets.",
        });
        return;
      }

      if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
        res.status(429).json({
          error:
            "AI quota limit reached temporarily. Please wait a moment or try Fast mode.",
        });
        return;
      }

      res.status(500).json({
        error: "Unable to get an AI response right now. Please try again.",
      });
    }
  });

  app.post("/api/admin/send-employee-access-email", async (req, res) => {
    try {
      const body = req.body as {
        employeeName?: unknown;
        employeeEmail?: unknown;
        tempPassword?: unknown;
        department?: unknown;
        portalUrl?: unknown;
        previewOnly?: unknown;
      };

      if (
        typeof body?.employeeName !== "string" ||
        typeof body?.employeeEmail !== "string" ||
        typeof body?.tempPassword !== "string"
      ) {
        res.status(400).json({
          error: "Employee name, email, and one-time password are required.",
        });
        return;
      }

      const department =
        typeof body.department === "string" ? body.department : undefined;
      const portalUrl =
        typeof body.portalUrl === "string" &&
        (body.portalUrl.startsWith("https://") ||
          body.portalUrl.startsWith("http://localhost"))
          ? body.portalUrl.slice(0, 200)
          : process.env.APP_URL && process.env.APP_URL !== "MY_APP_URL"
          ? process.env.APP_URL
          : "https://bhoomibandhu.in";

      const check = validateEmployeeProvisionInput({
        name: body.employeeName,
        email: body.employeeEmail,
        tempPassword: body.tempPassword,
        department,
      });
      if (!check.valid) {
        res.status(400).json({ error: check.error || "Invalid employee input." });
        return;
      }

      const emailPayload = buildNoReplyAccessEmail({
        employeeName: body.employeeName,
        employeeEmail: body.employeeEmail,
        tempPassword: body.tempPassword,
        department,
        portalUrl,
      });

      const smtpConfigured = Boolean(
        process.env.SMTP_HOST &&
          process.env.SMTP_USER &&
          process.env.SMTP_PASS
      );
      const previewOnly = body.previewOnly === true;

      if (smtpConfigured && !previewOnly) {
        const verified = await verifyAdminBearerToken(
          req.headers.authorization
        );
        if (!verified.ok) {
          res.status(403).json({
            error:
              "Verified Administrator authorization is required to dispatch live emails.",
          });
          return;
        }

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const fromAddress =
          process.env.SMTP_FROM || emailPayload.fromAddress;

        const info = await transporter.sendMail({
          from: fromAddress,
          replyTo: emailPayload.replyTo,
          to: emailPayload.toEmail,
          subject: emailPayload.subject,
          text: emailPayload.bodyText,
        });

        res.json({
          ok: true,
          deliveryMode: "smtp",
          messageId: info.messageId || `smtp-${Date.now()}`,
          emailRecord: {
            ...emailPayload,
            fromAddress,
          },
        });
        return;
      }

      res.json({
        ok: true,
        deliveryMode: "outbox_generated",
        messageId: `noreply-${Date.now()}`,
        emailRecord: emailPayload,
      });
    } catch (error) {
      console.error("Employee access email generation error:", error);
      res.status(500).json({
        error: "Unable to generate automated no-reply access email.",
      });
    }
  });

  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BhoomiBandhu server running at http://localhost:${PORT}`);
  });
}

startServer();
