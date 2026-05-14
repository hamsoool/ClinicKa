import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load env vars for the middleware
dotenv.config({ path: ".env.local" });

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "email-api",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === "/api/send-email" && req.method === "POST") {
            let body = "";
            req.on("data", (chunk) => { body += chunk; });
            req.on("end", async () => {
              try {
                const { submissionId, status, staffNotes } = JSON.parse(body);
                
                const supabaseUrl = process.env.SUPABASE_URL;
                const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
                const supabase = createClient(supabaseUrl!, supabaseKey!);

                // 1. Get submission details
                const { data: submission } = await supabase
                  .from('submissions')
                  .select('student_id, year_level')
                  .eq('id', submissionId)
                  .single();

                // 2. Get student profile for email
                const { data: student } = await supabase
                  .from('students')
                  .select('profile_id, first_name, last_name')
                  .eq('student_id', submission!.student_id)
                  .single();

                const { data: profile } = await supabase
                  .from('profiles')
                  .select('email')
                  .eq('id', student!.profile_id)
                  .single();

                if (!profile?.email) {
                  res.statusCode = 200;
                  res.end(JSON.stringify({ success: false, message: "Email not found" }));
                  return;
                }

                // 3. Setup Nodemailer
                const transporter = nodemailer.createTransport({
                  host: process.env.SMTP_HOST,
                  port: Number(process.env.SMTP_PORT),
                  secure: Number(process.env.SMTP_PORT) === 465,
                  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
                });

                // 4. Prepare content
                const studentName = `${student!.first_name} ${student!.last_name}`;
                const yl = Number(submission!.year_level);
                const yearLabel = yl === 1 ? '1st Year' : yl === 2 ? '2nd Year' : yl === 3 ? '3rd Year' : '4th Year';
                let subject = '';
                let emailBody = '';

                if (status === 'returned') {
                  subject = 'Action Required: Medical Record Returned for Correction';
                  emailBody = `Hi ${studentName},\n\nYour medical record submission for ${yearLabel} has been returned by the clinic staff for correction.\n\nNote from Clinic Staff:\n"${staffNotes || 'No specific notes provided.'}"\n\nPlease log in to the student portal to update and resubmit your record.`;
                } else if (status === 'approved') {
                  subject = 'Medical Clearance Approved';
                  emailBody = `Hi ${studentName},\n\nGood news! Your medical record submission for ${yearLabel} has been approved.\n\nYou can now view and download your medical clearance certificate from your dashboard in the clinic portal.`;
                } else if (status === 'physical_exam_done') {
                  subject = 'Physical Examination Completed';
                  emailBody = `Hi ${studentName},\n\nYour physical examination for ${yearLabel} has been marked as completed by the clinic staff.\n\nYour record is now in the final stage of review. We will notify you once your medical clearance is ready.`;
                }

                await transporter.sendMail({
                  from: `"Gordon College Clinic" <${process.env.SMTP_USER}>`,
                  to: profile.email,
                  subject,
                  text: emailBody,
                  html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;"><h2 style="color: #006d3c;">Gordon College Clinic</h2><div style="line-height: 1.6; color: #333;">${emailBody.replace(/\n/g, '<br>')}</div><hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;"><p style="font-size: 12px; color: #888;">This is an automated notification from the Gordon College Clinic System. Please do not reply to this email.</p></div>`,
                });

                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true }));
              } catch (err) {
                console.error(err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(err) }));
              }
            });
          } else {
            next();
          }
        });
      },
    },
    VitePWA({
      injectRegister: false,
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "logo.png", "clinickalogo.png", "icon-192.png", "icon-512.png"],
      manifest: {
        id: "/",
        name: "ClinicKa!",
        short_name: "ClinicKa!",
        description: "ClinicKa! health records and clinic management for Gordon College",
        theme_color: "#006d3c",
        background_color: "#f4fcf2",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait",
        categories: ["medical", "health", "education"],
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          {
            name: "Student Portal",
            short_name: "Student",
            url: "/student/dashboard",
          },
          {
            name: "Staff Portal",
            short_name: "Staff",
            url: "/staff/dashboard",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/api\//],
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client", "react-router", "lucide-react"],
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/");
          if (!normalizedId.includes("/node_modules/")) return;
          if (
            normalizedId.includes("/node_modules/react/") ||
            normalizedId.includes("/node_modules/react-dom/") ||
            normalizedId.includes("/node_modules/react-router/") ||
            normalizedId.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          if (normalizedId.includes("/node_modules/@radix-ui/")) return "vendor-radix";
          if (normalizedId.includes("/node_modules/lucide-react/")) return "vendor-icons";
          if (normalizedId.includes("/node_modules/recharts/")) return "vendor-charts";
          if (normalizedId.includes("/node_modules/motion/")) return "vendor-motion";
        },
      },
    },
  },
  assetsInclude: ["**/*.svg", "**/*.csv"],
});
