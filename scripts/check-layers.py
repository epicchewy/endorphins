#!/usr/bin/env python3
"""Check production imports, including transitive dependencies, against the layer rules."""
import json
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
raw = subprocess.check_output(["go", "list", "-deps", "-json", "./internal/..."], cwd=root / "backend", text=True)
decoder = json.JSONDecoder()
packages = {}
while raw.strip():
    package, offset = decoder.raw_decode(raw.lstrip())
    packages[package["ImportPath"]] = package
    raw = raw.lstrip()[offset:]
prefix = "github.com/epicchewy/endorphins/backend/internal/"
rules = {
    "services/": ("handlers", "server", "repositories", "app", "config", "integrations", "api"),
    "repositories": ("services", "handlers", "server", "app", "api"),
    "handlers": ("repositories", "app", "integrations", "server"),
}
violations = [f"{path.relative_to(root)}: command entrypoint tests are not allowed"
              for path in (root / "backend").rglob("main_test.go")]
for name in packages:
    if name.startswith(prefix + "testfixtures") or name.startswith(prefix + "testhelpers"):
        violations.append(f"test fixture imported by release packages: {name}")
for name, package in packages.items():
    if not name.startswith(prefix):
        continue
    relative = name.removeprefix(prefix)
    for dependency in package.get("Deps", []):
        standard = packages.get(dependency, {}).get("Standard", False)
        if (relative == "domains" or relative.startswith("domains/")) and not standard:
            violations.append(f"{relative} depends on non-standard package {dependency}")
        if relative.startswith("api/") and not standard:
            # Resource DTOs translate inward to domain values and service inputs.
            # Their transitive graph must still exclude storage, HTTP frameworks,
            # integrations and application wiring.
            allowed = any(
                dependency == prefix + layer or dependency.startswith(prefix + layer + "/")
                for layer in ("api", "domains", "services")
            )
            if not allowed:
                violations.append(f"{relative} depends on forbidden DTO dependency {dependency}")
        if relative.startswith("services/") and dependency.startswith("github.com/labstack/"):
            violations.append(f"{relative} depends on HTTP framework {dependency}")
        for layer, forbidden in rules.items():
            if relative.startswith(layer) and any(dependency == prefix + item or dependency.startswith(prefix + item + "/") for item in forbidden):
                violations.append(f"{relative} depends on forbidden layer {dependency.removeprefix(prefix)}")
if violations:
    print("\n".join(sorted(set(violations))), file=sys.stderr)
    sys.exit(1)
print("Backend layer boundaries passed.")
