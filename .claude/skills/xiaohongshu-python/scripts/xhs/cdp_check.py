"""CDP 连接检查 — 探测 Chrome 远程调试端口是否可达。"""

from __future__ import annotations

import json
import socket
import urllib.request


def check_cdp_port(host: str = "127.0.0.1", port: int = 9222, timeout: float = 2.0) -> bool:
    """TCP 探测 Chrome CDP 端口是否可连接。"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        return sock.connect_ex((host, port)) == 0
    finally:
        sock.close()


def get_cdp_version(host: str = "127.0.0.1", port: int = 9222, timeout: float = 2.0) -> dict:
    """获取 CDP /json/version 信息，验证 Chrome 调试协议可用。"""
    url = f"http://{host}:{port}/json/version"
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return {}


def check_cdp(host: str = "127.0.0.1", port: int = 9222) -> dict:
    """完整的 CDP 可用性检查，返回结构化结果。"""
    port_ok = check_cdp_port(host, port)
    if not port_ok:
        return {
            "cdp": False,
            "host": host,
            "port": port,
            "error": "Chrome 远程调试端口不可达",
            "hint": (
                "请在 Chrome 地址栏打开 chrome://inspect/#remote-debugging，"
                "勾选 'Allow remote debugging for this browser instance'，"
                "可能需要重启浏览器"
            ),
        }

    version = get_cdp_version(host, port)
    if not version:
        return {
            "cdp": False,
            "host": host,
            "port": port,
            "error": "端口可达但 CDP 协议无响应",
            "hint": "端口可能被其他服务占用，请确认是 Chrome 远程调试端口",
        }

    return {
        "cdp": True,
        "host": host,
        "port": port,
        "browser": version.get("Browser", ""),
        "protocol_version": version.get("Protocol-Version", ""),
        "user_agent": version.get("User-Agent", ""),
    }
