# Phone Browser Agent - Complete Project Directory Index
**Last Updated:** 2026-11-20 | 14:50 IST  
**Workspace:** `/data/data/com.termux/files/home/phone-browser-agent`  
**User:** Arunasish Roy Chowdhury (`roychowdhuryarunasish33@gmail.com`)

---

## 📂 ডিরেক্টরি স্ট্রাকচার (Directory Structure)

```
phone-browser-agent/
├── automation-scripts/             # প্ল্যাটফর্ম অটোমেশন ও স্ক্র্যাপিং স্ক্রিপ্টসমূহ (৬৭টি স্ক্রিপ্ট)
│   ├── add_bsnl_experience.js      # BSNL ইন্টার্নশিপ যোগ করার স্ক্রিপ্ট
│   ├── fill_freelancer_bid.js      # ফ্রিল্যান্সার বিড সাবমিট স্ক্রিপ্ট
│   ├── submit_bid_project2.js      # প্রজেক্ট ২ বিড স্ক্রিপ্ট
│   ├── submit_bid_project3.js      # প্রজেক্ট ৩ বিড স্ক্রিপ্ট
│   ├── fill_fiverr_complete.js     # ফাইভার অনবোর্ডিং স্ক্রিপ্ট
│   ├── fill_contra_step1..3.js     # কন্ট্রো প্রোফাইল ফিলআপ স্ক্রিপ্ট
│   ├── fill_truelancer_exact.js    # ট্রুল্যান্সার ফর্ম ফিলআপ স্ক্রিপ্ট
│   ├── fill_pph_app.js             # পিপলপারআওয়ার ফর্ম স্ক্রিপ্ট
│   └── ...                         # অন্যান্য হেল্পার ও ডিবাগ স্ক্রিপ্ট
│
├── saved-sessions/                 # অ্যাকাউন্ট, সেশন ও প্রোফাইল মাস্টার ডেটা
│   ├── PLATFORMS-ACTIVITY-REPORT.md # সকল প্ল্যাটফর্মের পূর্ণাঙ্গ অ্যাক্টিভিটি রিপোর্ট
│   ├── accounts-manifest.json      # সমস্ত অ্যাকাউন্ট, লাইভ প্রজেক্ট লিঙ্ক ও বিড ডেটা (JSON)
│   ├── user-master-profile.md      # ইউজারের পূর্ণাঙ্গ প্রফেশনাল বায়ো ও টেকনিক্যাল প্রোফাইল
│   ├── user-master-profile.json    # প্রোগ্রাম্যাটিক ব্যবহারের জন্য প্রোফাইল ডেটা
│   ├── profile_photo.jpg           # অফিসিয়াল প্রোফাইল ফটো ব্যাকআপ
│   ├── portfolio/                  # তৈরি করা প্রফেশনাল পোর্টফোলিও ব্যানারসমূহ
│   │   ├── project1_ai_support.png # Multi-Channel AI Support Bot কভার
│   │   ├── project2_lead_crm.png   # Lead Qualification & CRM Pipeline কভার
│   │   └── project3_web_portal.png # Responsive Web Portal & CMS কভার
│   └── cookies/                    # সমস্ত প্ল্যাটফর্মের লগইন কুকিজ (Persistent Sessions)
│       ├── freelancer.com.json     # ফ্রিল্যান্সার লগইন কুকি
│       ├── www.linkedin.com.json   # লিঙ্কডইন লগইন কুকি
│       ├── contra.json             # কন্ট্রা সেশন কুকি
│       ├── peopleperhour.json      # পিপলপারআওয়ার সেশন কুকি
│       └── truelancer.json         # ট্রুল্যান্সার সেশন কুকি
│
├── keepalive.py                    # অটোমেটিক ওয়্যারলেস ADB ও Chrome CDP ব্রিজ কানেক্টর
├── start-bridge.sh                 # ব্রিজ স্টার্ট স্ক্রিপ্ট (স্বয়ংক্রিয় ডেমন সহ)
├── browser-daemon.js               # পারসিস্টেন্ট রেসিডেন্ট ডেমন (Warm CDP WebSocket সার্ভিস)
├── browser-client.js               # আল্ট্রা-ফাস্ট IPC ক্লায়েন্ট (Unix Socket/HTTP)
├── browser-actions.js              # সমন্বিত CDP ও সেম্যান্টিক অ্যাকশন ইঞ্জিন
├── browser-control.js              # লো-লেভেল CDP ব্রাউজার কন্ট্রোলার (Fast Daemon Path + Standalone Fallback)
├── semantic-browser.js             # সেম্যান্টিক এআই ডম নেভিগেটর (Fast Daemon Path + Standalone Fallback)
├── add_portfolio.js                # পোর্টফোলিও পাবলিশার
├── status.txt                      # বর্তমান ব্রিজ ও সিডিপি সংযোগ স্ট্যাটাস
└── device.txt                      # বর্তমান কানেক্টেড মোবাইল ADB IP ও পোর্ট
```

---

## 🚀 গুরুত্বপূর্ণ কমান্ড ও ব্যবহারবিধি (Quick Usage Guide)

### ১. ওয়্যারলেস ব্রিজ চালু রাখা:
```bash
cd ~/phone-browser-agent
./start-bridge.sh
```

### ২. বর্তমান স্ট্যাটাস ও কানেক্টেড ডিভাইস চেক:
```bash
cat status.txt
cat device.txt
```

### ৩. সমস্ত প্ল্যাটফর্ম রিপোর্ট দেখতে:
```bash
cat saved-sessions/PLATFORMS-ACTIVITY-REPORT.md
```

### ৪. লাইভ প্রজেক্ট ও অ্যাকাউন্ট ম্যানিফেস্ট দেখতে:
```bash
cat saved-sessions/accounts-manifest.json
```
