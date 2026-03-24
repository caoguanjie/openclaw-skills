#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path


KEYS = ("HR_USER", "HR_PASS")


def strip_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def parse_dotenv(path: Path) -> dict:
    result = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if value.startswith("export "):
            value = value[len("export ") :].strip()
        result[key] = strip_quotes(value)
    return result


def find_dotenv(start: Path) -> Path | None:
    current = start.resolve()
    for candidate_dir in [current, *current.parents]:
        candidate = candidate_dir / ".env"
        if candidate.exists():
            return candidate
    return None


def main() -> int:
    values = {key: os.environ.get(key, "") for key in KEYS}
    source = "environment"

    if not all(values.values()):
        dotenv_path = find_dotenv(Path.cwd())
        if dotenv_path:
            dotenv_values = parse_dotenv(dotenv_path)
            for key in KEYS:
                if not values[key]:
                    values[key] = dotenv_values.get(key, "")
            source = str(dotenv_path)

    missing = [key for key, value in values.items() if not value]
    payload = {
        "source": source,
        "values": values,
        "missing": missing,
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
