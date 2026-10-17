#!/usr/bin/env python3
import re
import sys


VERSION_PATTERN = re.compile(
    r"^[vV]?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?"
    r"(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$"
)


def parse_version(tag):
    match = VERSION_PATTERN.fullmatch(tag)
    if match is None:
        raise ValueError(f"Invalid release tag: {tag}")

    major, minor, patch, prerelease, _build = match.groups()
    prerelease_ids = prerelease.split(".") if prerelease else None
    if prerelease_ids and any(
        identifier.isdigit()
        and len(identifier) > 1
        and identifier.startswith("0")
        for identifier in prerelease_ids
    ):
        raise ValueError(
            f"Numeric prerelease can't have leading zeroes: {tag}"
        )

    return int(major), int(minor), int(patch), prerelease_ids


def compare_versions(left, right):
    left_major, left_minor, left_patch, left_pre = parse_version(left)
    right_major, right_minor, right_patch, right_pre = parse_version(right)

    left_core = (left_major, left_minor, left_patch)
    right_core = (right_major, right_minor, right_patch)
    if left_core != right_core:
        return (left_core > right_core) - (left_core < right_core)

    if left_pre is None or right_pre is None:
        return (left_pre is None) - (right_pre is None)

    for left_id, right_id in zip(left_pre, right_pre):
        if left_id == right_id:
            continue
        left_numeric = left_id.isdigit()
        right_numeric = right_id.isdigit()
        if left_numeric and right_numeric:
            return (int(left_id) > int(right_id)) - (int(left_id) < int(right_id))
        if left_numeric != right_numeric:
            return -1 if left_numeric else 1
        return (left_id > right_id) - (left_id < right_id)

    return (len(left_pre) > len(right_pre)) - (len(left_pre) < len(right_pre))


def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} VERSION_A VERSION_B", file=sys.stderr)
        return 2

    try:
        is_newer = compare_versions(sys.argv[1], sys.argv[2]) > 0
    except ValueError as error:
        print(error, file=sys.stderr)
        return 2

    print("true" if is_newer else "false")
    return 0


if __name__ == "__main__":
    sys.exit(main())
