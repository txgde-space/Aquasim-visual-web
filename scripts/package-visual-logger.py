#!/usr/bin/env python3
"""Package the standalone ns-3 module without build files or OS metadata."""
from hashlib import sha256
from pathlib import Path
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "contrib" / "visual-logger"
OUTPUT = ROOT / "exports" / "visual-logger.zip"


def main():
    subprocess.run(
        ["node", "scripts/export-ns3-logger.mjs", "--check"], cwd=ROOT, check=True
    )
    files = sorted(
        path for path in SOURCE.rglob("*")
        if path.is_file()
        and not any(part.startswith(".") or part == "__pycache__"
                    for part in path.relative_to(SOURCE).parts)
        and path.suffix in {".h", ".cc", ".inc", ".md", ".txt"}
    )
    required = {"CMakeLists.txt", "README.md", "helper/visual-log-helper.h",
                "helper/visual-log-helper.cc", "model/visual-logger.h",
                "model/detail/trace-core.h", "adapters/aqua-sim-adapter.h"}
    assert required <= {path.relative_to(SOURCE).as_posix() for path in files}
    OUTPUT.parent.mkdir(exist_ok=True)
    # Stable ordering, permissions and timestamps make unchanged exports reproducible.
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED) as archive:
        for path in files:
            assert not path.is_symlink(), f"Unexpected symlink: {path}"
            entry = ZipInfo("visual-logger/" + path.relative_to(SOURCE).as_posix(),
                            date_time=(1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            entry.compress_type = ZIP_DEFLATED
            archive.writestr(entry, path.read_bytes())
    with ZipFile(OUTPUT) as archive:
        assert archive.testzip() is None
        for path in files:
            name = "visual-logger/" + path.relative_to(SOURCE).as_posix()
            assert archive.read(name) == path.read_bytes()
    digest = sha256(OUTPUT.read_bytes()).hexdigest()
    OUTPUT.with_suffix(".zip.sha256").write_text(f"{digest}  {OUTPUT.name}\n")
    print(f"Packaged {len(files)} files: {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
