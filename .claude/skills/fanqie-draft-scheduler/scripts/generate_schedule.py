#!/usr/bin/env python3
"""Generate a Fanqie chapter-to-release schedule for four daily release slots."""

from __future__ import annotations

import argparse
from datetime import date, timedelta

TIME_SLOTS = ["06:00", "12:00", "16:00", "22:00"]


def build_schedule(start_chapter: int, end_chapter: int, base_date: date):
    for chapter in range(start_chapter, end_chapter + 1):
        index = chapter - start_chapter
        day_offset = index // len(TIME_SLOTS)
        time_slot = TIME_SLOTS[index % len(TIME_SLOTS)]
        yield chapter, base_date + timedelta(days=day_offset), time_slot


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate Fanqie timed-publish schedule with four daily slots.",
    )
    parser.add_argument("start_chapter", type=int)
    parser.add_argument("end_chapter", type=int)
    parser.add_argument("base_date", help="YYYY-MM-DD")
    args = parser.parse_args()

    if args.end_chapter < args.start_chapter:
        raise SystemExit("end_chapter must be >= start_chapter")

    year, month, day = map(int, args.base_date.split("-"))
    start_date = date(year, month, day)

    for chapter, release_date, release_time in build_schedule(
        args.start_chapter,
        args.end_chapter,
        start_date,
    ):
        print(f"第{chapter}章	{release_date.isoformat()} {release_time}")


if __name__ == "__main__":
    main()
