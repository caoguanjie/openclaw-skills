"""chrome_launcher 单元测试。"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
import chrome_launcher


def test_ensure_chrome_reuses_existing_cdp_instance():
    """端口已占用且 CDP 可用时，不应重启 Chrome。"""
    with (
        patch.object(chrome_launcher, "is_port_open", return_value=True),
        patch.object(chrome_launcher, "is_cdp_ready", return_value=True),
        patch.object(chrome_launcher, "restart_chrome") as mock_restart,
    ):
        assert chrome_launcher.ensure_chrome(port=9222) is True

    mock_restart.assert_not_called()


def test_ensure_chrome_restarts_when_port_open_but_cdp_unavailable():
    """端口已占用但 CDP 不可用时，应自动重启 Chrome。"""
    with (
        patch.object(chrome_launcher, "is_port_open", return_value=True),
        patch.object(chrome_launcher, "is_cdp_ready", side_effect=[False, True]),
        patch.object(chrome_launcher, "restart_chrome") as mock_restart,
    ):
        assert chrome_launcher.ensure_chrome(
            port=9222,
            headless=True,
            user_data_dir="/tmp/xhs-profile",
            chrome_bin="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ) is True

    mock_restart.assert_called_once_with(
        port=9222,
        headless=True,
        user_data_dir="/tmp/xhs-profile",
        chrome_bin="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    )


def test_ensure_chrome_returns_false_when_restarted_cdp_still_unavailable():
    """自动重启后仍无 CDP 端点时，应返回失败。"""
    with (
        patch.object(chrome_launcher, "is_port_open", return_value=True),
        patch.object(chrome_launcher, "is_cdp_ready", side_effect=[False, False]),
        patch.object(chrome_launcher, "restart_chrome") as mock_restart,
    ):
        assert chrome_launcher.ensure_chrome(port=9222) is False

    mock_restart.assert_called_once_with(
        port=9222,
        headless=False,
        user_data_dir=None,
        chrome_bin=None,
    )


def test_ensure_chrome_launches_and_waits_for_cdp_on_empty_port():
    """端口未占用时，应启动 Chrome 并校验 CDP 就绪。"""
    with (
        patch.object(chrome_launcher, "is_port_open", return_value=False),
        patch.object(chrome_launcher, "launch_chrome") as mock_launch,
        patch.object(chrome_launcher, "is_cdp_ready", return_value=True),
    ):
        assert chrome_launcher.ensure_chrome(port=9222, headless=True) is True

    mock_launch.assert_called_once_with(
        port=9222,
        headless=True,
        user_data_dir=None,
        chrome_bin=None,
    )
