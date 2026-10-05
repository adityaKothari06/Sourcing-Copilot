# Sourcing Copilot — Tractor & Implements Talent Search Engine

Autonomous recruitment intelligence service tailored specifically for the Indian **Tractor & Agricultural Machinery / Implements** industry.

This standalone service helps recruiters tackle **brand-new positions** where the internal database has zero historical matches.

---

## 🚜 Key Features

1. **Multimodal Role Intake:**
   - **Voice Dictation:** Speak spoken recruiter notes in Hindi, Hinglish, or English using the mic button.
   - **Quick Brief / WhatsApp Note:** Paste raw informal requirements from clients.
   - **Full Job Description (JD):** Paste comprehensive client briefs.

2. **Domain-Specific Query Generation:**
   - **Naukri Resdex Boolean String:** Formatted with `AND`, `OR`, `NOT`, quotation marks, and title variations to avoid commercial vehicle or generic IT resume noise.
   - **Google X-Ray Search:** Prepares `site:linkedin.com/in ...` queries with a **1-click direct launch button** that finds publicly indexed candidate profiles on Google **without needing a paid LinkedIn Recruiter license**.
   - **LinkedIn Search:** Ready Boolean strings and 1-click search links.
   - **WhatsApp & Referral Outreach:** 1-click copy template to broadcast to friendly dealership owners, regional distributors, and ex-candidates.

3. **Active Keyword Tuning & Feedback Loop:**
   - Rate individual keywords with **Thumbs Up (👍)** or **Thumbs Down (👎)**.
   - Automatically stores feedback in `data/db.json`.
   - Remembers which keywords generated good profiles and suppresses ineffective terms in subsequent searches.
   - Rate overall search run quality (`Found 4+ CVs` / `Moderate` / `Zero Results`).

4. **Zero-Setup Local Persistence:**
   - All positions, search runs, and keyword conversion signals are safely saved locally in `data/db.json`. No external database configuration required.

---

## 🚀 Quick Start

Run the development server on port **3001** (leaving port 3000 free for `hire-expert`):

```bash
cd f:\Solutions\sourcing-copilot
npm run dev
```

Open your browser at:
👉 **http://localhost:3001**

### Optional AI Acceleration (Gemini)
To enable Gemini 2.5 Flash for nuanced Hinglish analysis:
Add your API key to `.env.local`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```
*(If no API key is provided, the service automatically runs on its built-in rule-based Tractor & Implements domain knowledge engine!)*
