"""Single configuration point for the Employee Onboarding Operations demo.

Nothing else in this project hard-codes a company name, domain, or brand. Change
the values in demo_config.json (or set the matching environment variables) to
retarget the demo at a different organisation or a future client.

Settings
--------
real_domain   The live corporate domain the PII scrubbers detect and remove, e.g.
              "acme.com". Deliberately EMPTY by default so that no real company
              domain is ever committed to source. Scrubbing and PII verification
              are skipped while it is blank -- set it to switch them on.
              env: DEMO_REAL_DOMAIN
demo_domain   Fictional domain used for generated personal addresses. Defaults to
              an RFC 2606 reserved domain, which can never route to a real inbox.
              env: DEMO_DOMAIN
demo_work_domain
              Fictional domain used for generated work addresses.
              env: DEMO_WORK_DOMAIN
client_name   Organisation the demo is presented as, for headings and docs.
              env: DEMO_CLIENT_NAME
product_name  Display name of the tool itself.
              env: DEMO_PRODUCT_NAME
cohort_slug_prefix
              Prefix for generated cohort group slugs, e.g. "onboarding-2026-05-11".
              env: DEMO_COHORT_SLUG_PREFIX
theme         The five brand colours the dashboard derives its whole palette
              from: primary, accent, deep, background, soft. Overriding these
              re-themes the UI without touching any CSS; every other step
              (hover tints, ink levels, chart marks) is derived from them.
              env: DEMO_THEME_PRIMARY, DEMO_THEME_ACCENT, DEMO_THEME_DEEP,
                   DEMO_THEME_BACKGROUND, DEMO_THEME_SOFT
"""

import json
import os
import pathlib

_DEFAULTS = {
    "product_name": "Employee Onboarding Operations",
    "client_name": "Demo Company",
    "real_domain": "",
    "demo_domain": "example.com",
    "demo_domain_alt": "example.net",
    "demo_work_domain": "democo.example",
    "cohort_slug_prefix": "onboarding",
}

_THEME_DEFAULTS = {
    "primary":    "#2563EB",
    "accent":     "#00B4D8",
    "deep":       "#0F172A",
    "background": "#F8FAFC",
    "soft":       "#E0F2FE",
}

_PATH = pathlib.Path(__file__).with_name("demo_config.json")

_cfg = dict(_DEFAULTS)
if _PATH.exists():
    try:
        _cfg.update(json.loads(_PATH.read_text()))
    except (ValueError, OSError):
        # A malformed config must not take the tooling down -- fall back to defaults.
        pass


def _get(key, env_var):
    """Environment variable wins over the JSON file, which wins over the default."""
    value = os.environ.get(env_var)
    return value if value is not None else _cfg.get(key, _DEFAULTS.get(key, ""))


PRODUCT_NAME = _get("product_name", "DEMO_PRODUCT_NAME")
CLIENT_NAME = _get("client_name", "DEMO_CLIENT_NAME")
REAL_DOMAIN = _get("real_domain", "DEMO_REAL_DOMAIN").strip()
DEMO_DOMAIN = _get("demo_domain", "DEMO_DOMAIN")
DEMO_DOMAIN_ALT = _get("demo_domain_alt", "DEMO_DOMAIN_ALT")
DEMO_WORK_DOMAIN = _get("demo_work_domain", "DEMO_WORK_DOMAIN")
COHORT_SLUG_PREFIX = _get("cohort_slug_prefix", "DEMO_COHORT_SLUG_PREFIX")


def _theme():
    """Brand colours: env var, then demo_config.json, then the default.

    Anything that is not a plain #rrggbb value is dropped rather than passed
    through -- these end up as CSS custom properties, so the shape is checked
    here instead of trusting the config file.
    """
    import re

    valid = re.compile(r"^#[0-9A-Fa-f]{6}$")
    from_file = _cfg.get("theme") or {}
    out = {}
    for key, default in _THEME_DEFAULTS.items():
        value = os.environ.get("DEMO_THEME_" + key.upper())
        if value is None:
            value = from_file.get(key, default)
        out[key] = value if valid.match(str(value)) else default
    return out


THEME = _theme()

# Convenience: the scrubbers are inert until a real domain is configured, so an
# unconfigured checkout can never claim a clean bill of health it has not earned.
SCRUBBING_ENABLED = bool(REAL_DOMAIN)


def real_domain_pattern():
    """Regex matching addresses at the configured real domain, or None if unset."""
    import re

    if not REAL_DOMAIN:
        return None
    return re.compile(r"[A-Za-z0-9._%+-]+@" + re.escape(REAL_DOMAIN) + r"\b", re.I)


def demo_replacement_address():
    """The address real addresses are rewritten to during scrubbing."""
    return "demo.user@" + DEMO_DOMAIN
