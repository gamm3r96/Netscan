# 🛜 NetScan Pro

> A sleek, mobile-first web-based network scanner with real-time visualization and security risk assessment.

![NetScan Pro Preview](https://via.placeholder.com/430x932/000000/0a84ff?text=NetScan+Pro+Preview)

<div align="center">

[✨ Features](#-features) • [🚀 Usage](#-usage) • [⚙️ Tech Stack](#-tech-stack) • [🔐 Security Note](#-security-disclaimer) • [📄 License](#-license)

</div>

---

## 📖 Overview

**NetScan Pro** is a lightweight, browser-based network scanning interface designed for security professionals and IT administrators. It provides a visual dashboard to scan target hosts, analyze open ports, assess security risks, and review scan history — all rendered in a responsive, dark-themed UI optimized for mobile devices.

> ⚠️ **Note**: This is a **frontend demonstration** with simulated scanning logic. For production use, integrate with backend scanning tools like `nmap`, `masscan`, or `scapy`.

---

## ✨ Features

### 🔍 Network Scanning
- Input target by IP address or hostname
- Simulated multi-step scanning workflow with progress indicator
- Real-time visualization of scan progress and results

### 📊 Results Dashboard
- **Statistics Grid**: Open ports count, scan duration, critical/high risk indicators
- **Host Details**: Resolved IP, detected OS, TTL, promiscuous mode & DNS leak detection
- **Port Analysis**: Color-coded risk badges (Critical 🔴 → Low 🟢) with service identification

### 📋 Scan History
- Auto-saves last 10 scans locally
- Quick access to previous targets with metadata summary
- Timestamped entries for audit tracking

### ℹ️ Security Reference
- Built-in risk guide for common ports (FTP, SSH, RDP, SMB, etc.)
- Educational content on promiscuous mode detection and DNS leak prevention
- Color-coded severity levels for quick threat assessment

### 🎨 UI/UX Highlights
- Mobile-first responsive design (max-width: 430px)
- Dark theme with gradient accents and smooth animations
- Tab-based navigation: Scan • History • Info
- Accessible form controls and keyboard support (`Enter` to scan)

---

## 🚀 Usage

### ▶️ Quick Start
1. Save the HTML file as `index.html`
2. Open directly in any modern browser (Chrome, Firefox, Safari, Edge)
3. Enter a target (e.g., `192.168.1.1` or `example.com`)
4. Click **🚀 Start Scan** or press `Enter`

### 🔄 Simulated vs Real Scanning
| Feature | Current (Demo) | Production Ready |
|---------|---------------|------------------|
| Network Discovery | Randomized mock data | `nmap`/`arp-scan` backend |
| Port Scanning | Predefined port list with random open states | TCP/UDP connect/SYN scans |
| OS Detection | Random selection from preset list | Passive fingerprinting (`p0f`) |
| Risk Assessment | Static mapping table | CVE lookup + dynamic scoring |

### 🔧 Integrating Real Scanning (Backend Example)
To connect this frontend to a real scanner, create a simple API endpoint:

```python
# Example: Flask backend snippet
from flask import Flask, request, jsonify
import subprocess, json

app = Flask(__name__)

@app.route('/api/scan', methods=['POST'])
def scan():
    target = request.json.get('target')
    # ⚠️ Validate & sanitize input thoroughly
    result = subprocess.run(
        ['nmap', '-sV', '--script', 'vuln', '-oX', '-', target],
        capture_output=True, text=True
    )
    # Parse XML output and return JSON
    return jsonify(parse_nmap_xml(result.stdout))
```

Then update the `startScan()` JS function to `fetch('/api/scan', ...)` instead of `generateScan()`.

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | HTML5, CSS3 (Flexbox/Grid), Vanilla JavaScript |
| **Styling** | CSS Variables, Gradients, Responsive Units |
| **Logic** | ES6+ (Async/Await, Arrow Functions, Template Literals) |
| **Data** | In-memory array (`history`), no external dependencies |
| **Design** | Mobile-first, Dark Mode, System Font Stack |

✅ **Zero dependencies** — no frameworks, CDNs, or build tools required.

---

## 📁 Project Structure

```
netcan-pro/
├── index.html          # Single-file application (HTML + CSS + JS)
├── README.md           # This file
├── SECURITY.md         # (Recommended) Usage guidelines & legal disclaimer
└── backend/            # (Optional) Folder for server-side scanner integration
    ├── server.py       # Flask/FastAPI example
    └── requirements.txt
```

---

## 🔐 Security Disclaimer

> ⚠️ **Use Responsibly**

- **Authorization Required**: Only scan networks and devices you own or have explicit written permission to test.
- **Legal Compliance**: Unauthorized scanning may violate laws (e.g., CFAA, GDPR, Computer Misuse Act).
- **Demo Limitations**: This frontend uses randomized data. Do not rely on it for actual security assessments without backend integration.
- **Production Hardening**: Before deployment:
  - Add authentication & rate limiting
  - Sanitize all user inputs server-side
  - Log scans for audit trails
  - Restrict scan ranges via configuration

📄 See [`SECURITY.md`](SECURITY.md) (recommended) for detailed responsible disclosure guidelines.

---

## 🛠️ Customization

### 🎨 Theming
Edit CSS variables in the `<style>` block:
```css
:root {
  --primary: #0a84ff;      /* Blue accent */
  --success: #30d158;      /* Green for safe */
  --warning: #ff9500;      /* Orange for medium risk */
  --danger: #ff2d55;       /* Red for critical */
  --bg: #000000;           /* Background */
  --card: #1c1c1e;         /* Card surface */
}
```

### ➕ Adding Ports
Update the `PORTS`, `SERVICES`, and `RISKS` arrays in the `<script>` section:
```javascript
const PORTS = [21, 22, 23, /* ... */, 9000]; // Add custom ports
const SERVICES = {9000: "CustomApp"};        // Label them
const RISKS = {9000: "medium"};              // Assign risk level
```

### 🌐 Localization
Replace static text with a simple i18n object:
```javascript
const I18N = {
  en: { scanBtn: "🚀 Start Scan", placeholder: "192.168.1.1 or hostname.com" },
  es: { scanBtn: "🚀 Iniciar Escaneo", placeholder: "192.168.1.1 o dominio.com" }
};
// Then use: document.getElementById('scanBtn').textContent = I18N[lang].scanBtn;
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/awesome-feature`)
3. Commit changes (`git commit -m 'feat: add awesome feature'`)
4. Push to branch (`git push origin feat/awesome-feature`)
5. Open a Pull Request

💡 **Good first issues**: 
- Add export to CSV/PDF
- Implement dark/light theme toggle
- Add WebSocket support for live scan updates
- Write unit tests for `generateScan()` logic

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

```text
MIT License

Copyright (c) 2024 NetScan Pro Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

> 🛡️ **Built for education & authorized security testing only.**  
> 🌐 *Scan responsibly. Stay legal. Keep networks safe.*

<div align="center">
  <sub>Made with 🔍 & 💙 by the NetScan Pro team</sub>
</div>
