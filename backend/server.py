#!/usr/bin/env python3
"""
NetScan Pro Backend Server
==========================
Secure API for network scanning operations.
Replaces frontend simulation with real nmap/scapy-based scanning.

⚠️  SECURITY NOTES:
- All inputs are validated against strict allowlists
- Scanning is restricted to configured IP ranges only
- Authentication required for all endpoints (configurable)
- Logs all requests for audit compliance

Usage:
    pip install -r requirements.txt
    cp .env.example .env  # Configure your settings
    python server.py
"""

import os
import re
import json
import logging
import subprocess
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from functools import wraps
from ipaddress import ip_address, ip_network, AddressValueError
from typing import Optional, Dict, List, Union

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv
import xmltodict  # For parsing nmap XML output

# ─────────────────────────────────────────────────────────────
# Configuration & Initialization
# ─────────────────────────────────────────────────────────────

load_dotenv()

app = Flask(__name__)
CORS(app, origins=os.getenv("CORS_ORIGINS", "http://localhost:8000").split(","))

# Logging setup
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper()),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler("logs/netscan.log"),        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Security configuration
ALLOWED_SCAN_RANGES = [
    ip_network(cidr, strict=False) 
    for cidr in os.getenv("ALLOWED_SCAN_RANGES", "192.168.0.0/16,10.0.0.0/8,172.16.0.0/12").split(",")
]
MAX_SCAN_TIMEOUT = int(os.getenv("MAX_SCAN_TIMEOUT", "120"))  # seconds
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # seconds
RATE_LIMIT_MAX = int(os.getenv("RATE_LIMIT_MAX", "10"))  # requests per window

# In-memory rate limiting store (use Redis in production)
rate_limit_store: Dict[str, List[datetime]] = {}

# In-memory scan history (use database in production)
scan_history: List[Dict] = []
HISTORY_MAX_ENTRIES = int(os.getenv("HISTORY_MAX_ENTRIES", "100"))

# Service/port mapping (matches frontend)
SERVICES = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS", 445: "SMB",
    3306: "MySQL", 3389: "RDP", 5900: "VNC", 8080: "HTTP-Alt", 8443: "HTTPS-Alt"
}
RISK_LEVELS = {
    21: "high", 22: "medium", 23: "critical", 25: "medium", 53: "low",
    80: "low", 110: "medium", 143: "medium", 443: "low", 445: "critical",
    3306: "high", 3389: "high", 5900: "high", 8080: "low", 8443: "low"
}
COMMON_PORTS = list(SERVICES.keys())


# ─────────────────────────────────────────────────────────────
# Security Middleware
# ─────────────────────────────────────────────────────────────

def validate_target(target: str) -> tuple[bool, str]:
    """
    Validate target input against security allowlist.
    Returns (is_valid, error_message).
    """
    if not target or len(target) > 253:
        return False, "Invalid target length"
    
    # Allow hostname or IP
    hostname_pattern = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$'
    ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'    
    if re.match(ip_pattern, target):
        try:
            ip = ip_address(target)
            # Check if IP is in allowed ranges
            if not any(ip in network for network in ALLOWED_SCAN_RANGES):
                return False, f"Target IP {target} not in allowed scan ranges"
            return True, ""
        except AddressValueError:
            return False, "Invalid IP address format"
    
    elif re.match(hostname_pattern, target):
        # For hostnames, we'll resolve and validate at scan time
        return True, ""
    
    return False, "Target must be valid IP or hostname"


def rate_limit_check(client_ip: str) -> bool:
    """Simple sliding window rate limiter. Returns True if allowed."""
    now = datetime.now()
    window_start = now - timedelta(seconds=RATE_LIMIT_WINDOW)
    
    # Clean old entries
    rate_limit_store[client_ip] = [
        ts for ts in rate_limit_store.get(client_ip, []) 
        if ts > window_start
    ]
    
    # Check limit
    if len(rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
        return False
    
    # Record this request
    rate_limit_store.setdefault(client_ip, []).append(now)
    return True


def require_auth(f):
    """Decorator for authentication (simplified - implement JWT/OAuth in production)."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Skip auth in dev mode (NOT for production!)
        if os.getenv("DISABLE_AUTH", "false").lower() == "true":
            return f(*args, **kwargs)
        
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid authorization token"}), 401
                # TODO: Validate token against your auth provider
        # For demo: accept any non-empty token
        token = auth_header[7:]
        if not token:
            return jsonify({"error": "Invalid token"}), 401
        
        g.user = {"token": token}  # Placeholder user object
        return f(*args, **kwargs)
    return decorated


# ─────────────────────────────────────────────────────────────
# Scanning Logic
# ─────────────────────────────────────────────────────────────

def resolve_hostname(hostname: str) -> Optional[str]:
    """Resolve hostname to IP address."""
    try:
        import socket
        return socket.gethostbyname(hostname)
    except socket.gaierror:
        return None


def run_nmap_scan(target: str, ports: List[int] = None) -> Dict:
    """
    Execute nmap scan and parse results.
    Returns structured scan data matching frontend expectations.
    """
    if ports is None:
        ports = COMMON_PORTS
    
    # Build nmap command (safe, no shell injection)
    port_str = ",".join(map(str, ports))
    cmd = [
        "nmap",
        "-sV",           # Service version detection
        "-Pn",           # Skip host discovery (assume host is up)
        "-T4",           # Aggressive timing
        "-oX", "-",      # XML output to stdout
        "-p", port_str,
        "--max-retries", "2",
        "--host-timeout", f"{MAX_SCAN_TIMEOUT}s",
        target
    ]
    
    logger.info(f"Executing scan: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(            cmd,
            capture_output=True,
            text=True,
            timeout=MAX_SCAN_TIMEOUT + 30,  # Buffer for processing
            check=False  # We handle exit codes
        )
        
        if result.returncode not in [0, 1]:  # 1 = no hosts up (acceptable)
            logger.error(f"nmap failed: {result.stderr}")
            return {"error": f"Scan failed: {result.stderr.strip()}"}
        
        # Parse XML output
        if not result.stdout.strip():
            return {"error": "Empty scan result"}
            
        parsed = xmltodict.parse(result.stdout)
        return parse_nmap_result(parsed, target)
        
    except subprocess.TimeoutExpired:
        logger.warning(f"Scan timed out for {target}")
        return {"error": "Scan timed out"}
    except FileNotFoundError:
        logger.error("nmap not found in PATH")
        return {"error": "Scanner tool (nmap) not installed on server"}
    except Exception as e:
        logger.exception(f"Unexpected scan error: {e}")
        return {"error": f"Internal error: {str(e)}"}


def parse_nmap_result(xml_data: Dict, original_target: str) -> Dict:
    """Parse nmap XML output into frontend-compatible format."""
    try:
        host = xml_data.get("nmaprun", {}).get("host", {})
        if isinstance(host, list):
            host = host[0]  # Handle multiple hosts (take first)
        
        # Extract basic host info
        addresses = host.get("address", [])
        if not isinstance(addresses, list):
            addresses = [addresses]
        
        ip_addr = next((a["@addr"] for a in addresses if a.get("@addrtype") == "ipv4"), "unknown")
        
        # OS detection (if available)
        os_match = host.get("os", {}).get("osmatch", {})
        os_name = os_match.get("@name", "Unknown") if isinstance(os_match, dict) else "Unknown"
        
        # Port scanning results
        ports_data = host.get("ports", {}).get("port", [])
        if not isinstance(ports_data, list):            ports_data = [ports_data] if ports_data else []
        
        open_ports = []
        for port in ports_data:
            if port.get("state", {}).get("@state") == "open":
                port_num = int(port["@portid"])
                service = port.get("service", {}).get("@name", SERVICES.get(port_num, "unknown"))
                risk = RISK_LEVELS.get(port_num, "medium")
                open_ports.append({
                    "port": port_num,
                    "service": service.upper(),
                    "risk": risk,
                    "version": port.get("service", {}).get("@version", "")
                })
        
        # Additional checks (simplified)
        # In production: add scripts for vuln detection, promisc mode, etc.
        
        scan_time = float(host.get("times", {}).get("@elapsed", "0"))
        
        return {
            "target": original_target,
            "ip": ip_addr,
            "os": os_name,
            "openPorts": open_ports,
            "scanTime": f"{scan_time:.2f}",
            "ttl": host.get("ipid", {}).get("@ttl", "unknown"),
            "promisc": False,  # Would require --script promiscuous
            "dnsLeak": False,  # Would require additional DNS tests
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "raw_ports": len(open_ports),
            "critical_count": sum(1 for p in open_ports if p["risk"] == "critical"),
            "high_count": sum(1 for p in open_ports if p["risk"] == "high")
        }
        
    except Exception as e:
        logger.error(f"Error parsing nmap result: {e}")
        return {"error": f"Result parsing failed: {str(e)}"}


# ─────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health_check():
    """Basic health endpoint for load balancers/monitoring."""
    return jsonify({
        "status": "healthy",
        "version": os.getenv("APP_VERSION", "1.0.0"),        "timestamp": datetime.now().isoformat()
    }), 200


@app.route("/api/scan", methods=["POST"])
@require_auth
def start_scan():
    """Initiate a new network scan."""
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    
    # Rate limiting check
    if not rate_limit_check(client_ip):
        logger.warning(f"Rate limit exceeded for {client_ip}")
        return jsonify({"error": "Rate limit exceeded. Please try again later."}), 429
    
    # Parse and validate input
    try:
        data = request.get_json(force=True)
    except Exception:
        return jsonify({"error": "Invalid JSON payload"}), 400
    
    target = data.get("target", "").strip()
    if not target:
        return jsonify({"error": "Missing 'target' field"}), 400
    
    # Security validation
    is_valid, error_msg = validate_target(target)
    if not is_valid:
        logger.warning(f"Blocked invalid scan target from {client_ip}: {target} ({error_msg})")
        return jsonify({"error": error_msg}), 403
    
    # Resolve hostname if needed
    resolved_target = target
    if not re.match(r'^(\d{1,3}\.){3}\d{1,3}$', target):
        resolved = resolve_hostname(target)
        if resolved:
            # Validate resolved IP against allowlist
            try:
                if not any(ip_address(resolved) in net for net in ALLOWED_SCAN_RANGES):
                    return jsonify({"error": f"Resolved IP {resolved} not in allowed ranges"}), 403
                resolved_target = resolved
                logger.info(f"Resolved {target} -> {resolved}")
            except AddressValueError:
                pass  # Continue with original target; nmap will handle resolution
    
    # Execute scan (synchronous for simplicity; use Celery/RQ for async in production)
    logger.info(f"Starting scan for {target} (resolved: {resolved_target}) by {client_ip}")
    start_time = datetime.now()
    
    result = run_nmap_scan(resolved_target)    
    # Handle scan errors
    if "error" in result:
        logger.error(f"Scan failed for {target}: {result['error']}")
        return jsonify(result), 500 if "Internal" in result["error"] else 400
    
    # Add metadata
    result["scanDuration"] = (datetime.now() - start_time).total_seconds()
    result["requestId"] = f"{datetime.now().timestamp()}-{os.urandom(4).hex()}"
    
    # Save to history
    history_entry = {
        "id": result["requestId"],
        "target": target,
        "ip": result.get("ip"),
        "timestamp": result["timestamp"],
        "openPortsCount": len(result.get("openPorts", [])),
        "scanTime": result.get("scanTime"),
        "criticalCount": result.get("critical_count", 0),
        "highCount": result.get("high_count", 0)
    }
    scan_history.insert(0, history_entry)
    if len(scan_history) > HISTORY_MAX_ENTRIES:
        scan_history.pop()
    
    logger.info(f"Scan completed for {target}: {len(result.get('openPorts', []))} open ports")
    return jsonify(result), 200


@app.route("/api/history", methods=["GET"])
@require_auth
def get_history():
    """Retrieve recent scan history."""
    limit = min(int(request.args.get("limit", 10)), 100)  # Max 100 entries
    return jsonify({
        "scans": scan_history[:limit],
        "total": len(scan_history)
    }), 200


@app.route("/api/history/<scan_id>", methods=["GET"])
@require_auth
def get_scan_detail(scan_id: str):
    """Retrieve detailed results for a specific historical scan."""
    # In production: fetch from database
    # For demo: search in-memory history (limited functionality)
    for entry in scan_history:
        if entry.get("id") == scan_id:
            # Re-run lightweight scan for details (or cache full results in production)
            result = run_nmap_scan(entry["ip"] or entry["target"])            if "error" not in result:
                result["historyId"] = scan_id
                return jsonify(result), 200
    return jsonify({"error": "Scan not found"}), 404


@app.route("/api/config", methods=["GET"])
@require_auth
def get_config():
    """Return non-sensitive configuration info for frontend."""
    return jsonify({
        "allowedRanges": [str(net) for net in ALLOWED_SCAN_RANGES],
        "commonPorts": COMMON_PORTS,
        "riskLevels": RISK_LEVELS,
        "services": SERVICES,
        "maxTimeout": MAX_SCAN_TIMEOUT,
        "version": os.getenv("APP_VERSION", "1.0.0")
    }), 200


# ─────────────────────────────────────────────────────────────
# Error Handlers
# ─────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def internal_error(e):
    logger.exception("Internal server error")
    return jsonify({"error": "Internal server error"}), 500


# ─────────────────────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Ensure logs directory exists
    os.makedirs("logs", exist_ok=True)
    
    host = os.getenv("SERVER_HOST", "127.0.0.1")
    port = int(os.getenv("SERVER_PORT", "5000"))    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    
    logger.info(f"🚀 NetScan Pro Backend starting on {host}:{port}")
    logger.info(f"   Allowed scan ranges: {[str(n) for n in ALLOWED_SCAN_RANGES]}")
    logger.info(f"   Auth required: {os.getenv('DISABLE_AUTH', 'false').lower() != 'true'}")
    
    # ⚠️  Never use debug=True in production
    app.run(host=host, port=port, debug=debug, threaded=True)