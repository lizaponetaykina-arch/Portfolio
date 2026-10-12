"""Compatibility entry point for the current scroll-first checks."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name("scroll_checks.py")), run_name="__main__")
